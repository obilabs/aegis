/**
 * requireAdmin — route guard for admin-only internal (session-auth) routes.
 *
 * Centralizes the session → ITSM user → `isAdmin` resolution so every
 * admin-only mutation gates the same way (audit C1/C2/M1/M2). Returns the
 * resolved `{ userId, orgId }` on success, or a NextResponse (401/403/404)
 * to return directly.
 *
 * For routes that already resolved the user via `getAuthContext` (which
 * yields `userId`), gate inline with `isAdmin(userId)` instead — no need to
 * re-resolve.
 *
 * Usage:
 *   const admin = await requireAdmin(request)
 *   if (admin instanceof NextResponse) return admin
 *   // admin.userId / admin.orgId are available
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getOrgId } from '@/lib/org'
import { queryOne } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'

export interface AdminContext {
  userId: string
  orgId: string
}

export async function requireAdmin(
  request: NextRequest,
): Promise<AdminContext | NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const user = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2 LIMIT 1',
    [session.user.email, orgId],
  )
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return { userId: user.id, orgId }
}
