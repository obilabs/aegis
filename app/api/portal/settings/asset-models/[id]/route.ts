import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

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
    if (body.asset_subtype_id !== undefined) {
      updates.push(`asset_subtype_id = $${paramIndex++}`)
      values.push(body.asset_subtype_id)
    }
    if (body.vendor_id !== undefined) {
      updates.push(`vendor_id = $${paramIndex++}`)
      values.push(body.vendor_id || null)
    }
    if (body.model_number !== undefined) {
      updates.push(`model_number = $${paramIndex++}`)
      values.push(body.model_number?.trim() || null)
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(body.description?.trim() || null)
    }
    if (body.end_of_life_date !== undefined) {
      updates.push(`end_of_life_date = $${paramIndex++}`)
      values.push(body.end_of_life_date || null)
    }
    if (body.end_of_support_date !== undefined) {
      updates.push(`end_of_support_date = $${paramIndex++}`)
      values.push(body.end_of_support_date || null)
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
      `UPDATE asset_models SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Asset model not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An asset model with this name already exists' }, { status: 409 })
    }
    console.error('Error updating asset model:', error)
    return NextResponse.json({ error: 'Failed to update asset model' }, { status: 500 })
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
      `UPDATE asset_models SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Asset model not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting asset model:', error)
    return NextResponse.json({ error: 'Failed to delete asset model' }, { status: 500 })
  }
}
