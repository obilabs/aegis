import { pool } from '@/lib/db'
import { requireTicketAccess } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

// Apply a checklist template to a ticket — copies template items as ticket tasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { userId, orgId } = ctx

    const { id: ticketId } = await params
    const guard = await requireTicketAccess(request, ticketId, { staffOnly: true })
    if (guard instanceof NextResponse) return guard
    const body = await request.json()

    if (!body.template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
    }

    // Fetch template items
    const itemsResult = await pool.query(`
      SELECT title, description, sort_order, is_required, service_category,
             default_assignee_type, default_assignee_id
      FROM checklist_template_items
      WHERE template_id = $1 AND organization_id = $2
      ORDER BY sort_order ASC
    `, [body.template_id, orgId])

    if (itemsResult.rows.length === 0) {
      return NextResponse.json({ error: 'Template has no items' }, { status: 400 })
    }

    // Get ticket's assigned_to for 'ticket_assignee' type
    const ticketResult = await pool.query(
      `SELECT assigned_to FROM tickets WHERE id = $1`,
      [ticketId]
    )
    const ticketAssignee = ticketResult.rows[0]?.assigned_to || null

    // Get current max sort order for existing tasks on this ticket
    const maxSort = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM ticket_tasks WHERE ticket_id = $1`,
      [ticketId]
    )
    let sortOffset = maxSort.rows[0].next_order

    // Insert each template item as a ticket task
    const created: any[] = []
    for (const item of itemsResult.rows) {
      let assignedTo = null
      if (item.default_assignee_type === 'ticket_assignee') {
        assignedTo = ticketAssignee
      } else if (item.default_assignee_type === 'specific' && item.default_assignee_id) {
        assignedTo = item.default_assignee_id
      }

      const result = await pool.query(`
        INSERT INTO ticket_tasks (
          ticket_id, organization_id, title, description, sort_order,
          is_required, assigned_to, service_category, template_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, title, is_required, is_completed, sort_order, assigned_to, service_category
      `, [
        ticketId, orgId, item.title, item.description, sortOffset++,
        item.is_required, assignedTo, item.service_category,
        body.template_id, userId,
      ])

      created.push(result.rows[0])
    }

    return NextResponse.json({ tasks: created, count: created.length }, { status: 201 })
  } catch (error) {
    console.error('Error applying template:', error)
    return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 })
  }
}
