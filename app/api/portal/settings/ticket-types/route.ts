import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(
      `SELECT id, name, description, icon, color, default_priority,
              requires_approval, is_active AS is_visible, description_template,
              required_fields, sla_response_minutes, sla_resolution_minutes,
              display_order, created_at, updated_at
       FROM ticket_types
       WHERE organization_id = $1
       ORDER BY display_order ASC, name ASC`,
      [orgId]
    )

    return NextResponse.json({ types: result.rows })
  } catch (error) {
    console.error('Error fetching ticket types:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket types' }, { status: 500 })
  }
}
