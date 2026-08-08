/**
 * Users API for Settings
 *
 * Lists users for pickers in other settings surfaces (KB contributors, etc.).
 *
 * Admin-only + org-scoped (audit M2). Previously this was session-only (any
 * authenticated principal), had no `organization_id` filter, and selected
 * non-existent `name`/`role` columns — so it both leaked cross-org and 500'd.
 *
 * (Gate is inlined rather than using lib/require-admin so this fix stays
 * independent of the AI-provider PR that introduces that helper.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const itsmUser = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2 LIMIT 1',
    [session.user.email, orgId]
  )
  if (!itsmUser || !(await isAdmin(itsmUser.id))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) AS name,
         u.email,
         r.name AS role,
         u.created_at
       FROM users u
       LEFT JOIN user_roles r ON r.id = u.role_id
       WHERE u.organization_id = $1
         AND u.status <> 'disabled'
       ORDER BY name ASC`,
      [orgId]
    )

    return NextResponse.json({ users: result.rows })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
