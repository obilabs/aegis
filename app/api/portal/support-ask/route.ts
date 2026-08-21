/**
 * GET /api/portal/support-ask — should we ask this person to support the project?
 *
 * WHY THIS EXISTS
 * ---------------
 * The "Support the project →" link lived in VendorFooter, which is mounted in
 * app/portal/layout.tsx. That meant it rendered on EVERY portal page for EVERY
 * signed-in user, gated only on NEXT_PUBLIC_VENDOR_URL being set — so the people
 * who had already donated were still being asked, on every page, forever. That is
 * the worst possible audience for an ask.
 *
 * The signal to stop asking already existed: the licence heartbeat carries
 * `plan`, which can be 'donor'. `getLicensePlan()` is documented as
 * "display/attribution only, NEVER gating" — using it to decide whether to render
 * a link is display, so it stays inside that contract. Nothing here gates a
 * feature, and a stale or unknown plan simply means we do not ask.
 *
 * THE DECISION LIVES HERE, NOT IN THE COMPONENT.
 * The plan is server-side state and the role check needs the database, so the
 * component stays dumb: it renders what this says.
 *
 * NOTE ON GRANULARITY: a licence plan is per-INSTALL, not per-person. This can
 * tell you "this organisation supports the project", never "this admin does".
 * Good enough to stop asking; not enough to personalise beyond the org.
 */

import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { getLicensePlan } from '@/lib/license-heartbeat'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Don't ask until the product has actually done something.
 *
 * Tying the ask to VALUE DELIVERED rather than to a timer is the whole point: a
 * clock is just nagging, whereas "this handled 240 tickets for you" is a fair
 * moment to ask. An install that has resolved nothing has not earned the right
 * to ask for anything.
 */
const MIN_RESOLVED_TICKETS = 25
const MIN_INSTALL_DAYS = 30

/** How long the client should stay quiet after showing it. One quarter. */
const COOLDOWN_DAYS = 90

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ show: false, reason: 'unauthenticated' })

    // Non-admins can never act on this. Asking an end user who is filing a
    // ticket to fund the vendor is pure noise, and it makes the product feel
    // like shareware at the exact moment someone needs help.
    if (!(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
      return NextResponse.json({ show: false, reason: 'not-an-admin' })
    }

    const plan = getLicensePlan()
    if (plan === 'donor') {
      // Already supporting. Say thank you; never ask again while it is current.
      return NextResponse.json({ show: false, reason: 'current-donor', plan })
    }

    const orgId = ctx.orgId

    const stats = await pool.query<{ resolved: string; install_age_days: string }>(
      `SELECT
         (SELECT COUNT(*) FROM tickets t
            JOIN ticket_statuses ts ON ts.id = t.status_id
           WHERE t.organization_id = $1 AND ts.mapped_state = 'closed')::text AS resolved,
         (SELECT EXTRACT(DAY FROM NOW() - MIN(created_at)) FROM organizations
           WHERE id = $1)::text AS install_age_days`,
      [orgId],
    )

    const resolved = Number(stats.rows[0]?.resolved ?? 0)
    const ageDays = Number(stats.rows[0]?.install_age_days ?? 0)

    if (resolved < MIN_RESOLVED_TICKETS && ageDays < MIN_INSTALL_DAYS) {
      return NextResponse.json({
        show: false,
        reason: 'not-enough-value-delivered',
        resolved,
        ageDays,
      })
    }

    // A previous supporter whose licence is no longer 'donor'. Do NOT resume the
    // cold ask — treating a past supporter like a stranger is what stops them
    // giving again. Acknowledge first, then ask.
    //
    // Read from settings->'supporter', written by the licence heartbeat whenever
    // it sees a donor plan. This branch was originally written against a
    // `last_plan` column that does not exist, so it could never have fired —
    // dead code that looks like a feature.
    const supporter = await pool.query<{ last_donor_at: string | null }>(
      `SELECT settings->'supporter'->>'last_donor_at' AS last_donor_at
         FROM organizations WHERE id = $1`,
      [orgId],
    )
    const wasDonor = Boolean(supporter.rows[0]?.last_donor_at)

    return NextResponse.json({
      show: true,
      tone: wasDonor ? 'returning' : 'first',
      resolved,
      ageDays,
      cooldownDays: COOLDOWN_DAYS,
      // Copy lives here so it can change without a rebuild of every consumer.
      message: wasDonor
        ? 'You have supported ObiLabs before — thank you. If Aegis is still ' +
          'useful, please continue to support us to keep making it better.'
        : `Aegis has resolved ${resolved} tickets for you. If it is useful, ` +
          'please support us to keep making Aegis better.',
    })
  } catch (error) {
    // Never let this break a page. An ask that 500s is worse than no ask.
    console.error('support-ask check failed:', error)
    return NextResponse.json({ show: false, reason: 'error' })
  }
}
