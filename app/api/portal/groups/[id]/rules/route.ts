import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    // Verify group belongs to organization
    const groupCheck = await pool.query(
      'SELECT id FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const result = await pool.query(
      'SELECT * FROM dynamic_group_rules WHERE group_id = $1 ORDER BY sort_order',
      [id]
    )

    return NextResponse.json({ rules: result.rows })
  } catch (error) {
    console.error('Error fetching group rules:', error)
    return NextResponse.json({ error: 'Failed to fetch group rules' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    // Verify group belongs to organization
    const groupCheck = await pool.query(
      'SELECT id FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Authorization (audit 2026-07-23): adding a group rule is a
    // user_management action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const body = await request.json()
    const { field_name, operator, value, sort_order } = body

    if (!field_name || !operator || value === undefined) {
      return NextResponse.json(
        { error: 'field_name, operator, and value are required' },
        { status: 400 }
      )
    }

    // Auto-calculate sort_order if not provided
    let effectiveSortOrder = sort_order
    if (effectiveSortOrder === undefined || effectiveSortOrder === null) {
      const maxResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM dynamic_group_rules WHERE group_id = $1',
        [id]
      )
      effectiveSortOrder = maxResult.rows[0].next_order
    }

    const result = await pool.query(`
      INSERT INTO dynamic_group_rules (group_id, field_name, operator, value, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, field_name, operator, value, effectiveSortOrder])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating group rule:', error)
    return NextResponse.json({ error: 'Failed to create group rule' }, { status: 500 })
  }
}
