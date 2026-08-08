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

    const jobTitleResult = await pool.query(`
      SELECT jt.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM job_titles jt
      LEFT JOIN users u ON jt.created_by = u.id
      WHERE jt.id = $1 AND jt.organization_id = $2
    `, [id, orgId])

    if (jobTitleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 })
    }

    const entitlementsResult = await pool.query(`
      SELECT *
      FROM job_title_entitlements
      WHERE job_title_id = $1 AND organization_id = $2
      ORDER BY sort_order ASC, created_at ASC
    `, [id, orgId])

    return NextResponse.json({
      jobTitle: jobTitleResult.rows[0],
      entitlements: entitlementsResult.rows,
    })
  } catch (error) {
    console.error('Error fetching job title:', error)
    return NextResponse.json({ error: 'Failed to fetch job title' }, { status: 500 })
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
    if (body.department !== undefined) {
      updates.push(`department = $${paramIndex++}`)
      values.push(body.department?.trim() || null)
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(body.description?.trim() || null)
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
      `UPDATE job_titles SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A job title with this name already exists' }, { status: 409 })
    }
    console.error('Error updating job title:', error)
    return NextResponse.json({ error: 'Failed to update job title' }, { status: 500 })
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
      `DELETE FROM job_titles WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting job title:', error)
    return NextResponse.json({ error: 'Failed to delete job title' }, { status: 500 })
  }
}
