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

    const result = await pool.query(`
      SELECT
        aw.id, aw.name, aw.description, aw.workflow_type,
        aw.escalation_enabled, aw.escalation_after_hours,
        aw.is_active, aw.created_at, aw.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) as escalation_to_name,
        (SELECT COUNT(*) FROM approval_workflow_steps WHERE workflow_id = aw.id) as step_count
      FROM approval_workflows aw
      LEFT JOIN users u ON aw.escalation_to = u.id
      WHERE aw.organization_id = $1
      ORDER BY aw.name ASC
    `, [orgId])

    return NextResponse.json({ workflows: result.rows })
  } catch (error) {
    console.error('Error fetching approval workflows:', error)
    return NextResponse.json({ error: 'Failed to fetch approval workflows' }, { status: 500 })
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

    const result = await pool.query(`
      INSERT INTO approval_workflows (
        organization_id, name, description, workflow_type,
        escalation_enabled, escalation_after_hours, escalation_to, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      orgId,
      body.name.trim(),
      body.description?.trim() || null,
      body.workflow_type || 'sequential',
      body.escalation_enabled ?? false,
      body.escalation_after_hours ?? 48,
      body.escalation_to || null,
      body.is_active ?? true,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating approval workflow:', error)
    return NextResponse.json({ error: 'Failed to create approval workflow' }, { status: 500 })
  }
}
