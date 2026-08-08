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

    const workflowResult = await pool.query(`
      SELECT aw.*, CONCAT(u.first_name, ' ', u.last_name) as escalation_to_name
      FROM approval_workflows aw
      LEFT JOIN users u ON aw.escalation_to = u.id
      WHERE aw.id = $1 AND aw.organization_id = $2
    `, [id, orgId])

    if (workflowResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const stepsResult = await pool.query(`
      SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) as approver_name
      FROM approval_workflow_steps s
      LEFT JOIN users u ON s.approver_id = u.id
      WHERE s.workflow_id = $1
      ORDER BY s.step_order ASC
    `, [id])

    return NextResponse.json({
      workflow: { ...workflowResult.rows[0], steps: stepsResult.rows },
    })
  } catch (error) {
    console.error('Error fetching approval workflow:', error)
    return NextResponse.json({ error: 'Failed to fetch approval workflow' }, { status: 500 })
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
    if (body.workflow_type !== undefined) {
      updates.push(`workflow_type = $${paramIndex++}`)
      values.push(body.workflow_type)
    }
    if (body.escalation_enabled !== undefined) {
      updates.push(`escalation_enabled = $${paramIndex++}`)
      values.push(body.escalation_enabled)
    }
    if (body.escalation_after_hours !== undefined) {
      updates.push(`escalation_after_hours = $${paramIndex++}`)
      values.push(body.escalation_after_hours)
    }
    if (body.escalation_to !== undefined) {
      updates.push(`escalation_to = $${paramIndex++}`)
      values.push(body.escalation_to || null)
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
      `UPDATE approval_workflows SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating approval workflow:', error)
    return NextResponse.json({ error: 'Failed to update approval workflow' }, { status: 500 })
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
      `DELETE FROM approval_workflows WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting approval workflow:', error)
    return NextResponse.json({ error: 'Failed to delete approval workflow' }, { status: 500 })
  }
}
