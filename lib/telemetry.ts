/**
 * Transparent Telemetry System
 *
 * Three tiers of anonymous telemetry:
 *   Tier 0 (always):  Install ping — {instance_id, version, installed_at}
 *   Tier 1 (opt-in):  Setup snapshot — {industry, team_size, use_case, features}
 *   Tier 2 (opt-in):  Usage heartbeat — {module_counts, feature_adoption, ranges}
 *
 * Core promises:
 *   - No PII ever (no emails, names, IPs, org names, domains)
 *   - Every payload logged to telemetry_log before sending
 *   - Users can view full log in Settings > Telemetry
 *   - Documented contract in README
 */

import { pool, query, queryOne } from '@/lib/db'
import { randomBytes } from 'crypto'
import { getEffectiveTelemetryState } from '@/lib/telemetry-consent'

// Default points at the ObiLabs control plane (apps/web). Self-hosters
// who want telemetry to land on their own apps/web instance (or want to
// disable telemetry entirely) override via the TELEMETRY_URL env var.
// The previous default (`https://telemetry.aegis.app/...`) was a non-
// resolving hostname — every Tier 0 install ping silently failed because
// DNS lookup never succeeded. Discovered + documented in the 2026-05-13
// session prep for the email-first-class spec audit.
const TELEMETRY_URL = process.env.TELEMETRY_URL || 'https://api.obilabs.dev/api/instances/heartbeat'
const APP_VERSION = process.env.npm_package_version || process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

// ---------------------------------------------------------------------------
// Instance ID
// ---------------------------------------------------------------------------

/**
 * Generate a new anonymous instance ID.
 * Format: Aegis_{24 hex chars} — not derived from any org/user data.
 */
export function generateInstanceId(): string {
  return `Aegis_${randomBytes(12).toString('hex')}`
}

/**
 * Generate a human-readable license key.
 * Format: AEGIS-XXXX-XXXX-XXXX-XXXX (uppercase alphanumeric, no ambiguous chars)
 * Users can enter this on the web portal to claim their instance
 * for support, commercial features, or community recognition.
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
  const segments: string[] = []
  for (let s = 0; s < 4; s++) {
    let segment = ''
    const bytes = randomBytes(4)
    for (let i = 0; i < 4; i++) {
      segment += chars[bytes[i] % chars.length]
    }
    segments.push(segment)
  }
  return `AEGIS-${segments.join('-')}`
}

/**
 * Get or create the instance ID for an organization.
 */
export async function getInstanceId(organizationId: string): Promise<string> {
  const org = await queryOne<{ instance_id: string | null }>(
    'SELECT instance_id FROM organizations WHERE id = $1',
    [organizationId]
  )

  if (org?.instance_id) return org.instance_id

  const instanceId = generateInstanceId()
  await query(
    'UPDATE organizations SET instance_id = $1 WHERE id = $2',
    [instanceId, organizationId]
  )
  return instanceId
}

// ---------------------------------------------------------------------------
// Payload Builders (no PII)
// ---------------------------------------------------------------------------

/** Tier 0: Install ping (sent once) */
export function buildInstallPing(instanceId: string, licenseKey: string): Record<string, unknown> {
  return {
    instance_id: instanceId,
    version: APP_VERSION,
    license_key: licenseKey,
    installed_at: new Date().toISOString(),
  }
}

/** Tier 1: One-time setup snapshot */
export function buildSetupSnapshot(
  instanceId: string,
  setupData: {
    industry?: string
    team_size?: string
    primary_use_case?: string
    features?: Record<string, boolean>
  }
): Record<string, unknown> {
  return {
    instance_id: instanceId,
    version: APP_VERSION,
    metrics: {
      industry: setupData.industry || 'unknown',
      team_size: setupData.team_size || 'unknown',
      primary_use_case: setupData.primary_use_case || 'unknown',
      features_enabled: Object.entries(setupData.features || {})
        .filter(([, v]) => v)
        .map(([k]) => k),
    },
  }
}

/** Tier 2: Periodic usage heartbeat */
export async function buildUsageHeartbeat(
  instanceId: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  // Collect anonymous aggregate metrics — ranges only, no PII
  const [ticketStats, userRange, moduleUsage] = await Promise.all([
    queryOne<{ total: string; open: string; closed_7d: string }>(
      `SELECT
         COUNT(*)::text as total,
         COUNT(*) FILTER (WHERE ts.base_status = 'open')::text as open,
         COUNT(*) FILTER (WHERE ts.base_status = 'closed'
           AND t.updated_at > NOW() - INTERVAL '7 days')::text as closed_7d
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.organization_id = $1`,
      [organizationId]
    ),
    queryOne<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM users WHERE organization_id = $1 AND status = \'active\'',
      [organizationId]
    ),
    query<{ name: string; count: string }>(
      `SELECT tc.name, COUNT(*)::text as count
       FROM tickets t
       JOIN ticket_categories tc ON t.category_id = tc.id
       WHERE t.organization_id = $1
       GROUP BY tc.name`,
      [organizationId]
    ),
  ])

  const userCount = parseInt(userRange?.count || '0', 10)
  const userCountRange = userCount <= 5 ? '1-5'
    : userCount <= 20 ? '6-20'
    : userCount <= 50 ? '21-50'
    : userCount <= 200 ? '51-200'
    : '200+'

  return {
    instance_id: instanceId,
    version: APP_VERSION,
    metrics: {
      user_count_range: userCountRange,
      ticket_volume: {
        total_range: toRange(parseInt(ticketStats?.total || '0', 10)),
        open: parseInt(ticketStats?.open || '0', 10),
        closed_7d: parseInt(ticketStats?.closed_7d || '0', 10),
      },
      modules_enabled: moduleUsage
        ? moduleUsage.map((r) => r.name)
        : [],
      uptime_hours: Math.floor(process.uptime() / 3600),
    },
  }
}

function toRange(n: number): string {
  if (n === 0) return '0'
  if (n <= 10) return '1-10'
  if (n <= 50) return '11-50'
  if (n <= 100) return '51-100'
  if (n <= 500) return '101-500'
  if (n <= 1000) return '501-1000'
  return '1000+'
}

// ---------------------------------------------------------------------------
// Send + Log
// ---------------------------------------------------------------------------

/**
 * Log a telemetry payload to the audit table, then attempt to send it.
 * Returns the log entry ID.
 */
export async function sendTelemetry(
  organizationId: string,
  tier: number,
  eventType: string,
  payload: Record<string, unknown>
): Promise<string> {
  // 0. Consent gate (PRINCIPLES.md #2). Master kill-switch from
  //    telemetry_settings + TELEMETRY_ENABLED env var. Runs BEFORE the
  //    audit-log insert so a suppressed send leaves no trace — the log
  //    is meant to record what was attempted to be sent, not what was
  //    consent-blocked from being attempted in the first place. (The
  //    consent decision itself lives in telemetry_consent_log.)
  const consent = await getEffectiveTelemetryState(organizationId)
  if (consent.effective === 'off') {
    return `suppressed-by-consent:${consent.source}`
  }

  // 1. Log the payload BEFORE sending (audit trail)
  const logEntry = await queryOne<{ id: string }>(
    `INSERT INTO telemetry_log (organization_id, tier, event_type, payload, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [organizationId, tier, eventType, JSON.stringify(payload)]
  )
  const logId = logEntry!.id

  // 2. Attempt to send
  try {
    const res = await fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aegis-API-Version': '2',
        'X-Aegis-Tier': String(tier),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    })

    await query(
      `UPDATE telemetry_log SET status = $1, response_code = $2, sent_at = NOW()
       WHERE id = $3`,
      [res.ok ? 'sent' : 'failed', res.status, logId]
    )
  } catch (err) {
    // Network failure — log it, don't throw
    const message = err instanceof Error ? err.message : 'Unknown error'
    await query(
      `UPDATE telemetry_log SET status = 'failed', error_message = $1, sent_at = NOW()
       WHERE id = $2`,
      [message, logId]
    )
    console.error(`[Telemetry] Send failed (tier ${tier}):`, message)
  }

  return logId
}

// ---------------------------------------------------------------------------
// High-Level Actions
// ---------------------------------------------------------------------------

/** Send the Tier 0 install ping (called from setup/complete) */
export async function sendInstallPing(organizationId: string): Promise<void> {
  const org = await queryOne<{ instance_id: string; license_key: string }>(
    'SELECT instance_id, license_key FROM organizations WHERE id = $1',
    [organizationId]
  )
  if (!org?.instance_id || !org?.license_key) return
  const payload = buildInstallPing(org.instance_id, org.license_key)
  await sendTelemetry(organizationId, 0, 'install_ping', payload)
}

/** Send the Tier 1 setup snapshot (called from setup/complete if tier >= 1) */
export async function sendSetupSnapshot(
  organizationId: string,
  setupData: {
    industry?: string
    team_size?: string
    primary_use_case?: string
    features?: Record<string, boolean>
  }
): Promise<void> {
  const instanceId = await getInstanceId(organizationId)
  const payload = buildSetupSnapshot(instanceId, setupData)
  await sendTelemetry(organizationId, 1, 'setup_snapshot', payload)
}

/** Send the Tier 2 usage heartbeat (called by pg-boss job) */
export async function sendUsageHeartbeat(organizationId: string): Promise<void> {
  const instanceId = await getInstanceId(organizationId)
  const payload = await buildUsageHeartbeat(instanceId, organizationId)
  await sendTelemetry(organizationId, 2, 'usage_heartbeat', payload)
}

/** Get the telemetry tier for an organization */
export async function getTelemetryTier(organizationId: string): Promise<number> {
  const org = await queryOne<{ telemetry_tier: number }>(
    'SELECT telemetry_tier FROM organizations WHERE id = $1',
    [organizationId]
  )
  return org?.telemetry_tier ?? 0
}

/** Update the telemetry tier */
export async function setTelemetryTier(organizationId: string, tier: number): Promise<void> {
  if (tier < 0 || tier > 2) throw new Error('Invalid telemetry tier')
  await query(
    'UPDATE organizations SET telemetry_tier = $1 WHERE id = $2',
    [tier, organizationId]
  )
}
