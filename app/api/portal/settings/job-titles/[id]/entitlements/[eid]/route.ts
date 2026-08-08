import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id, eid } = await params
    const orgId = admin.orgId
    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.entitlement_type !== undefined) {
      if (!body.entitlement_type?.trim()) {
        return NextResponse.json({ error: 'Entitlement type cannot be empty' }, { status: 400 })
      }
      updates.push(`entitlement_type = $${paramIndex++}`)
      values.push(body.entitlement_type.trim())
    }
    if (body.resource_id !== undefined) {
      updates.push(`resource_id = $${paramIndex++}`)
      values.push(body.resource_id || null)
    }
    if (body.resource_name !== undefined) {
      if (!body.resource_name?.trim()) {
        return NextResponse.json({ error: 'Resource name cannot be empty' }, { status: 400 })
      }
      updates.push(`resource_name = $${paramIndex++}`)
      values.push(body.resource_name.trim())
    }
    if (body.requires_approval !== undefined) {
      updates.push(`requires_approval = $${paramIndex++}`)
      values.push(body.requires_approval)
    }
    if (body.approval_workflow_id !== undefined) {
      updates.push(`approval_workflow_id = $${paramIndex++}`)
      values.push(body.approval_workflow_id || null)
    }
    if (body.service_category !== undefined) {
      updates.push(`service_category = $${paramIndex++}`)
      values.push(body.service_category?.trim() || null)
    }
    if (body.default_assignee_type !== undefined) {
      updates.push(`default_assignee_type = $${paramIndex++}`)
      values.push(body.default_assignee_type?.trim() || 'it_admin')
    }
    if (body.default_assignee_id !== undefined) {
      updates.push(`default_assignee_id = $${paramIndex++}`)
      values.push(body.default_assignee_id || null)
    }
    if (body.task_title !== undefined) {
      updates.push(`task_title = $${paramIndex++}`)
      values.push(body.task_title?.trim() || null)
    }
    if (body.task_description !== undefined) {
      updates.push(`task_description = $${paramIndex++}`)
      values.push(body.task_description?.trim() || null)
    }
    if (body.is_required !== undefined) {
      updates.push(`is_required = $${paramIndex++}`)
      values.push(body.is_required)
    }
    if (body.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`)
      values.push(body.sort_order)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(eid, id, orgId)

    const result = await pool.query(
      `UPDATE job_title_entitlements SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND job_title_id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Entitlement not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating entitlement:', error)
    return NextResponse.json({ error: 'Failed to update entitlement' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id, eid } = await params
    const orgId = admin.orgId

    const result = await pool.query(
      `DELETE FROM job_title_entitlements
       WHERE id = $1 AND job_title_id = $2 AND organization_id = $3
       RETURNING id`,
      [eid, id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Entitlement not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting entitlement:', error)
    return NextResponse.json({ error: 'Failed to delete entitlement' }, { status: 500 })
  }
}
