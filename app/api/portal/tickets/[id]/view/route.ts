import { auth } from '@/lib/auth'
import { requireTicketAccess } from '@/lib/access'
import { pool, queryOne } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/portal/tickets/[id]/view
 *
 * Records that a user has viewed a ticket. On first view by any staff user:
 * - Sets first_viewed_at and first_viewed_by on the ticket
 * - If the ticket is in "New" status, auto-transitions to "Open"
 * - Logs the status change in ticket_status_history
 *
 * This is called fire-and-forget from the ticket detail page.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const guard = await requireTicketAccess(request, id, { staffOnly: true })
    if (guard instanceof NextResponse) return guard

    // Get the ITSM user id (not the auth user id)
    const itsmUser = await queryOne<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )

    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Set first_viewed_at if not already set
    await pool.query(
      `UPDATE tickets
       SET first_viewed_at = COALESCE(first_viewed_at, NOW()),
           first_viewed_by = COALESCE(first_viewed_by, $1)
       WHERE id = $2 AND organization_id = $3`,
      [itsmUser.id, id, itsmUser.organization_id]
    )

    // Check if ticket is in "New" status (is_default = true)
    const ticket = await queryOne<{
      status_id: string
      status_name: string
      is_default: boolean
      organization_id: string
    }>(
      `SELECT t.status_id, ts.name as status_name, ts.is_default, t.organization_id
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.id = $1 AND t.organization_id = $2`,
      [id, itsmUser.organization_id]
    )

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Auto-transition: New → Open
    if (ticket.is_default && ticket.status_name === 'New') {
      const openStatus = await queryOne<{ id: string }>(
        `SELECT id FROM ticket_statuses
         WHERE organization_id = $1 AND name = 'Open'
         LIMIT 1`,
        [ticket.organization_id]
      )

      if (openStatus) {
        // Update ticket status (the DB trigger handles SLA tracking)
        await pool.query(
          `UPDATE tickets SET status_id = $1, updated_at = NOW() WHERE id = $2`,
          [openStatus.id, id]
        )

        // Log status change in history
        await pool.query(
          `INSERT INTO ticket_status_history
           (ticket_id, from_status_id, to_status_id, changed_by, reason,
            sla_paused_seconds_at_change, sla_was_paused)
           VALUES ($1, $2, $3, $4, 'Auto-transitioned on first view',
            COALESCE((SELECT sla_total_paused_seconds FROM tickets WHERE id = $1), 0),
            (SELECT sla_paused_at IS NOT NULL FROM tickets WHERE id = $1))`,
          [id, ticket.status_id, openStatus.id, itsmUser.id]
        )

        // Also log in ticket_history if that table exists
        await pool.query(
          `INSERT INTO ticket_history (ticket_id, user_id, action, details)
           VALUES ($1, $2, 'status_change', $3)
           ON CONFLICT DO NOTHING`,
          [id, itsmUser.id, JSON.stringify({
            from: 'New',
            to: 'Open',
            reason: 'Auto-transitioned on first view',
          })]
        ).catch(() => {
          // ticket_history may not exist — non-critical
        })

        // Queue triage re-score after status transition (non-blocking)
        try {
          const { queueTriageJob } = await import('@/lib/triage-worker')
          await queueTriageJob(id, ticket.organization_id, 'agent_viewed')
        } catch {
          // Triage queue failure shouldn't block view recording
        }

        return NextResponse.json({ viewed: true, transitioned: true, newStatus: 'Open' })
      }
    }

    // Queue triage on first view even without status transition (non-blocking)
    try {
      const { queueTriageJob } = await import('@/lib/triage-worker')
      await queueTriageJob(id, ticket.organization_id, 'agent_viewed')
    } catch {
      // Triage queue failure shouldn't block view recording
    }

    return NextResponse.json({ viewed: true, transitioned: false })
  } catch (error) {
    console.error('Error recording ticket view:', error)
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
