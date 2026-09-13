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

    // Verify the job title belongs to this organization
    const jobTitleResult = await pool.query(
      `SELECT id FROM job_titles WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (jobTitleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 })
    }

    const result = await pool.query(`
      SELECT *
      FROM job_title_entitlements
      WHERE job_title_id = $1 AND organization_id = $2
      ORDER BY sort_order ASC, created_at ASC
    `, [id, orgId])

    return NextResponse.json({ entitlements: result.rows })
  } catch (error) {
    console.error('Error fetching entitlements:', error)
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 })
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

    // Verify the job title belongs to this organization
    const jobTitleResult = await pool.query(
      `SELECT id FROM job_titles WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (jobTitleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 })
    }

    const body = await request.json()

    if (!body.entitlement_type?.trim()) {
      return NextResponse.json({ error: 'Entitlement type is required' }, { status: 400 })
    }
    if (!body.resource_name?.trim()) {
      return NextResponse.json({ error: 'Resource name is required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO job_title_entitlements (
        job_title_id, organization_id, entitlement_type, resource_id, resource_name,
        requires_approval, approval_workflow_id, service_category,
        default_assignee_type, default_assignee_id,
        task_title, task_description, is_required, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id,
      orgId,
      body.entitlement_type.trim(),
      body.resource_id || null,
      body.resource_name.trim(),
      body.requires_approval ?? false,
      body.approval_workflow_id || null,
      body.service_category?.trim() || null,
      body.default_assignee_type?.trim() || 'it_admin',
      body.default_assignee_id || null,
      body.task_title?.trim() || null,
      body.task_description?.trim() || null,
      body.is_required ?? true,
      body.sort_order ?? 0,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating entitlement:', error)
    return NextResponse.json({ error: 'Failed to create entitlement' }, { status: 500 })
  }
}
