import { pool } from '@/lib/db'
import { requireTicketAccess } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { orgId } = ctx

    const { id } = await params
    const guard = await requireTicketAccess(request, id)
    if (guard instanceof NextResponse) return guard

    const result = await pool.query(`
      SELECT
        tt.id,
        tt.title,
        tt.is_completed,
        tt.completed_at,
        tt.sort_order,
        tt.created_at,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(cbu.first_name, ' ', cbu.last_name) as completed_by_name
      FROM ticket_tasks tt
      LEFT JOIN users cu ON tt.created_by = cu.id
      LEFT JOIN users cbu ON tt.completed_by = cbu.id
      WHERE tt.ticket_id = $1 AND tt.organization_id = $2
      ORDER BY tt.sort_order ASC, tt.created_at ASC
    `, [id, orgId])

    return NextResponse.json({ tasks: result.rows })
  } catch (error) {
    console.error('Error fetching ticket tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { userId, orgId } = ctx

    const { id } = await params
    const guard = await requireTicketAccess(request, id, { staffOnly: true })
    if (guard instanceof NextResponse) return guard
    const body = await request.json()

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Get next sort order
    const maxSort = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
       FROM ticket_tasks WHERE ticket_id = $1`,
      [id]
    )

    const result = await pool.query(`
      INSERT INTO ticket_tasks (ticket_id, organization_id, title, sort_order, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, is_completed, completed_at, sort_order, created_at
    `, [id, orgId, body.title.trim(), maxSort.rows[0].next_order, userId])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating ticket task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
