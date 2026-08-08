/**
 * Telemetry consent — resolution of the per-org telemetry kill-switch.
 *
 * Coexists with the existing tier-based system in `lib/telemetry.ts`:
 *
 *   `telemetry_settings.enabled` = master switch (this module)
 *   `organizations.telemetry_tier` = level of detail when enabled (legacy,
 *     handled by lib/telemetry.ts)
 *   `TELEMETRY_ENABLED=false` env var = override that beats both
 *
 * When `enabled=false` (env or DB), NO telemetry is sent — not even the
 * Tier-0 install ping that used to fire unconditionally. This closes the
 * highest-risk pre-publication item from the 2026-06-11 install-count
 * research: operators now have a documented opt-out path that actually
 * suppresses the wire.
 *
 * Resolution order:
 *   1. process.env.TELEMETRY_ENABLED === 'false'  → off-by-env
 *   2. telemetry_settings.enabled = false         → off-by-setting
 *   3. (default)                                  → on
 *
 * The env-var check is intentionally NOT cached at module load — a future
 * "hot-reload of operator preferences" feature might rewrite the env at
 * runtime. The cost of re-reading `process.env` is negligible.
 */

import { query, queryOne } from '@/lib/db'

export type EffectiveSource = 'env' | 'db' | 'default'
export type EffectiveState = 'on' | 'off'

export interface EffectiveTelemetryState {
  effective: EffectiveState
  source: EffectiveSource
  dbValue: boolean
}

export type ConsentSource =
  | 'setup_wizard'
  | 'settings_ui'
  | 'env_var'
  | 'retroactive_pre_consent_release'

export type ConsentAction = 'acknowledged' | 'enabled' | 'disabled'

function envSaysDisabled(): boolean {
  return process.env.TELEMETRY_ENABLED === 'false'
}

/**
 * Resolve the effective telemetry state for an organization.
 *
 * Call this from any code path about to send telemetry. If it returns
 * `effective: 'off'`, suppress the send. The `source` field is for the
 * settings tile so the operator can see WHY telemetry is off (env vs
 * setting).
 */
export async function getEffectiveTelemetryState(
  organizationId: string,
): Promise<EffectiveTelemetryState> {
  const row = await queryOne<{ enabled: boolean }>(
    `SELECT enabled FROM telemetry_settings WHERE organization_id = $1`,
    [organizationId],
  )
  const dbValue = row?.enabled ?? true

  if (envSaysDisabled()) {
    return { effective: 'off', source: 'env', dbValue }
  }
  if (dbValue === false) {
    return { effective: 'off', source: 'db', dbValue }
  }
  return { effective: 'on', source: 'default', dbValue }
}

/**
 * Convenience: just the boolean. Use when the source is irrelevant.
 */
export async function isTelemetryEnabled(organizationId: string): Promise<boolean> {
  const state = await getEffectiveTelemetryState(organizationId)
  return state.effective === 'on'
}

/**
 * Update the telemetry consent state for an organization.
 *
 * Updates `telemetry_settings.enabled` AND appends a row to
 * `telemetry_consent_log` in the same transaction. The log is append-only
 * per PRINCIPLES.md #6 — UPDATE / DELETE on existing log rows is
 * forbidden at the application layer.
 *
 * `userId` is null when the change is triggered by an env-var transition
 * detected on boot (no human in the loop).
 */
export async function setTelemetryEnabled(
  organizationId: string,
  newValue: boolean,
  userId: string | null,
  source: ConsentSource,
  reason?: string,
): Promise<void> {
  const current = await getEffectiveTelemetryState(organizationId)
  const prevState: 'on' | 'off' | 'default-on' = current.dbValue ? 'on' : 'off'
  const newState: 'on' | 'off' = newValue ? 'on' : 'off'
  const action: ConsentAction =
    source === 'setup_wizard' && newValue ? 'acknowledged'
    : newValue ? 'enabled'
    : 'disabled'

  // Atomic update + log append. If either fails, both roll back.
  // pg-pool handles a single client across the transaction.
  await query('BEGIN')
  try {
    await query(
      `INSERT INTO telemetry_settings (organization_id, enabled, updated_at, updated_by_user_id)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (organization_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         updated_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id`,
      [organizationId, newValue, userId],
    )
    await query(
      `INSERT INTO telemetry_consent_log
         (organization_id, user_id, action, source, prev_state, new_state, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [organizationId, userId, action, source, prevState, newState, reason ?? null],
    )
    await query('COMMIT')
  } catch (err) {
    await query('ROLLBACK')
    throw err
  }
}

/**
 * Returns true if the org has at least one consent log row that is NOT
 * the retroactive backfill — i.e., a real operator (or env-var
 * transition) has made a choice. Used by the retroactive banner to
 * decide whether to surface itself.
 */
export async function hasExplicitConsentChoice(organizationId: string): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM telemetry_consent_log
        WHERE organization_id = $1
          AND source != 'retroactive_pre_consent_release'
     ) AS exists`,
    [organizationId],
  )
  return row?.exists ?? false
}
