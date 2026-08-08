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
      SELECT
        id, name, description, color, icon,
        base_status, sla_paused, is_default, is_system, is_enabled,
        sort_order, display_order
      FROM ticket_statuses
      WHERE organization_id = $1
      ORDER BY sort_order ASC, display_order ASC, name ASC
    `, [orgId])

    return NextResponse.json({ statuses: result.rows })
  } catch (error) {
    console.error('Error fetching ticket statuses:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket statuses' }, { status: 500 })
  }
}
