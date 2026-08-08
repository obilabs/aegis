import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { orgId } = ctx

    const itemResult = await pool.query(`
      SELECT
        b.*,
        CONCAT(su.first_name, ' ', su.last_name) as submitted_by_name,
        CONCAT(au.first_name, ' ', au.last_name) as aborted_by_name,
        t.name as team_name
      FROM team_backlog_items b
      LEFT JOIN users su ON b.submitted_by = su.id
      LEFT JOIN users au ON b.aborted_by = au.id
      LEFT JOIN teams t ON b.team_id = t.id
      WHERE b.id = $1 AND b.organization_id = $2
    `, [id, orgId])

    if (itemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const commentsResult = await pool.query(`
      SELECT
        bc.id,
        bc.content,
        bc.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM backlog_comments bc
      LEFT JOIN users u ON bc.user_id = u.id
      WHERE bc.backlog_item_id = $1
      ORDER BY bc.created_at ASC
    `, [id])

    return NextResponse.json({
      item: itemResult.rows[0],
      comments: commentsResult.rows,
    })
  } catch (error) {
    console.error('Error fetching backlog item:', error)
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { userId, orgId } = ctx

    // Authorization (audit 2026-07-23): editing a backlog item is a triage action.
    if (!(await hasCapabilityOrAdmin(userId, 'triage'))) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(body.title.trim())
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(body.description?.trim() || null)
    }
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`)
      values.push(body.category?.trim() || null)
    }
    if (body.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`)
      values.push(body.priority)
    }
    if (body.review_by !== undefined) {
      updates.push(`review_by = $${paramIndex++}`)
      values.push(body.review_by)
    }
    if (body.team_id !== undefined) {
      updates.push(`team_id = $${paramIndex++}`)
      values.push(body.team_id || null)
    }

    // Status transitions
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(body.status)

      if (body.status === 'aborted') {
        if (!body.abort_reason) {
          return NextResponse.json({ error: 'Abort reason is required' }, { status: 400 })
        }
        updates.push(`abort_reason = $${paramIndex++}`)
        values.push(body.abort_reason)
        updates.push(`abort_notes = $${paramIndex++}`)
        values.push(body.abort_notes || null)
        updates.push(`aborted_by = $${paramIndex++}`)
        values.push(userId)
        updates.push(`aborted_at = NOW()`)
      }

      if (body.status === 'converted' && body.converted_ticket_id) {
        updates.push(`converted_ticket_id = $${paramIndex++}`)
        values.push(body.converted_ticket_id)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE team_backlog_items SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating backlog item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { orgId } = ctx

    // Authorization (audit 2026-07-23): deleting a backlog item is a triage action.
    if (!(await hasCapabilityOrAdmin(ctx.userId, 'triage'))) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const result = await pool.query(
      `DELETE FROM team_backlog_items WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting backlog item:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
