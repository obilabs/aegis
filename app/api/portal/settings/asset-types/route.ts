import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(`
      SELECT at.*,
        (SELECT COUNT(*) FROM asset_subtypes ast WHERE ast.asset_type_id = at.id AND ast.is_active = true) as subtype_count
      FROM asset_types at
      WHERE at.organization_id = $1
      ORDER BY at.name
    `, [orgId])

    return NextResponse.json({ assetTypes: result.rows })
  } catch (error) {
    console.error('Error fetching asset types:', error)
    return NextResponse.json({ error: 'Failed to fetch asset types' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO asset_types (organization_id, name, description, icon, color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      orgId,
      body.name.trim(),
      body.description?.trim() || null,
      body.icon?.trim() || null,
      body.color?.trim() || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An asset type with this name already exists' }, { status: 409 })
    }
    console.error('Error creating asset type:', error)
    return NextResponse.json({ error: 'Failed to create asset type' }, { status: 500 })
  }
}
