import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
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

    // Verify the asset type belongs to this organization
    const typeResult = await pool.query(
      `SELECT id FROM asset_types WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (typeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Asset type not found' }, { status: 404 })
    }

    const result = await pool.query(
      `SELECT * FROM asset_subtypes WHERE asset_type_id = $1 AND organization_id = $2 ORDER BY sort_order, name`,
      [id, orgId]
    )

    return NextResponse.json({ subtypes: result.rows })
  } catch (error) {
    console.error('Error fetching asset subtypes:', error)
    return NextResponse.json({ error: 'Failed to fetch asset subtypes' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id } = await params
    const orgId = admin.orgId

    // Verify the asset type belongs to this organization
    const typeResult = await pool.query(
      `SELECT id FROM asset_types WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (typeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Asset type not found' }, { status: 404 })
    }

    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Auto-generate slug from name if not provided
    const slug = body.slug?.trim() || body.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const result = await pool.query(`
      INSERT INTO asset_subtypes (asset_type_id, organization_id, name, slug, description, icon)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      id,
      orgId,
      body.name.trim(),
      slug,
      body.description?.trim() || null,
      body.icon?.trim() || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An asset subtype with this name or slug already exists' }, { status: 409 })
    }
    console.error('Error creating asset subtype:', error)
    return NextResponse.json({ error: 'Failed to create asset subtype' }, { status: 500 })
  }
}
