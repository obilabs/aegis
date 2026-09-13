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
    const { searchParams } = new URL(request.url)
    const subtypeId = searchParams.get('subtype_id')
    const vendorId = searchParams.get('vendor_id')

    let queryText = `
      SELECT am.*, v.name as vendor_name, ast.name as subtype_name, at.name as type_name
      FROM asset_models am
      LEFT JOIN companies v ON am.vendor_id = v.id
      LEFT JOIN asset_subtypes ast ON am.asset_subtype_id = ast.id
      LEFT JOIN asset_types at ON ast.asset_type_id = at.id
      WHERE am.organization_id = $1
    `
    const values: any[] = [orgId]
    let paramIndex = 2

    if (subtypeId) {
      queryText += ` AND am.asset_subtype_id = $${paramIndex++}`
      values.push(subtypeId)
    }
    if (vendorId) {
      queryText += ` AND am.vendor_id = $${paramIndex++}`
      values.push(vendorId)
    }

    queryText += ` ORDER BY at.name, ast.name, v.name, am.name`

    const result = await pool.query(queryText, values)

    return NextResponse.json({ assetModels: result.rows })
  } catch (error) {
    console.error('Error fetching asset models:', error)
    return NextResponse.json({ error: 'Failed to fetch asset models' }, { status: 500 })
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
    if (!body.asset_subtype_id) {
      return NextResponse.json({ error: 'Asset subtype is required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO asset_models (
        organization_id, asset_subtype_id, vendor_id, name, model_number,
        description, end_of_life_date, end_of_support_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      orgId,
      body.asset_subtype_id,
      body.vendor_id || null,
      body.name.trim(),
      body.model_number?.trim() || null,
      body.description?.trim() || null,
      body.end_of_life_date || null,
      body.end_of_support_date || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An asset model with this name already exists' }, { status: 409 })
    }
    console.error('Error creating asset model:', error)
    return NextResponse.json({ error: 'Failed to create asset model' }, { status: 500 })
  }
}
