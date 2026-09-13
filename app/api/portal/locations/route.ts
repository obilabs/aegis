import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
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
      SELECT id, name, address, city, state, zip, country, is_primary
      FROM locations
      WHERE organization_id = $1
      ORDER BY is_primary DESC, name ASC
    `, [orgId])

    return NextResponse.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}
