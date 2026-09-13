import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    // Get group
    const groupResult = await pool.query(
      'SELECT * FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const group = groupResult.rows[0]

    // Get rules
    const rulesResult = await pool.query(
      'SELECT * FROM dynamic_group_rules WHERE group_id = $1 ORDER BY sort_order',
      [id]
    )

    // Get member count by source
    const memberStatsResult = await pool.query(`
      SELECT membership_source, COUNT(*) as count
      FROM dynamic_group_members
      WHERE group_id = $1 AND is_active = true
      GROUP BY membership_source
    `, [id])

    const member_stats: Record<string, number> = { dynamic: 0, static: 0 }
    for (const row of memberStatsResult.rows) {
      member_stats[row.membership_source] = parseInt(row.count, 10)
    }

    return NextResponse.json({
      ...group,
      rules: rulesResult.rows,
      member_stats,
    })
  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 })
  }
}

export async function PATCH(
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

    // Authorization (audit 2026-07-23): editing an access-control group is a
    // user_management action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const body = await request.json()

    const allowedFields = [
      'name', 'description', 'group_type', 'membership_type',
      'rule_logic', 'refresh_interval_minutes', 'is_active',
    ]

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`)
        values.push(body[field])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE dynamic_groups SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Authorization (audit 2026-07-23): deleting an access-control group is a
    // user_management action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const result = await pool.query(
      'DELETE FROM dynamic_groups WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
