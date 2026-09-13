import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'

/**
 * GET /api/portal/dashboard/my-software
 * Returns software assigned to the current user via user_service_access or user_assignments.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  // App users.id (UUID) resolved from the session email; session.user.id is the
  // Better Auth id (not a UUID) and made every My Hub widget fail.
  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) {
    return NextResponse.json({ error: 'No application user for this session' }, { status: 403 })
  }
  const userEmail = session.user.email

  try {
    // Get software from user_service_access (via contact_id lookup by email)
    // and from user_assignments where resource_type = 'software'
    const result = await pool.query(`
      SELECT DISTINCT ON (name) name, source, license_type, access_level, granted_at
      FROM (
        -- From user_service_access (linked via contact)
        SELECT
          s.name,
          'service_access' as source,
          usa.license_type,
          usa.access_level,
          usa.granted_at
        FROM user_service_access usa
        JOIN services s ON usa.service_id = s.id AND s.organization_id = $1
        JOIN contacts ct ON usa.contact_id = ct.id AND ct.organization_id = $1
        WHERE ct.email = $3
          AND usa.revoked_at IS NULL
          AND (usa.expires_at IS NULL OR usa.expires_at > NOW())

        UNION ALL

        -- From user_assignments where resource_type = 'software'
        SELECT
          ua.resource_name as name,
          'assignment' as source,
          NULL as license_type,
          NULL as access_level,
          ua.assigned_at as granted_at
        FROM user_assignments ua
        WHERE ua.organization_id = $1
          AND ua.user_id = $2
          AND ua.resource_type = 'software'
          AND ua.status = 'active'
      ) combined
      ORDER BY name, granted_at DESC
      LIMIT 20
    `, [orgId, userId, userEmail])

    return NextResponse.json({
      software: result.rows,
      total: result.rows.length,
    })
  } catch (error) {
    console.error('My software fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch software' }, { status: 500 })
  }
}
