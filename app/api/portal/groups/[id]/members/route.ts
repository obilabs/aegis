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

    // Get group to determine type
    const groupResult = await pool.query(
      'SELECT id, group_type FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const groupType = groupResult.rows[0].group_type

    let members

    if (groupType === 'asset') {
      // Asset type groups
      const result = await pool.query(`
        SELECT dgm.*, a.name as asset_name, a.asset_tag, a.serial_number, a.status,
          at.name as type_name, ast.name as subtype_name
        FROM dynamic_group_members dgm
        LEFT JOIN assets a ON dgm.asset_id = a.id
        LEFT JOIN asset_types at ON a.type_id = at.id
        LEFT JOIN asset_subtypes ast ON a.subtype_id = ast.id
        WHERE dgm.group_id = $1 AND dgm.is_active = true
        ORDER BY a.name
      `, [id])
      members = result.rows
    } else {
      // User/contact type groups
      const result = await pool.query(`
        SELECT dgm.*, c.first_name, c.last_name, c.email, c.department_legacy as department, c.job_title
        FROM dynamic_group_members dgm
        LEFT JOIN contacts c ON dgm.contact_id = c.id
        WHERE dgm.group_id = $1 AND dgm.is_active = true
        ORDER BY c.first_name, c.last_name
      `, [id])
      members = result.rows
    }

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching group members:', error)
    return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 })
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

    // Verify group belongs to organization and check membership_type
    const groupResult = await pool.query(
      'SELECT id, membership_type FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const membershipType = groupResult.rows[0].membership_type
    if (membershipType === 'dynamic') {
      return NextResponse.json(
        { error: 'Cannot manually add members to a dynamic-only group' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { contact_id, user_id, asset_id } = body

    if (!contact_id && !user_id && !asset_id) {
      return NextResponse.json(
        { error: 'At least one of contact_id, user_id, or asset_id is required' },
        { status: 400 }
      )
    }

    const result = await pool.query(`
      INSERT INTO dynamic_group_members (
        group_id, contact_id, user_id, asset_id, membership_source
      ) VALUES ($1, $2, $3, $4, 'static')
      RETURNING *
    `, [id, contact_id || null, user_id || null, asset_id || null])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error adding group member:', error)
    return NextResponse.json({ error: 'Failed to add group member' }, { status: 500 })
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

    // Verify group belongs to organization
    const groupCheck = await pool.query(
      'SELECT id FROM dynamic_groups WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Authorization (audit 2026-07-23): removing a group member is a
    // user_management action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const body = await request.json()
    const { member_id } = body

    if (!member_id) {
      return NextResponse.json(
        { error: 'member_id is required' },
        { status: 400 }
      )
    }

    // Soft-delete: set is_active = false and removed_at
    const result = await pool.query(`
      UPDATE dynamic_group_members
      SET is_active = false, removed_at = NOW()
      WHERE id = $1 AND group_id = $2
      RETURNING id
    `, [member_id, id])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing group member:', error)
    return NextResponse.json({ error: 'Failed to remove group member' }, { status: 500 })
  }
}
