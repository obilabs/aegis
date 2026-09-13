import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
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

    const typeResult = await pool.query(
      `SELECT * FROM asset_types WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (typeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Asset type not found' }, { status: 404 })
    }

    const subtypesResult = await pool.query(
      `SELECT * FROM asset_subtypes WHERE asset_type_id = $1 AND organization_id = $2 ORDER BY sort_order, name`,
      [id, orgId]
    )

    return NextResponse.json({
      assetType: typeResult.rows[0],
      subtypes: subtypesResult.rows,
    })
  } catch (error) {
    console.error('Error fetching asset type:', error)
    return NextResponse.json({ error: 'Failed to fetch asset type' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id } = await params
    const orgId = admin.orgId
    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updates.push(`name = $${paramIndex++}`)
      values.push(body.name.trim())
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(body.description?.trim() || null)
    }
    if (body.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`)
      values.push(body.icon?.trim() || null)
    }
    if (body.color !== undefined) {
      updates.push(`color = $${paramIndex++}`)
      values.push(body.color?.trim() || null)
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(body.is_active)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE asset_types SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Asset type not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An asset type with this name already exists' }, { status: 409 })
    }
    console.error('Error updating asset type:', error)
    return NextResponse.json({ error: 'Failed to update asset type' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id } = await params
    const orgId = admin.orgId

    const result = await pool.query(
      `UPDATE asset_types SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Asset type not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting asset type:', error)
    return NextResponse.json({ error: 'Failed to delete asset type' }, { status: 500 })
  }
}
