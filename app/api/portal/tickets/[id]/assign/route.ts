import { auth } from '@/lib/auth'
import { pool, queryOne } from '@/lib/db'
import { logTicketFieldChange } from '@/lib/ticket-audit'
import { hasCapability } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const AssignSchema = z.object({
  assigned_to: z.string().uuid().nullable(),
  assigned_team: z.string().uuid().nullable().optional(),
})

/**
 * PATCH /api/portal/tickets/[id]/assign
 *
 * Assign or reassign a ticket. Requires triage capability.
 * Auto-transitions New → Open on assignment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const itsmUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canTriage = await hasCapability(itsmUser.id, 'triage')
    if (!canTriage) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = AssignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { assigned_to, assigned_team } = parsed.data

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
       WHERE t.id = $1`,
      [id]
    )

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Build updates
    const updates: string[] = ['assigned_to = $1', 'updated_at = NOW()']
    const values: any[] = [assigned_to]
    let paramIdx = 2

    if (assigned_team !== undefined) {
      updates.push(`assigned_team = $${paramIdx++}`)
      values.push(assigned_team)
    }

    // Auto-transition New → Open
    let transitioned = false
    if (assigned_to && ticket.is_default && ticket.status_name === 'New') {
      const openStatus = await queryOne<{ id: string }>(
        `SELECT id FROM ticket_statuses
         WHERE organization_id = $1 AND name = 'Open' LIMIT 1`,
        [ticket.organization_id]
      )
      if (openStatus) {
        updates.push(`status_id = $${paramIdx++}`)
        values.push(openStatus.id)
        transitioned = true

        // Log status transition
        await pool.query(
          `INSERT INTO ticket_status_history
           (ticket_id, from_status_id, to_status_id, changed_by, reason,
            sla_paused_seconds_at_change, sla_was_paused)
           VALUES ($1, $2, $3, $4, 'Auto-transitioned on assignment',
            COALESCE((SELECT sla_total_paused_seconds FROM tickets WHERE id = $1), 0),
            (SELECT sla_paused_at IS NOT NULL FROM tickets WHERE id = $1))`,
          [id, ticket.status_id, openStatus.id, itsmUser.id]
        )
      }
    }

    values.push(id)
    await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    )

    // Also record to ticket_field_changes — the table the History tab reads.
    //
    // This route already logged to `ticket_history` below, but NOTHING reads
    // that table: /api/portal/tickets/[id]/history selects from
    // ticket_field_changes and ticket_replies only. There are three history
    // tables in this schema (ticket_field_changes, ticket_history,
    // ticket_status_history) and the UI reads one of them, so an assignment was
    // recorded somewhere nobody looks — indistinguishable, from the user's side,
    // from not being recorded at all.
    //
    // Consolidating the three is the durable fix and is deliberately not
    // attempted here; this makes the assignment visible where the product
    // already claims to show it.
    try {
      await logTicketFieldChange(
        ticket.organization_id, id, 'assigned_to',
        ticket.assigned_to, assigned_to ?? null, itsmUser.id, 'user',
        assigned_to ? 'Assigned' : 'Unassigned'
      )
    } catch (auditError) {
      console.error('Assign succeeded but history write failed:', auditError)
    }

    // Log assignment in ticket_history
    await pool.query(
      `INSERT INTO ticket_history (ticket_id, user_id, action, details)
       VALUES ($1, $2, 'assignment', $3)
       ON CONFLICT DO NOTHING`,
      [
        id,
        itsmUser.id,
        JSON.stringify({
          from: ticket.assigned_to,
          to: assigned_to,
          team: assigned_team ?? null,
        }),
      ]
    ).catch(() => {})

    // Re-score after assignment change
    try {
      const { queueTriageJob } = await import('@/lib/triage-worker')
      await queueTriageJob(id, ticket.organization_id, 'manual')
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, transitioned })
  } catch (error) {
    console.error('Error assigning ticket:', error)
    return NextResponse.json({ error: 'Failed to assign ticket' }, { status: 500 })
  }
}
