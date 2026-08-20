import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/tickets/[id]/history
 * Fetch the field-level change history for a ticket, merged with replies by timestamp.
 * Used for the "History" tab on the ticket detail page (SOC2 CC8.1 evidence).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const orgId = await getOrgId()

    // Verify ticket exists and belongs to this org
    const ticketCheck = await pool.query(
      'SELECT id FROM tickets WHERE id = $1 AND organization_id = $2',
      [ticketId, orgId]
    )
    if (ticketCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Fetch field changes with actor names
    const changesResult = await pool.query(`
      SELECT
        tfc.id,
        'field_change' as event_type,
        tfc.field_name,
        tfc.old_value,
        tfc.new_value,
        tfc.change_source,
        tfc.change_reason,
        tfc.created_at,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), ba.name, 'System') as actor_name,
        u.email as actor_email,
        -- An MSP-driven change has changed_by NULL (the actor is external), so
        -- the COALESCE above resolved to the literal 'System'. That is not just
        -- unhelpful, it is WRONG: a person at a paired firm did this, and the
        -- seeded KB article promises the customer can see who. change_source is
        -- a structured discriminator ('msp' | 'user'), so switch on it rather
        -- than inferring from a NULL.
        (CASE
           WHEN tfc.change_source = 'msp' THEN 'msp'
           WHEN tfc.changed_by IS NOT NULL THEN 'staff'
           ELSE 'system'
         END) as actor_type
      FROM ticket_field_changes tfc
      LEFT JOIN users u ON tfc.changed_by = u.id
      LEFT JOIN "user" ba ON tfc.changed_by::text = ba.id
      WHERE tfc.ticket_id = $1 AND tfc.organization_id = $2
      ORDER BY tfc.created_at DESC
    `, [ticketId, orgId])

    // Resolve human-readable names for status_id, category_id, assigned_to changes
    const fieldEvents = await Promise.all(changesResult.rows.map(async (row) => {
      const event: Record<string, unknown> = { ...row }

      // Surface the individual technician behind an MSP change.
      //
      // ticket_field_changes carries no msp_actor_email / via_pairing_key_id
      // (unlike ticket_replies), so the only record of WHO is the free-text
      // change_reason the write path stamps: "via MTP pairing by <email> (REF)".
      // Parsing that is a fallback, not a design — the durable fix is to mirror
      // ticket_replies and add structured actor columns to this table. Until
      // then this degrades honestly: if the shape does not match we say "MSP"
      // rather than inventing a name, and we never say "System" for an MSP act.
      if (row.actor_type === 'msp') {
        const tech = /via MTP pairing by\s+(\S+?@\S+?)\s*(?:\(|$)/i.exec(row.change_reason || '')
        event.msp = { technician_email: tech ? tech[1] : null }
        event.actor_name = tech ? tech[1] : 'MSP'
      }

      if (row.field_name === 'status_id') {
        if (row.old_value) {
          const old = await pool.query('SELECT name FROM ticket_statuses WHERE id = $1', [row.old_value])
          event.old_display = old.rows[0]?.name || row.old_value
        }
        if (row.new_value) {
          const nw = await pool.query('SELECT name FROM ticket_statuses WHERE id = $1', [row.new_value])
          event.new_display = nw.rows[0]?.name || row.new_value
        }
      } else if (row.field_name === 'category_id') {
        if (row.old_value) {
          const old = await pool.query('SELECT name FROM ticket_categories WHERE id = $1', [row.old_value])
          event.old_display = old.rows[0]?.name || row.old_value
        }
        if (row.new_value) {
          const nw = await pool.query('SELECT name FROM ticket_categories WHERE id = $1', [row.new_value])
          event.new_display = nw.rows[0]?.name || row.new_value
        }
      } else if (row.field_name === 'assigned_to') {
        if (row.old_value) {
          const old = await pool.query("SELECT CONCAT(first_name, ' ', last_name) as name FROM users WHERE id = $1", [row.old_value])
          event.old_display = old.rows[0]?.name || row.old_value
        }
        if (row.new_value) {
          const nw = await pool.query("SELECT CONCAT(first_name, ' ', last_name) as name FROM users WHERE id = $1", [row.new_value])
          event.new_display = nw.rows[0]?.name || row.new_value
        }
      }

      return event
    }))

    // Fetch replies as history events
    const repliesResult = await pool.query(`
      SELECT
        tr.id,
        'reply' as event_type,
        'reply' as field_name,
        NULL as old_value,
        NULL as new_value,
        'user' as change_source,
        tr.created_at,
        tr.is_internal,
        COALESCE(
          CONCAT(u.first_name, ' ', u.last_name),
          CONCAT(c.first_name, ' ', c.last_name),
          'Unknown'
        ) as actor_name
      FROM ticket_replies tr
      LEFT JOIN users u ON tr.user_id = u.id
      LEFT JOIN contacts c ON tr.contact_id = c.id
      WHERE tr.ticket_id = $1
      ORDER BY tr.created_at DESC
    `, [ticketId])

    const replyEvents = repliesResult.rows.map(r => ({
      ...r,
      new_display: r.is_internal ? 'Internal note added' : 'Reply added',
    }))

    // Merge and sort by created_at descending
    const events = [...fieldEvents, ...replyEvents].sort(
      (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    )

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching ticket history:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket history' }, { status: 500 })
  }
}
