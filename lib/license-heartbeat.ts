/**
 * Licence heartbeat — via the shared `@obilabs/licensing` client.
 *
 * Aegis is fully open-source and community-licensed: NOTHING is gated when
 * the operator does not pay (only the MSP portal, MTP, gates on payment). So
 * this module is a liveness HEARTBEAT that NEVER blocks or degrades the
 * product — the same fail-open posture Helios ships. It:
 *
 *   - routes the actual check through `validateLicense()` (the one sanctioned
 *     path to the control plane — no more hand-rolled fetch that only looked
 *     at `res.ok` and never read the response body),
 *   - applies `applyFailOpenPolicy` (valid → run; unknown → run silently on
 *     the last-good cache; invalid → run + warn, degrade NOTHING),
 *   - persists ONLY authoritative answers (`isPersistableStatus`), so a
 *     transient outage is never written as a licence verdict,
 *   - loads the last-good snapshot before the first check so an `unknown`
 *     result carries a grace anchor (`authoritativeAt`).
 *
 * Consent gating is unchanged: the validate call doubles as the
 * heartbeat-audit appender on the control plane, so it stays behind
 * `getEffectiveTelemetryState()` (PRINCIPLES.md #2) exactly as before.
 *
 * Community installs carry `license_key = NULL` on `organizations` and never
 * phone home from here — there is nothing to validate. (The old self-minted
 * `AEGIS-*` key path was dead code with no server-side landing; deleted.)
 *
 * FAIL-OPEN IS NON-NEGOTIABLE: no code path in this file may throw out of the
 * heartbeat or block app startup. `startLicenseHeartbeat()` is synchronous
 * fire-and-forget; `fireOnce()` catches everything.
 */

import {
  validateLicense,
  applyFailOpenPolicy,
  isPersistableStatus,
  type LicenseResult,
  type CachedLicenseSnapshot,
} from '@obilabs/licensing'
import { query, queryOne } from '@/lib/db'
import { getEffectiveTelemetryState } from '@/lib/telemetry-consent'

const DEFAULT_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes
const FLOOR_INTERVAL_MS = 5 * 60 * 1000    // 5 minutes
const FETCH_TIMEOUT_MS = 30_000

const APP_VERSION =
  process.env.npm_package_version || process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

// Community feature floor. Aegis never gates on the licence — every install
// has the full product — so the floor is empty and the control plane's
// `features` map (returned on a `valid` answer) is overlay for DISPLAY only.
// The plan key is never interpreted — any plan, including one this build does
// not know, gets this same floor. Nothing in the app may branch product
// behaviour on these values.
const COMMUNITY_FEATURES: Record<string, boolean> = {}

/**
 * Derive the control plane BASE URL. The shared client appends
 * `/api/instances/validate` itself, so we strip any endpoint path off the
 * legacy env vars (LICENSE_URL used to hold the full validate URL; the
 * TELEMETRY_URL default holds the heartbeat URL — same host, same deployment).
 */
function deriveBaseUrl(): string {
  const explicit = process.env.LICENSE_URL
  if (explicit) return explicit.replace(/\/api\/instances\/validate\/?$/, '')
  const telemetryUrl =
    process.env.TELEMETRY_URL || 'https://api.obilabs.dev/api/instances/heartbeat'
  return telemetryUrl.replace(/\/api\/instances\/heartbeat\/?$/, '')
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
let _lastResult: LicenseResult | null = null
let _cachedSnapshot: CachedLicenseSnapshot | null = null
let _snapshotLoaded = false

/**
 * Parse a stored snapshot. Only an authoritative (valid/invalid) snapshot is
 * a legitimate grace anchor — anything else is discarded.
 */
function parseSnapshot(raw: string | null | undefined): CachedLicenseSnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedLicenseSnapshot
    if (parsed?.state === 'valid' || parsed?.state === 'invalid') return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Persist the last authoritative answer into `organizations.settings`
 * (JSONB key `license_state`). Additive write — no other settings key is
 * touched. Best-effort: a failed write never surfaces to the heartbeat.
 */
async function storeSnapshot(orgId: string, snapshot: CachedLicenseSnapshot): Promise<void> {
  try {
    await query(
      `UPDATE organizations
          SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{license_state}', $1::jsonb)
        WHERE id = $2`,
      [JSON.stringify(snapshot), orgId],
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[license-heartbeat] could not persist licence snapshot: ${message}`)
  }
}

/**
 * Fire one validate call. Reads the org's instance_id + license_key from the
 * DB so config changes mid-process are picked up on the next cycle.
 * Fire-and-forget — caller does not await; failures log but NEVER throw.
 */
async function fireOnce(): Promise<void> {
  try {
    const org = await queryOne<{
      id: string
      instance_id: string | null
      license_key: string | null
      license_state: string | null
    }>(
      `SELECT id, instance_id, license_key,
              settings #>> '{license_state}' AS license_state
         FROM organizations LIMIT 1`,
    )

    // Load the last-good snapshot once, on the first cycle, so the very
    // first `unknown` result already carries its grace anchor.
    if (org && !_snapshotLoaded) {
      _cachedSnapshot = parseSnapshot(org.license_state)
      _snapshotLoaded = true
    }

    if (!org?.instance_id || !org?.license_key) {
      // Community install (license_key = NULL) or pre-setup — nothing to
      // validate, no phone-home. Fail-safe to community mode.
      return
    }

    // Telemetry consent gate (PRINCIPLES.md #2). The validate call doubles
    // as the heartbeat-audit appender on the control plane — an operator who
    // disabled telemetry from /portal/settings (or via TELEMETRY_ENABLED=
    // false env) should not be phoning home, even for "license validation."
    // License continues to work locally; just isn't re-checked until the
    // operator re-enables.
    const consent = await getEffectiveTelemetryState(org.id)
    if (consent.effective === 'off') return

    _shutdownController?.abort()
    _shutdownController = new AbortController()

    // validateLicense NEVER throws — every failure mode (DNS, timeout, 5xx,
    // malformed body) resolves to a three-state LicenseResult. This is the
    // g3 fix: the old code only checked res.ok and never read the body.
    const result = await validateLicense(org.license_key, {
      baseUrl: deriveBaseUrl(),
      instanceId: org.instance_id,
      version: APP_VERSION,
      timeoutMs: FETCH_TIMEOUT_MS,
      cached: _cachedSnapshot,
      signal: _shutdownController.signal,
    })
    _lastResult = result

    // Fail-open: `allow` is ALWAYS true for Aegis. We only surface a warning
    // on an authoritative `invalid` (revoked/expired/…) — and even then we
    // degrade nothing, because there is nothing gated to degrade.
    const decision = applyFailOpenPolicy(result)
    if (decision.warn) {
      console.warn(`[license-heartbeat] ${decision.explanation}`)
    } else if (result.state === 'valid') {
      console.log(
        `[license-heartbeat] state=valid plan=${result.plan ?? 'community'} (${result.reason})`
      )
    }
    // `unknown` is deliberately silent — an outage of the control plane is
    // not the operator's problem and must not spam their logs.

    // Persist ONLY authoritative answers — an `unknown` (outage/timeout)
    // must never be written as a licence status. This is the canonical fix
    // for "unreachable persisted as revoked".
    if (isPersistableStatus(result)) {
      const snapshot: CachedLicenseSnapshot = {
        state: result.state as 'valid' | 'invalid',
        reason: result.reason,
        product: result.product,
        plan: result.plan,
        expiresAt: result.expiresAt,
        authoritativeAt: result.authoritativeAt ?? result.checkedAt,
      }
      _cachedSnapshot = snapshot
      await storeSnapshot(org.id, snapshot)
    }
  } catch (err) {
    // DB errors, AbortError on shutdown — all logged, never thrown. The
    // heartbeat is best-effort; the product's availability never depends on it.
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[license-heartbeat] fire failed: ${message}`)
  }
}

/**
 * Start the recurring license heartbeat. Idempotent — calling twice returns
 * without rescheduling. Synchronous and fire-and-forget: it can never block
 * or fail app startup.
 *
 * SIGTERM aborts any in-flight validation via the shared AbortController.
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

// ---------------------------------------------------------------------------
// Null-safe read accessors — display/attribution only, NEVER gating.
// ---------------------------------------------------------------------------

/** Current plan key as reported, or 'community' when none. Display only; never gates. */
export function getLicensePlan(): string {
  return _lastResult?.plan ?? 'community'
}

/**
 * Feature map for display. Null-safe: community floor overlaid with the
 * control plane's `features` when we have a valid result. Aegis does not gate
 * on any of these — they exist for parity + future UI (e.g. a licence badge).
 */
export function getLicenseFeatures(): Record<string, boolean> {
  const fromCp = _lastResult?.features ?? null
  if (!fromCp) return { ...COMMUNITY_FEATURES }
  // Only copy boolean-valued keys; the wire type is Record<string, unknown>.
  const overlay: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(fromCp)) {
    if (typeof v === 'boolean') overlay[k] = v
  }
  return { ...COMMUNITY_FEATURES, ...overlay }
}

/** Display-only feature lookup. Defaults to the community floor (false). */
export function hasLicenseFeature(feature: string): boolean {
  return getLicenseFeatures()[feature] ?? false
}

/** True when the control plane last confirmed a valid licence. */
export function isLicensed(): boolean {
  return _lastResult?.state === 'valid'
}
