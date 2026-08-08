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
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(body.description?.trim() || null)
    }
    if (body.delegator_type !== undefined) {
      updates.push(`delegator_type = $${paramIndex++}`)
      values.push(body.delegator_type)
    }
    if (body.delegator_id !== undefined) {
      updates.push(`delegator_id = $${paramIndex++}`)
      values.push(body.delegator_id || null)
    }
    if (body.action !== undefined) {
      updates.push(`action = $${paramIndex++}`)
      values.push(body.action)
    }
    if (body.target_scope !== undefined) {
      updates.push(`target_scope = $${paramIndex++}`)
      values.push(body.target_scope)
    }
    if (body.target_group_id !== undefined) {
      updates.push(`target_group_id = $${paramIndex++}`)
      values.push(body.target_group_id || null)
    }
    if (body.requires_justification !== undefined) {
      updates.push(`requires_justification = $${paramIndex++}`)
      values.push(body.requires_justification)
    }
    if (body.max_cost !== undefined) {
      updates.push(`max_cost = $${paramIndex++}`)
      values.push(body.max_cost)
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(body.is_active)
    }
    if (body.starts_at !== undefined) {
      updates.push(`starts_at = $${paramIndex++}`)
      values.push(body.starts_at)
    }
    if (body.ends_at !== undefined) {
      updates.push(`ends_at = $${paramIndex++}`)
      values.push(body.ends_at)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE delegation_rules SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Delegation rule not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating delegation rule:', error)
    return NextResponse.json({ error: 'Failed to update delegation rule' }, { status: 500 })
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
      `DELETE FROM delegation_rules WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Delegation rule not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting delegation rule:', error)
    return NextResponse.json({ error: 'Failed to delete delegation rule' }, { status: 500 })
  }
}
