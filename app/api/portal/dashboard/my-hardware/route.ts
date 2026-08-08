import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'

/**
 * GET /api/portal/dashboard/my-hardware
 * Returns hardware assets assigned to the current user.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const userId = (session.user as { id: string }).id
  const userEmail = session.user.email

  try {
    // Get assets via contact_id (contact linked by email) or via user_assignments
    const result = await pool.query(`
      SELECT DISTINCT ON (id) id, name, asset_tag, make, model, serial_number, source
      FROM (
        -- Assets directly assigned via contact_id
        SELECT
          a.id,
          a.name,
          a.asset_tag,
          a.make,
          a.model,
          a.serial_number,
          'contact' as source
        FROM assets a
        JOIN contacts ct ON a.contact_id = ct.id AND ct.organization_id = $1
        WHERE a.organization_id = $1
          AND ct.email = $3
          AND a.status IN ('active', 'deployed')
          AND (a.is_deleted IS NULL OR a.is_deleted = false)

        UNION ALL

        -- Assets via user_assignments where resource_type = 'asset'
        SELECT
          a.id,
          COALESCE(a.name, ua.resource_name) as name,
          a.asset_tag,
          a.make,
          a.model,
          a.serial_number,
          'assignment' as source
        FROM user_assignments ua
        LEFT JOIN assets a ON ua.resource_id = a.id AND a.organization_id = $1
        WHERE ua.organization_id = $1
          AND ua.user_id = $2
          AND ua.resource_type = 'asset'
          AND ua.status = 'active'
      ) combined
      ORDER BY id, source
      LIMIT 20
    `, [orgId, userId, userEmail])

    return NextResponse.json({
      hardware: result.rows,
      total: result.rows.length,
    })
  } catch (error) {
    console.error('My hardware fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch hardware' }, { status: 500 })
  }
}
