import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id, stepId } = await params
    const orgId = admin.orgId
    const body = await request.json()

    // Verify workflow belongs to this organization
    const workflowCheck = await pool.query(
      `SELECT id FROM approval_workflows WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (workflowCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(body.name?.trim() || null)
    }
    if (body.approver_type !== undefined) {
      updates.push(`approver_type = $${paramIndex++}`)
      values.push(body.approver_type)
    }
    if (body.approver_id !== undefined) {
      updates.push(`approver_id = $${paramIndex++}`)
      values.push(body.approver_id || null)
    }
    if (body.approval_mode !== undefined) {
      updates.push(`approval_mode = $${paramIndex++}`)
      values.push(body.approval_mode)
    }
    if (body.required_approvals !== undefined) {
      updates.push(`required_approvals = $${paramIndex++}`)
      values.push(body.required_approvals)
    }
    if (body.step_order !== undefined) {
      updates.push(`step_order = $${paramIndex++}`)
      values.push(body.step_order)
    }
    if (body.can_skip !== undefined) {
      updates.push(`can_skip = $${paramIndex++}`)
      values.push(body.can_skip)
    }
    if (body.skip_if_same_approver !== undefined) {
      updates.push(`skip_if_same_approver = $${paramIndex++}`)
      values.push(body.skip_if_same_approver)
    }
    if (body.timeout_hours !== undefined) {
      updates.push(`timeout_hours = $${paramIndex++}`)
      values.push(body.timeout_hours)
    }
    if (body.timeout_action !== undefined) {
      updates.push(`timeout_action = $${paramIndex++}`)
      values.push(body.timeout_action)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(stepId, id)

    const result = await pool.query(
      `UPDATE approval_workflow_steps SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND workflow_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating workflow step:', error)
    return NextResponse.json({ error: 'Failed to update workflow step' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id, stepId } = await params
    const orgId = admin.orgId

    // Verify workflow belongs to this organization
    const workflowCheck = await pool.query(
      `SELECT id FROM approval_workflows WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (workflowCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const result = await pool.query(
      `DELETE FROM approval_workflow_steps WHERE id = $1 AND workflow_id = $2 RETURNING id`,
      [stepId, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    // Reorder remaining steps sequentially
    await pool.query(`
      UPDATE approval_workflow_steps s
      SET step_order = sub.new_order
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY step_order ASC) as new_order
        FROM approval_workflow_steps
        WHERE workflow_id = $1
      ) sub
      WHERE s.id = sub.id
    `, [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting workflow step:', error)
    return NextResponse.json({ error: 'Failed to delete workflow step' }, { status: 500 })
  }
}
