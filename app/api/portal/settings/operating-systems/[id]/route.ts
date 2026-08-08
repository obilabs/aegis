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

    if (body.platform !== undefined) {
      if (!body.platform?.trim()) {
        return NextResponse.json({ error: 'Platform cannot be empty' }, { status: 400 })
      }
      updates.push(`platform = $${paramIndex++}`)
      values.push(body.platform.trim())
    }
    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updates.push(`name = $${paramIndex++}`)
      values.push(body.name.trim())
    }
    if (body.version !== undefined) {
      updates.push(`version = $${paramIndex++}`)
      values.push(body.version?.trim() || null)
    }
    if (body.build !== undefined) {
      updates.push(`build = $${paramIndex++}`)
      values.push(body.build?.trim() || null)
    }
    if (body.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`)
      values.push(body.sort_order)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE operating_systems SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Operating system not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An operating system with this name already exists' }, { status: 409 })
    }
    console.error('Error updating operating system:', error)
    return NextResponse.json({ error: 'Failed to update operating system' }, { status: 500 })
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
      `DELETE FROM operating_systems WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Operating system not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting operating system:', error)
    return NextResponse.json({ error: 'Failed to delete operating system' }, { status: 500 })
  }
}
