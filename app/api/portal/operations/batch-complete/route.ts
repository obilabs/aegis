import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx

    // Authorization (audit 2026-07-23): batch-completing tickets is a
    // triage/bulk action. Without this any authenticated user could complete
    // arbitrary tickets by id.
    if (!(await hasCapabilityOrAdmin(userId, 'triage'))) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const body = await request.json()

    const { task_ids } = body

    // Validate task_ids is a non-empty array
    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json({ error: 'task_ids must be a non-empty array' }, { status: 400 })
    }

    // Update all tasks that are not already completed
    const updateResult = await pool.query(`
      UPDATE ticket_tasks
      SET is_completed = true, completed_at = NOW(), completed_by = $1
      WHERE id = ANY($2) AND organization_id = $3 AND is_completed = false
      RETURNING ticket_id
    `, [userId, task_ids, orgId])

    const completedCount = updateResult.rows.length

    // Get unique ticket_ids from the returned rows
    const affectedTicketIds = [...new Set(updateResult.rows.map((r: any) => r.ticket_id))]

    // Update onboarding_request completed_tasks count for each affected ticket
    for (const ticketId of affectedTicketIds) {
      await pool.query(`
        UPDATE onboarding_requests
        SET completed_tasks = (
          SELECT COUNT(*) FROM ticket_tasks
          WHERE ticket_id = $1 AND organization_id = $2 AND is_completed = true
        ),
        status = CASE
          WHEN (SELECT COUNT(*) FROM ticket_tasks WHERE ticket_id = $1 AND organization_id = $2 AND is_completed = true)
             = (SELECT COUNT(*) FROM ticket_tasks WHERE ticket_id = $1 AND organization_id = $2)
          THEN 'completed'
          ELSE 'in_progress'
        END,
        completed_at = CASE
          WHEN (SELECT COUNT(*) FROM ticket_tasks WHERE ticket_id = $1 AND organization_id = $2 AND is_completed = true)
             = (SELECT COUNT(*) FROM ticket_tasks WHERE ticket_id = $1 AND organization_id = $2)
          THEN NOW()
          ELSE NULL
        END,
        updated_at = NOW()
        WHERE ticket_id = $1 AND organization_id = $2
      `, [ticketId, orgId])
    }

    return NextResponse.json({ completed: completedCount })
  } catch (error) {
    console.error('Error batch completing tasks:', error)
    return NextResponse.json({ error: 'Failed to batch complete tasks' }, { status: 500 })
  }
}
