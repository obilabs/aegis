import { pool, queryOne } from '@/lib/db'
import { requireTicketAccess } from '@/lib/access'
import { logTicketFieldChange } from '@/lib/ticket-audit'
import { getAuthContext } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/portal/tickets/[id]/claim
 *
 * One-click self-assignment. Assigns ticket to the current user.
 * Auto-transitions New -> Open.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { session, userId, orgId } = ctx
    const { id: ticketId } = await params
    const guard = await requireTicketAccess(request, ticketId, { staffOnly: true })
    if (guard instanceof NextResponse) return guard

    // Look up the ITSM user
    const itsmUser = await queryOne<{ id: string; first_name: string; last_name: string }>(
      `SELECT id, first_name, last_name FROM users WHERE organization_id = $1 AND email = $2`,
      [orgId, session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get current ticket state
    const ticket = await queryOne<{
      organization_id: string
      status_id: string
      status_name: string
      is_default: boolean
      assigned_to: string | null
    }>(
      `SELECT t.organization_id, t.status_id, ts.name as status_name,
              ts.is_default, t.assigned_to
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.id = $1 AND t.organization_id = $2`,
      [ticketId, orgId]
    )

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.assigned_to) {
      return NextResponse.json({ error: 'Ticket is already assigned' }, { status: 409 })
    }

    // Assign to current user
    const updates = ['assigned_to = $1', 'updated_at = NOW()']
    const values: unknown[] = [itsmUser.id]
    let paramIdx = 2

    // Auto-transition New -> Open
    let transitioned = false
    if (ticket.is_default && ticket.status_name === 'New') {
      const openStatus = await queryOne<{ id: string }>(
        `SELECT id FROM ticket_statuses WHERE organization_id = $1 AND name = 'Open' LIMIT 1`,
        [orgId]
      )
      if (openStatus) {
        updates.push(`status_id = $${paramIdx++}`)
        values.push(openStatus.id)
        transitioned = true

        await pool.query(
          `INSERT INTO ticket_status_history
           (ticket_id, from_status_id, to_status_id, changed_by, reason,
            sla_paused_seconds_at_change, sla_was_paused)
           VALUES ($1, $2, $3, $4, 'Auto-transitioned on claim',
            COALESCE((SELECT sla_total_paused_seconds FROM tickets WHERE id = $1), 0),
            (SELECT sla_paused_at IS NOT NULL FROM tickets WHERE id = $1))`,
          [ticketId, ticket.status_id, openStatus.id, userId]
        )
      }
    }

    values.push(ticketId)
    await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    )

    // Record the assignment in ticket history.
    //
    // This route mutated `assigned_to` and wrote NOTHING to
    // ticket_field_changes, so claiming a ticket left no trace on the History
    // tab — the assignee changed and the audit trail stayed silent.
    //
    // The helper already existed, and its own docstring says "every field
    // mutation is tracked" for SOC2 CC8.1; only the main PATCH route called it.
    // Note the perverse result before this fix: an EXTERNAL MSP's changes WERE
    // recorded (lib/mtp-write.ts logs them) while the customer's own staff
    // actions were not.
    //
    // Non-blocking on purpose: a history write must never fail a claim the user
    // already sees as done. Logged loudly rather than swallowed.
    try {
      await logTicketFieldChange(
        orgId, ticketId, 'assigned_to',
        ticket.assigned_to, itsmUser.id, userId, 'user', 'Claimed ticket'
      )
      if (transitioned) {
        await logTicketFieldChange(
          orgId, ticketId, 'status_id',
          ticket.status_id, values[1] as string, userId, 'system',
          'Auto-transitioned on claim'
        )
      }
    } catch (auditError) {
      console.error('Claim succeeded but history write failed:', auditError)
    }

    // Re-score after claim
    try {
      const { queueTriageJob } = await import('@/lib/triage-worker')
      await queueTriageJob(ticketId, orgId, 'manual')
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      transitioned,
      assigned_to: {
        id: itsmUser.id,
        name: `${itsmUser.first_name} ${itsmUser.last_name}`.trim(),
      },
    })
  } catch (error) {
    console.error('Error claiming ticket:', error)
    return NextResponse.json({ error: 'Failed to claim ticket' }, { status: 500 })
  }
}
