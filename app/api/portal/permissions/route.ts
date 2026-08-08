import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { getUserPermissions } from '@/lib/permissions'
import { NextResponse } from 'next/server'

/**
 * GET /api/portal/permissions
 *
 * Returns the current user's RBAC permissions. Used by the portal layout
 * to determine sidebar navigation visibility.
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itsmUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )

    if (!itsmUser) {
      // User exists in auth but not in ITSM users — treat as end user
      return NextResponse.json({
        capabilities: [],
        ticketAccess: 'own',
        adminAccess: false,
      })
    }

    const perms = await getUserPermissions(itsmUser.id)

    return NextResponse.json({
      capabilities: perms.capabilities,
      ticketAccess: perms.ticketAccess,
      adminAccess: perms.adminAccess,
    })
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}
