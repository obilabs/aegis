import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  // Authorization (audit C1): the vault (including its category structure) is
  // admin-only. Resolve the ITSM user for the session and gate on admin.
  const itsmUser = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2 LIMIT 1',
    [session.user.email, orgId]
  )
  if (!itsmUser || !(await hasCapabilityOrAdmin(itsmUser.id, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  try {
    const categories = await query(
      `SELECT id, name, description, icon, color, display_order
       FROM credential_categories
       WHERE organization_id = $1
       ORDER BY display_order, name`,
      [orgId]
    )

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Failed to fetch credential categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
