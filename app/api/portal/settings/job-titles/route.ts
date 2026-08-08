import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx

    const result = await pool.query(`
      SELECT jt.*,
        COUNT(jte.id) as entitlement_count,
        jt.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM job_titles jt
      LEFT JOIN job_title_entitlements jte ON jt.id = jte.job_title_id
      LEFT JOIN users u ON jt.created_by = u.id
      WHERE jt.organization_id = $1
      GROUP BY jt.id, u.first_name, u.last_name
      ORDER BY jt.department NULLS LAST, jt.name
    `, [orgId])

    return NextResponse.json({ jobTitles: result.rows })
  } catch (error) {
    console.error('Error fetching job titles:', error)
    return NextResponse.json({ error: 'Failed to fetch job titles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const userId = admin.userId
    const orgId = admin.orgId
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO job_titles (organization_id, name, department, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      orgId,
      body.name.trim(),
      body.department?.trim() || null,
      body.description?.trim() || null,
      userId,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A job title with this name already exists' }, { status: 409 })
    }
    console.error('Error creating job title:', error)
    return NextResponse.json({ error: 'Failed to create job title' }, { status: 500 })
  }
}
