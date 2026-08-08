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
      SELECT id, title, is_completed, is_archived, completed_at, sort_order, created_at
      FROM user_tasks
      WHERE user_id = $1 AND organization_id = $2
        ${includeArchived ? '' : 'AND is_archived = false'}
      ORDER BY sort_order ASC, created_at ASC
    `, [userId, orgId])

    const activeCount = result.rows.filter(t => !t.is_archived).length

    return NextResponse.json({
      tasks: result.rows,
      activeCount,
      limit: ACTIVE_LIMIT,
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
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

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Check active count cap
    const countResult = await pool.query(
      `SELECT COUNT(*) as active_count FROM user_tasks
       WHERE user_id = $1 AND organization_id = $2 AND is_archived = false`,
      [userId, orgId]
    )
    const activeCount = parseInt(countResult.rows[0].active_count)
    if (activeCount >= ACTIVE_LIMIT) {
      return NextResponse.json({
        error: `You have ${ACTIVE_LIMIT} active tasks. Archive or move some before creating new ones.`,
      }, { status: 400 })
    }

    // Get next sort order
    const maxSort = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
       FROM user_tasks WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId]
    )

    const result = await pool.query(`
      INSERT INTO user_tasks (organization_id, user_id, title, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, is_completed, is_archived, completed_at, sort_order, created_at
    `, [orgId, userId, body.title.trim(), maxSort.rows[0].next_order])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
