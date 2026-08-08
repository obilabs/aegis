import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'

/**
 * GET /api/portal/dashboard/preference
 * Returns user's dashboard view preference and permission level.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const userId = (session.user as { id: string }).id

  try {
    const result = await pool.query(`
      SELECT
        u.dashboard_view_preference,
        u.first_name,
        u.last_name,
        r.permissions
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE u.organization_id = $1 AND u.email = $2
      LIMIT 1
    `, [orgId, session.user.email])

    const user = result.rows[0]
    if (!user) {
      return NextResponse.json({
        view: 'my-hub',
        ticket_access: 'own',
        user_name: session.user.name || 'User',
      })
    }

    const permissions = user.permissions || {}
    const ticketAccess = ['own', 'team', 'all'].includes(permissions.ticket_access)
      ? permissions.ticket_access
      : 'own'

    return NextResponse.json({
      view: user.dashboard_view_preference || (ticketAccess === 'own' ? 'my-hub' : 'ops'),
      ticket_access: ticketAccess,
      can_switch: ticketAccess !== 'own',
      user_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || session.user.name || 'User',
    })
  } catch (error) {
    console.error('Dashboard preference fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch preference' }, { status: 500 })
  }
}

/**
 * POST /api/portal/dashboard/preference
 * Update user's dashboard view preference.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const body = await request.json()
    const { view } = body

    if (!['my-hub', 'ops'].includes(view)) {
      return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
    }

    await pool.query(
      `UPDATE users SET dashboard_view_preference = $1
       WHERE organization_id = $2 AND email = $3`,
      [view, orgId, session.user.email]
    )

    return NextResponse.json({ success: true, view })
  } catch (error) {
    console.error('Dashboard preference update error:', error)
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 })
  }
}
