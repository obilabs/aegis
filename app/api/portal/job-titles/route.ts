import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(`
      SELECT jt.id, jt.name, jt.department, jt.description
      FROM job_titles jt
      WHERE jt.organization_id = $1 AND jt.is_active = true
      ORDER BY jt.name ASC
    `, [orgId])

    return NextResponse.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching job titles:', error)
    return NextResponse.json({ error: 'Failed to fetch job titles' }, { status: 500 })
  }
}
