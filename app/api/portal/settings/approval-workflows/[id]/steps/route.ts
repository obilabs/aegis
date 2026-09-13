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

    // Verify workflow belongs to this organization
    const workflowCheck = await pool.query(
      `SELECT id FROM approval_workflows WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (workflowCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const result = await pool.query(`
      SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) as approver_name
      FROM approval_workflow_steps s
      LEFT JOIN users u ON s.approver_id = u.id
      WHERE s.workflow_id = $1
      ORDER BY s.step_order ASC
    `, [id])

    return NextResponse.json({ steps: result.rows })
  } catch (error) {
    console.error('Error fetching workflow steps:', error)
    return NextResponse.json({ error: 'Failed to fetch workflow steps' }, { status: 500 })
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
    const body = await request.json()

    // Verify workflow belongs to this organization
    const workflowCheck = await pool.query(
      `SELECT id FROM approval_workflows WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (workflowCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (!body.approver_type?.trim()) {
      return NextResponse.json({ error: 'Approver type is required' }, { status: 400 })
    }

    // Calculate next step_order
    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(step_order), 0) + 1 as next_order
       FROM approval_workflow_steps WHERE workflow_id = $1`,
      [id]
    )
    const nextOrder = orderResult.rows[0].next_order

    const result = await pool.query(`
      INSERT INTO approval_workflow_steps (
        workflow_id, step_order, name, approver_type, approver_id,
        approval_mode, required_approvals, can_skip,
        skip_if_same_approver, timeout_hours, timeout_action
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id,
      nextOrder,
      body.name?.trim() || null,
      body.approver_type.trim(),
      body.approver_id || null,
      body.approval_mode || 'any',
      body.required_approvals ?? 1,
      body.can_skip ?? false,
      body.skip_if_same_approver ?? true,
      body.timeout_hours ?? 48,
      body.timeout_action || 'escalate',
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating workflow step:', error)
    return NextResponse.json({ error: 'Failed to create workflow step' }, { status: 500 })
  }
}
