import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { setTelemetryTier, buildInstallPing } from '@/lib/telemetry'
import {
  getEffectiveTelemetryState,
  setTelemetryEnabled,
} from '@/lib/telemetry-consent'
import { logAudit, getClientIp } from '@/lib/audit'

/**
 * GET /api/settings/telemetry
 * Returns telemetry settings and recent log entries.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit 2026-07-23): telemetry settings expose the license
  // key + instance id — admin-only, matching the PATCH below.
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Get telemetry settings
  const org = await queryOne<{ instance_id: string; license_key: string; telemetry_tier: number }>(
    'SELECT instance_id, license_key, telemetry_tier FROM organizations WHERE id = $1',
    [orgId]
  )

  // Get recent telemetry log entries
  const logResult = await query<{
    id: string
    tier: number
    event_type: string
    payload: unknown
    status: string
    response_code: number | null
    error_message: string | null
    sent_at: string | null
    created_at: string
  }>(
    `SELECT id, tier, event_type, payload, status, response_code, error_message, sent_at, created_at
     FROM telemetry_log
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [orgId]
  )

  logAudit({
    orgId, userId, action: 'telemetry_viewed', actionCategory: 'view',
    entityType: 'settings', entityName: 'telemetry',
    actorIp: getClientIp(request.headers),
  })

  // Effective consent state — env > db > default. Surface to the UI so
  // the operator can see WHY telemetry is on/off (env override is opaque
  // unless we tell them). PRINCIPLES.md #2 (consent-first telemetry).
  const consent = await getEffectiveTelemetryState(orgId)

  // Consent log (append-only per Principle 6) — the audit trail of every
  // state change since the install was created.
  const consentLog = await query<{
    id: string
    user_id: string | null
    action: string
    source: string
    prev_state: string
    new_state: string
    reason: string | null
    created_at: string
  }>(
    `SELECT id, user_id, action, source, prev_state, new_state, reason, created_at
       FROM telemetry_consent_log
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [orgId],
  )

  // Literal next-send payload preview, license key redacted to first 8
  // chars. Matches the wire format the heartbeat sender would post if it
  // fired right now. Operator audits the install — sees the same thing
  // the control plane would see.
  const previewPayload = org?.instance_id && org?.license_key
    ? buildInstallPing(
        org.instance_id,
        org.license_key.length > 8
          ? `${org.license_key.slice(0, 8)}...`
          : org.license_key,
      )
    : null

  return NextResponse.json({
    instance_id: org?.instance_id || null,
    license_key: org?.license_key || null,
    telemetry_tier: org?.telemetry_tier ?? 0,
    consent: {
      effective: consent.effective,
      source: consent.source,
      db_value: consent.dbValue,
    },
    consent_log: consentLog,
    preview_payload: previewPayload,
    log: logResult,
  })
}

/**
 * PATCH /api/settings/telemetry
 * Update tier (0/1/2) and/or master enabled flag. Either or both fields
 * MAY be in the body. Enabled is the master kill-switch (false →
 * suppress every send). Tier is the level-of-detail knob that only
 * applies when enabled.
 */
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit M1): changing org telemetry settings is admin-only.
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const tier = body.telemetry_tier
  const enabled = body.telemetry_enabled

  // Tier update (optional)
  if (tier !== undefined) {
    if (typeof tier !== 'number' || tier < 0 || tier > 2) {
      return NextResponse.json({ error: 'Invalid tier. Must be 0, 1, or 2.' }, { status: 400 })
    }
    await setTelemetryTier(orgId, tier)
    logAudit({
      orgId, userId, action: 'telemetry_updated', actionCategory: 'settings',
      entityType: 'settings', entityName: 'telemetry_tier',
      newValues: { telemetry_tier: tier },
      actorIp: getClientIp(request.headers),
    })
  }

  // Master kill-switch update (optional). Writes to telemetry_settings
  // AND appends a telemetry_consent_log row in one transaction. The log
  // is append-only per PRINCIPLES.md #6.
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'telemetry_enabled must be boolean' }, { status: 400 })
    }
    await setTelemetryEnabled(
      orgId,
      enabled,
      userId,
      'settings_ui',
      enabled
        ? 'Enabled via portal settings tile.'
        : 'Disabled via portal settings tile.',
    )
    logAudit({
      orgId, userId, action: 'telemetry_consent_changed', actionCategory: 'settings',
      entityType: 'settings', entityName: 'telemetry_enabled',
      newValues: { telemetry_enabled: enabled },
      actorIp: getClientIp(request.headers),
    })
  }

  // Return the resolved effective state so the UI can refresh its badge
  // without a follow-up GET.
  const consent = await getEffectiveTelemetryState(orgId)

  return NextResponse.json({
    success: true,
    telemetry_tier: tier !== undefined ? tier : undefined,
    telemetry_enabled: enabled !== undefined ? enabled : undefined,
    consent: {
      effective: consent.effective,
      source: consent.source,
      db_value: consent.dbValue,
    },
  })
}
