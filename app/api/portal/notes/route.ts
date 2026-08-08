import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

const ACTIVE_LIMIT = 10

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx
    const includeArchived = request.nextUrl.searchParams.get('archived') === 'true'

    const result = await pool.query(`
      SELECT id, content, is_archived, created_at, updated_at
      FROM user_notes
      WHERE user_id = $1 AND organization_id = $2
        ${includeArchived ? '' : 'AND is_archived = false'}
      ORDER BY created_at DESC
    `, [userId, orgId])

    const activeCount = result.rows.filter(n => !n.is_archived).length

    return NextResponse.json({
      notes: result.rows,
      activeCount,
      limit: ACTIVE_LIMIT,
    })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx
    const body = await request.json()

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Check active count cap
    const countResult = await pool.query(
      `SELECT COUNT(*) as active_count FROM user_notes
       WHERE user_id = $1 AND organization_id = $2 AND is_archived = false`,
      [userId, orgId]
    )
    const activeCount = parseInt(countResult.rows[0].active_count)
    if (activeCount >= ACTIVE_LIMIT) {
      return NextResponse.json({
        error: `You have ${ACTIVE_LIMIT} active notes. Archive or move some before creating new ones.`,
      }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO user_notes (organization_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, content, is_archived, created_at, updated_at
    `, [orgId, userId, body.content.trim()])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
