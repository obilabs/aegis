import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Public (authenticated) endpoint for listing active applications.
 * Used by dynamic form dropdowns (e.g., "Application Access" catalog item).
 */
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
      SELECT id, name, description, icon_url, access_levels, requires_approval, cost_per_license
      FROM applications
      WHERE organization_id = $1 AND is_active = true
      ORDER BY name ASC
    `, [orgId])

    return NextResponse.json({ applications: result.rows })
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}
