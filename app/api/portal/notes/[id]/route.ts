import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

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
    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.content !== undefined) {
      updates.push(`content = $${paramIndex++}`)
      values.push(body.content.trim())
    }
    if (body.is_archived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`)
      values.push(body.is_archived)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, userId, orgId)

    const result = await pool.query(
      `UPDATE user_notes SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING id, content, is_archived, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
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
    const { userId, orgId } = ctx

    const result = await pool.query(
      `DELETE FROM user_notes WHERE id = $1 AND user_id = $2 AND organization_id = $3 RETURNING id`,
      [id, userId, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
