import { pool } from '@/lib/db'
import { requireTicketAccess } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { userId, orgId } = ctx

    const { id, taskId } = await params
    const guard = await requireTicketAccess(request, id, { staffOnly: true })
    if (guard instanceof NextResponse) return guard
    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.is_completed !== undefined) {
      updates.push(`is_completed = $${paramIndex++}`)
      values.push(body.is_completed)
      if (body.is_completed) {
        updates.push(`completed_at = NOW()`)
        updates.push(`completed_by = $${paramIndex++}`)
        values.push(userId)
      } else {
        updates.push(`completed_at = NULL`)
        updates.push(`completed_by = NULL`)
      }
    }

    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(body.title.trim())
    }

    if (body.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`)
      values.push(body.sort_order)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    values.push(taskId, id, orgId)
    const result = await pool.query(
      `UPDATE ticket_tasks SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND ticket_id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING id, title, is_completed, completed_at, sort_order`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating ticket task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { orgId } = ctx

    const { id, taskId } = await params
    const guard = await requireTicketAccess(request, id, { staffOnly: true })
    if (guard instanceof NextResponse) return guard

    const result = await pool.query(
      `DELETE FROM ticket_tasks WHERE id = $1 AND ticket_id = $2 AND organization_id = $3 RETURNING id`,
      [taskId, id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ticket task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
