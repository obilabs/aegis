import { auth } from '@/lib/auth'
import { isAdminRequest } from '@/lib/access'
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

    // Check admin role
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await pool.query(
      `SELECT id, entity_type, retention_mode, retention_days, exempt_if_closed, created_at, updated_at
       FROM data_retention_policies
       WHERE organization_id = $1
       ORDER BY entity_type`,
      [orgId]
    )

    return NextResponse.json({ policies: result.rows })
  } catch (error) {
    console.error('Error fetching retention policies:', error)
    return NextResponse.json({ error: 'Failed to fetch retention policies' }, { status: 500 })
  }
}
