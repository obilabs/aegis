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

    if (body.delegate_id !== undefined) {
      updates.push(`delegate_id = $${paramIndex++}`)
      values.push(body.delegate_id)
    }
    if (body.delegation_type !== undefined) {
      updates.push(`delegation_type = $${paramIndex++}`)
      values.push(body.delegation_type)
    }
    if (body.actions !== undefined) {
      updates.push(`actions = $${paramIndex++}`)
      values.push(body.actions)
    }
    if (body.starts_at !== undefined) {
      updates.push(`starts_at = $${paramIndex++}`)
      values.push(body.starts_at)
    }
    if (body.ends_at !== undefined) {
      updates.push(`ends_at = $${paramIndex++}`)
      values.push(body.ends_at)
    }
    if (body.notify_on_action !== undefined) {
      updates.push(`notify_on_action = $${paramIndex++}`)
      values.push(body.notify_on_action)
    }
    if (body.reason !== undefined) {
      updates.push(`reason = $${paramIndex++}`)
      values.push(body.reason?.trim() || null)
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(body.is_active)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE delegation_transfers SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Delegation transfer not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating delegation transfer:', error)
    return NextResponse.json({ error: 'Failed to update delegation transfer' }, { status: 500 })
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
      `DELETE FROM delegation_transfers WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Delegation transfer not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting delegation transfer:', error)
    return NextResponse.json({ error: 'Failed to delete delegation transfer' }, { status: 500 })
  }
}
