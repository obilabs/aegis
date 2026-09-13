import { toSafeHtml } from '@/lib/article-render'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { session, userId, orgId } = ctx
    const body = await request.json()

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Verify the backlog item belongs to the org
    const itemCheck = await pool.query(
      `SELECT id FROM team_backlog_items WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )
    if (itemCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const result = await pool.query(`
      INSERT INTO backlog_comments (backlog_item_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, content, created_at
    `, [id, userId, toSafeHtml(body.content.trim())])

    const comment = result.rows[0]
    comment.user_name = session.user.name || session.user.email

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
