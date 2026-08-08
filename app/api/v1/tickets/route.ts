import { requireScope } from '@/lib/require-scope'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await requireScope(request, 'tickets:read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)))
    const offset = (page - 1) * perPage
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const updatedSince = url.searchParams.get('updated_since')

    const conditions: string[] = ['t.organization_id = $1']
    const values: (string | number)[] = [ctx.orgId]
    let idx = 2

    if (status) {
      conditions.push(`ts.base_status = $${idx++}`)
      values.push(status)
    }
    if (priority) {
      conditions.push(`t.priority = $${idx++}`)
      values.push(priority)
    }
    if (updatedSince) {
      conditions.push(`t.updated_at >= $${idx++}`)
      values.push(updatedSince)
    }

    const where = conditions.join(' AND ')

    const [ticketsResult, countResult] = await Promise.all([
      pool.query(`
        SELECT
          t.id, t.ticket_number, t.prefix, t.subject, t.description,
          t.priority, t.source, t.created_at, t.updated_at, t.resolved_at,
          ts.name as status, ts.base_status,
          tc.name as category,
          CONCAT(c.first_name, ' ', c.last_name) as requester_name,
          c.email as requester_email,
          CONCAT(u.first_name, ' ', u.last_name) as assignee_name,
          u.email as assignee_email
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        LEFT JOIN contacts c ON t.contact_id = c.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE ${where}
        ORDER BY t.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `, [...values, perPage, offset]),
      pool.query(`
        SELECT COUNT(*)::int as total
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        WHERE ${where}
      `, values),
    ])

    return NextResponse.json({
      data: ticketsResult.rows,
      meta: {
        page,
        per_page: perPage,
        total: countResult.rows[0].total,
        total_pages: Math.ceil(countResult.rows[0].total / perPage),
      },
    })
  } catch (error) {
    console.error('v1 tickets GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireScope(request, 'tickets:write')
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await request.json()
    const { subject, description, priority, category, requester_email, source } = body

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'subject and description are required' },
        { status: 400 }
      )
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical']
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `priority must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      )
    }

    // Look up category
    let categoryId = null
    if (category) {
      const catResult = await pool.query(
        'SELECT id FROM ticket_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
        [ctx.orgId, category]
      )
      categoryId = catResult.rows[0]?.id || null
    }

    // Get default status
    const statusResult = await pool.query(
      'SELECT id FROM ticket_statuses WHERE organization_id = $1 AND is_default = true LIMIT 1',
      [ctx.orgId]
    )
    const statusId = statusResult.rows[0]?.id || null

    // Look up contact by email
    let contactId = null
    if (requester_email) {
      const contactResult = await pool.query(
        'SELECT id FROM contacts WHERE organization_id = $1 AND email = $2',
        [ctx.orgId, requester_email]
      )
      contactId = contactResult.rows[0]?.id || null
    }

    const result = await pool.query(`
      INSERT INTO tickets (
        organization_id, subject, description, priority,
        status_id, category_id, contact_id, created_by, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, ticket_number, prefix, created_at
    `, [
      ctx.orgId, subject, description, priority || 'medium',
      statusId, categoryId, contactId, ctx.userId,
      source || 'api',
    ])

    const ticket = result.rows[0]
    return NextResponse.json({
      data: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        prefix: ticket.prefix,
        reference: `${ticket.prefix}-${ticket.ticket_number}`,
        created_at: ticket.created_at,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('v1 tickets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
