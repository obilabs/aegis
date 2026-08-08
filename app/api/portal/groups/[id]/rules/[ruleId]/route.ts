import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ruleId } = await params
    const orgId = await getOrgId()

    // Authorization (audit 2026-07-23): modifying a group rule is a
    // user_management action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    // Verify group belongs to organization
    const groupCheck = await pool.query(
      'SELECT id FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const body = await request.json()

    const allowedFields = ['field_name', 'operator', 'value', 'sort_order']
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

    values.push(ruleId, id)

    const result = await pool.query(
      `UPDATE dynamic_group_rules SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND group_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating group rule:', error)
    return NextResponse.json({ error: 'Failed to update group rule' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ruleId } = await params
    const orgId = await getOrgId()

    // Authorization (audit 2026-07-23): modifying a group rule is a
    // user_management action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    // Verify group belongs to organization
    const groupCheck = await pool.query(
      'SELECT id FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get the sort_order of the rule being deleted
    const ruleResult = await pool.query(
      'SELECT sort_order FROM dynamic_group_rules WHERE id = $1 AND group_id = $2',
      [ruleId, id]
    )

    if (ruleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const deletedSortOrder = ruleResult.rows[0].sort_order

    // Delete the rule
    await pool.query(
      'DELETE FROM dynamic_group_rules WHERE id = $1 AND group_id = $2',
      [ruleId, id]
    )

    // Reorder remaining rules to close the gap
    await pool.query(`
      UPDATE dynamic_group_rules
      SET sort_order = sort_order - 1
      WHERE group_id = $1 AND sort_order > $2
    `, [id, deletedSortOrder])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting group rule:', error)
    return NextResponse.json({ error: 'Failed to delete group rule' }, { status: 500 })
  }
}
