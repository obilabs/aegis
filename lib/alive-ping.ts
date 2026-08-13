/**
 * Alive ping — recurring, minimal, default-on liveness beacon.
 *
 * WHY THIS EXISTS: the control plane counts active installs from
 * `instances.last_heartbeat_at` (`active_*_30d`). Two client paths refresh that column and
 * NEITHER fires for a community install after first boot:
 *   - lib/license-heartbeat.ts validates every ~20 min, but early-returns when
 *     `organizations.license_key IS NULL` (nothing to validate);
 *   - lib/telemetry.ts sends the Tier-0 install ping ONCE, and the recurring Tier-2 usage
 *     heartbeat is opt-in (and runs on pg-boss).
 * So a community install reports once, at install, then goes silent and ages out of the
 * 30-day active window while still running. This scheduler closes that gap by sending the
 * minimal `sendAlivePing()` on a schedule.
 *
 * DESIGN INVARIANTS (see openspec/changes/telemetry-alive-ping/design.md, on apps/web):
 *   - NOT pg-boss. Community installs are exactly where pg-boss reliability is worst (a
 *     fresh install can boot with a drifted pgboss schema that crashes the job runner). A
 *     plain setInterval — the license-heartbeat pattern — is the robust choice. For the
 *     same reason this MUST be started independently of pg-boss registration in
 *     instrumentation.ts (its own try/catch, before the pg-boss workers).
 *   - Community-only + consent-gated: both are enforced inside `sendAlivePing()` /
 *     `sendTelemetry()`, not here.
 *   - Strictly fail-open: no path in this file may throw out of the tick or block startup.
 */

import { queryOne } from '@/lib/db'
import { sendAlivePing } from '@/lib/telemetry'

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours — day-granularity is plenty for a 30-day window
const FLOOR_INTERVAL_MS = 60 * 60 * 1000        // 1 hour — guard against a misconfig hammering the control plane

let _interval: NodeJS.Timeout | null = null

function clampInterval(): number {
  const raw = Number(process.env.ALIVE_PING_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  if (raw < FLOOR_INTERVAL_MS) {
    console.warn(
      `[alive-ping] Requested interval ${raw}ms is below floor ${FLOOR_INTERVAL_MS}ms; ` +
      `clamping to floor.`
    )
    return FLOOR_INTERVAL_MS
  }
  return raw
}

/**
 * Fire one liveness ping. Reads the single org's id fresh each cycle. Fire-and-forget —
 * community-only + consent gating live downstream in sendAlivePing/sendTelemetry. Never throws.
 */
async function fireOnce(): Promise<void> {
  try {
    const org = await queryOne<{ id: string }>('SELECT id FROM organizations LIMIT 1')
    if (!org?.id) return // pre-setup — nothing to report yet
    await sendAlivePing(org.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[alive-ping] fire failed: ${message}`)
  }
}

/**
 * Start the recurring alive ping. Idempotent — calling twice returns without rescheduling.
 * Synchronous and fire-and-forget: it can never block or fail app startup.
 */
export function startAlivePing(): void {
  if (_interval) return

  const intervalMs = clampInterval()
  console.log(`[alive-ping] scheduled every ${intervalMs / 1000}s`)

  // Fire once at startup so a fresh community install is counted immediately, not after
  // the first full interval.
  void fireOnce()

  _interval = setInterval(() => { void fireOnce() }, intervalMs)

  const shutdown = () => {
    if (_interval) clearInterval(_interval)
    _interval = null
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
