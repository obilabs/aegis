import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx
    const teamId = request.nextUrl.searchParams.get('team_id')
    const status = request.nextUrl.searchParams.get('status')

    let query = `
      SELECT
        b.id,
        b.team_id,
        b.title,
        b.description,
        b.category,
        b.status,
        b.priority,
        b.review_by,
        b.converted_ticket_id,
        b.abort_reason,
        b.abort_notes,
        b.aborted_at,
        b.created_at,
        b.updated_at,
        CONCAT(su.first_name, ' ', su.last_name) as submitted_by_name,
        CONCAT(au.first_name, ' ', au.last_name) as aborted_by_name,
        t.name as team_name,
        (SELECT COUNT(*) FROM backlog_comments bc WHERE bc.backlog_item_id = b.id) as comment_count
      FROM team_backlog_items b
      LEFT JOIN users su ON b.submitted_by = su.id
      LEFT JOIN users au ON b.aborted_by = au.id
      LEFT JOIN teams t ON b.team_id = t.id
      WHERE b.organization_id = $1
    `
    const params: any[] = [orgId]
    let paramIndex = 2

    if (teamId) {
      query += ` AND b.team_id = $${paramIndex++}`
      params.push(teamId)
    }
    if (status) {
      query += ` AND b.status = $${paramIndex++}`
      params.push(status)
    }

    query += ` ORDER BY
      CASE b.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
      b.created_at DESC`

    const result = await pool.query(query, params)

    // Get metrics
    const metricsResult = await pool.query(`
      SELECT
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (
          CASE WHEN status IN ('converted', 'done') THEN updated_at ELSE NOW() END
          - created_at
        )) / 86400)::INTEGER as avg_age_days
      FROM team_backlog_items
      WHERE organization_id = $1
      GROUP BY status
    `, [orgId])

    const overdueResult = await pool.query(`
      SELECT COUNT(*) as overdue_count
      FROM team_backlog_items
      WHERE organization_id = $1
        AND status IN ('backlog', 'planning')
        AND review_by < NOW()
    `, [orgId])

    return NextResponse.json({
      items: result.rows,
      metrics: {
        byStatus: metricsResult.rows,
        overdueCount: parseInt(overdueResult.rows[0]?.overdue_count || '0'),
      },
    })
  } catch (error) {
    console.error('Error fetching backlog:', error)
    return NextResponse.json({ error: 'Failed to fetch backlog' }, { status: 500 })
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

    const result = await pool.query(`
      INSERT INTO team_backlog_items (
        organization_id, team_id, title, description, category, priority, submitted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      orgId,
      body.team_id || null,
      body.title.trim(),
      body.description?.trim() || null,
      body.category?.trim() || null,
      body.priority || 'medium',
      userId,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating backlog item:', error)
    return NextResponse.json({ error: 'Failed to create backlog item' }, { status: 500 })
  }
}
