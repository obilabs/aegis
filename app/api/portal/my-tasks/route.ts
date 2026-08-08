import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

// My Tasks: all ticket tasks assigned to the current user across all tickets
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx
    const includeCompleted = request.nextUrl.searchParams.get('completed') === 'true'

    const result = await pool.query(`
      SELECT
        tt.id,
        tt.title,
        tt.description,
        tt.is_completed,
        tt.is_required,
        tt.completed_at,
        tt.service_category,
        tt.created_at,
        -- Ticket info
        t.id as ticket_id,
        t.ticket_number,
        t.prefix,
        t.subject as ticket_subject,
        ts.name as ticket_status,
        ts.color as ticket_status_color,
        t.priority as ticket_priority
      FROM ticket_tasks tt
      JOIN tickets t ON tt.ticket_id = t.id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE tt.assigned_to = $1
        AND tt.organization_id = $2
        ${includeCompleted ? '' : 'AND tt.is_completed = false'}
      ORDER BY
        tt.is_completed ASC,
        CASE t.priority
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5
        END,
        tt.created_at ASC
    `, [userId, orgId])

    return NextResponse.json({ tasks: result.rows })
  } catch (error) {
    console.error('Error fetching my tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}
