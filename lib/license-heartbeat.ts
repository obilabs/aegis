/**
 * License heartbeat — periodic call to apps/web's `/api/instances/validate`.
 *
 * Spec: openspec/changes/telemetry-heartbeat-audit/
 *
 * Pre-2026-06-10 the client only validated its license at boot. Then
 * silence — apps/web's `instances.last_heartbeat_at` went stale (verified
 * 5 days silent on clockworx 2026-06-10). The fix: schedule a 20-minute
 * interval that fires `validateLicense()` for the lifetime of the
 * process. apps/web's validate handler ALSO writes a row to
 * `instance_heartbeats` on every call (success or failure), so the audit
 * history catches up too.
 *
 * Cadence: `LICENSE_HEARTBEAT_INTERVAL_MS` env var, default 1,200,000 ms
 * (20 min). Floor: 5 min — sub-floor values clamp + log a warning.
 *
 * Community installs (no `license_key` on `organizations`) skip the
 * heartbeat; they have nothing to validate against. Licensed installs
 * (post-`/api/instances/exchange`) heartbeat for the lifetime of the
 * process.
 */

import { queryOne } from '@/lib/db'
import { getEffectiveTelemetryState } from '@/lib/telemetry-consent'

const DEFAULT_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes
const FLOOR_INTERVAL_MS = 5 * 60 * 1000    // 5 minutes
const FETCH_TIMEOUT_MS = 30_000

function deriveValidateUrl(): string {
  if (process.env.LICENSE_URL) return process.env.LICENSE_URL
  // Derive from TELEMETRY_URL by swapping the path. Same host = same
  // apps/web deployment, which is the canonical pattern.
  const telemetryUrl = process.env.TELEMETRY_URL
    || 'https://api.obilabs.dev/api/instances/heartbeat'
  return telemetryUrl.replace(/\/api\/instances\/heartbeat$/, '/api/instances/validate')
}

function clampInterval(): number {
  const raw = Number(process.env.LICENSE_HEARTBEAT_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  if (raw < FLOOR_INTERVAL_MS) {
    console.warn(
      `[license-heartbeat] Requested interval ${raw}ms is below floor ` +
      `${FLOOR_INTERVAL_MS}ms; clamping to floor.`
    )
    return FLOOR_INTERVAL_MS
  }
  return raw
}

let _interval: NodeJS.Timeout | null = null
let _shutdownController: AbortController | null = null

/**
 * Fire one validate call. Reads the org's instance_id + license_key from
 * the DB so config changes mid-process are picked up on the next cycle.
 * Fire-and-forget — caller does not await; failures log but never throw.
 */
async function fireOnce(): Promise<void> {
  try {
    const org = await queryOne<{ id: string; instance_id: string; license_key: string | null }>(
      `SELECT id, instance_id, license_key FROM organizations LIMIT 1`,
    )
    if (!org?.instance_id || !org?.license_key) {
      // Community install or pre-setup; nothing to validate yet.
      return
    }

    // Telemetry consent gate (PRINCIPLES.md #2). The validate call doubles
    // as the heartbeat-audit appender on apps/web — an operator who
    // disabled telemetry from /portal/settings (or via TELEMETRY_ENABLED=
    // false env) should not be phoning home, even for "license validation."
    // License continues to work locally; just isn't re-checked until the
    // operator re-enables.
    const consent = await getEffectiveTelemetryState(org.id)
    if (consent.effective === 'off') return

    _shutdownController?.abort()
    _shutdownController = new AbortController()
    const timer = setTimeout(() => _shutdownController?.abort(), FETCH_TIMEOUT_MS)

    try {
      const url = deriveValidateUrl()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: org.instance_id,
          license_key: org.license_key,
          version: process.env.npm_package_version
            || process.env.NEXT_PUBLIC_APP_VERSION
            || '0.1.0',
        }),
        signal: _shutdownController.signal,
      })
      if (!res.ok) {
        console.warn(`[license-heartbeat] non-OK response: ${res.status}`)
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    // Network errors, AbortError on shutdown, DB errors — all logged,
    // never thrown. The heartbeat is best-effort.
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[license-heartbeat] fire failed: ${message}`)
  }
}

/**
 * Start the recurring license heartbeat. Idempotent — calling twice
 * returns without rescheduling. Survives the lifetime of the process.
 *
 * SIGTERM aborts any in-flight fetch via the shared AbortController.
 */
export function startLicenseHeartbeat(): void {
  if (_interval) return

  const intervalMs = clampInterval()
  console.log(`[license-heartbeat] scheduled every ${intervalMs / 1000}s`)

  // Fire once at startup so the first cycle doesn't wait the full window.
  void fireOnce()

  _interval = setInterval(() => { void fireOnce() }, intervalMs)

  // Graceful shutdown: abort in-flight + clear interval.
  const shutdown = () => {
    if (_interval) clearInterval(_interval)
    _interval = null
    _shutdownController?.abort()
    _shutdownController = null
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
