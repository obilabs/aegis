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
      `SELECT id, name, description, icon, color, display_order, parent_id, depth
       FROM ticket_categories
       WHERE organization_id = $1 AND is_active = true
       ORDER BY depth ASC, display_order ASC, name ASC`,
      [orgId]
    )

    return NextResponse.json({ categories: result.rows })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
