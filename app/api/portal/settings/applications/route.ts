import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(`
      SELECT
        a.id, a.name, a.description, a.icon_url, a.access_levels,
        a.requires_approval, a.approval_levels, a.provisioning_notes,
        a.cost_per_license, a.license_type, a.is_active,
        a.owner_id, a.vendor_id,
        CONCAT(u.first_name, ' ', u.last_name) as owner_name,
        c.name as vendor_name,
        a.created_at, a.updated_at
      FROM applications a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN companies c ON a.vendor_id = c.id
      WHERE a.organization_id = $1
      ORDER BY a.name ASC
    `, [orgId])

    return NextResponse.json({ applications: result.rows })
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()

    const { name, description, icon_url, owner_id, access_levels, requires_approval,
            approval_levels, provisioning_notes, cost_per_license, license_type, vendor_id } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = await pool.query(
      `INSERT INTO applications (organization_id, name, description, icon_url, owner_id,
        access_levels, requires_approval, approval_levels, provisioning_notes,
        cost_per_license, license_type, vendor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [orgId, name.trim(), description || null, icon_url || null, owner_id || null,
       JSON.stringify(access_levels || ['Standard']), requires_approval ?? true,
       approval_levels || 1, provisioning_notes || null,
       cost_per_license || null, license_type || null, vendor_id || null]
    )

    return NextResponse.json({ id: result.rows[0].id }, { status: 201 })
  } catch (error: any) {
    if (error?.constraint === 'applications_organization_id_name_key') {
      return NextResponse.json({ error: 'An application with this name already exists' }, { status: 409 })
    }
    console.error('Error creating application:', error)
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }
}
