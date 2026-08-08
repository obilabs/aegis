import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getUserPermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/ticket-types
 *
 * Returns active ticket types for the organization.
 * Role-filtered: end users only see Incident + Service Request.
 * Agents/admins see all 4 types.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the ITSM user to find org + permissions
    const user = await query<{
      id: string
      organization_id: string
    }>(
      'SELECT id, organization_id FROM users WHERE email = $1 LIMIT 1',
      [session.user.email]
    )

    if (user.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id: userId, organization_id: orgId } = user[0]
    const perms = await getUserPermissions(userId)

    // Get all active ticket types for this org
    const types = await query<{
      id: string
      name: string
      description: string
      icon: string
      color: string
      default_priority: string
      requires_approval: boolean
      description_template: string | null
      required_fields: unknown[]
      sla_response_minutes: number | null
      sla_resolution_minutes: number | null
      display_order: number
    }>(
      `SELECT id, name, description, icon, color, default_priority,
              requires_approval, description_template, required_fields,
              sla_response_minutes, sla_resolution_minutes, display_order
       FROM ticket_types
       WHERE organization_id = $1 AND is_active = true
       ORDER BY display_order ASC`,
      [orgId]
    )

    // Role filtering: end users only see Incident + Service Request
    const isEndUser = perms.ticketAccess === 'own' && !perms.adminAccess
    const filtered = types.map(t => ({
      ...t,
      is_visible: isEndUser
        ? ['Incident', 'Service Request'].includes(t.name)
        : true,
    }))

    return NextResponse.json({ types: filtered })
  } catch (error) {
    console.error('Error fetching ticket types:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket types' }, { status: 500 })
  }
}
