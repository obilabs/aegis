import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx
    const url = new URL(request.url)
    const type = url.searchParams.get('type')

    const conditions: string[] = ['dg.organization_id = $1']
    const values: any[] = [orgId]
    let paramIndex = 2

    if (type && ['user', 'asset', 'contact'].includes(type)) {
      conditions.push(`dg.group_type = $${paramIndex++}`)
      values.push(type)
    }

    const where = conditions.join(' AND ')

    const result = await pool.query(`
      SELECT dg.*,
        (SELECT COUNT(*) FROM dynamic_group_rules dgr WHERE dgr.group_id = dg.id) as rule_count,
        (SELECT COUNT(*) FROM dynamic_group_members dgm WHERE dgm.group_id = dg.id AND dgm.is_active = true) as member_count
      FROM dynamic_groups dg
      WHERE ${where}
      ORDER BY dg.name
    `, values)

    return NextResponse.json({ groups: result.rows })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx

    // Authorization (audit 2026-07-23): creating an access-control group is a
    // user_management action. Without this any authenticated user could.
    if (!(await hasCapabilityOrAdmin(userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const body = await request.json()

    const { name, description, group_type, membership_type, rule_logic } = body

    if (!name || !group_type) {
      return NextResponse.json(
        { error: 'Name and group_type are required' },
        { status: 400 }
      )
    }

    if (!['user', 'asset', 'contact'].includes(group_type)) {
      return NextResponse.json(
        { error: 'group_type must be one of: user, asset, contact' },
        { status: 400 }
      )
    }

    const result = await pool.query(`
      INSERT INTO dynamic_groups (
        organization_id, name, description, group_type,
        membership_type, rule_logic, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      orgId,
      name,
      description || null,
      group_type,
      membership_type || 'dynamic',
      rule_logic || 'AND',
      userId,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}
