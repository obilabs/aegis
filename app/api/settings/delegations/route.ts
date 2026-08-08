import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/settings/delegations
 *
 * Admin view: all active/upcoming delegations across the organization.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx

    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const delegations = await query<{
      id: string
      delegator_name: string
      delegate_name: string
      scope: string
      reason: string | null
      starts_at: Date
      ends_at: Date
      is_active: boolean
      created_at: Date
    }>(
      `SELECT
        d.id, d.scope, d.reason, d.starts_at, d.ends_at,
        d.is_active, d.created_at,
        CONCAT(dr.first_name, ' ', dr.last_name) as delegator_name,
        CONCAT(de.first_name, ' ', de.last_name) as delegate_name
      FROM user_delegations d
      JOIN users dr ON d.delegator_id = dr.id
      JOIN users de ON d.delegate_id = de.id
      WHERE d.organization_id = $1
        AND d.is_active = true
        AND d.ends_at > NOW()
      ORDER BY d.starts_at ASC`,
      [orgId]
    )

    logAudit({
      orgId, userId, action: 'delegations_viewed', actionCategory: 'view',
      entityType: 'delegations',
      newValues: { delegationCount: delegations.length },
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({
      delegations: delegations.map((d) => ({
        id: d.id,
        delegatorName: d.delegator_name?.trim(),
        delegateName: d.delegate_name?.trim(),
        scope: d.scope,
        reason: d.reason,
        startsAt: d.starts_at,
        endsAt: d.ends_at,
        isActive: d.is_active,
        createdAt: d.created_at,
      })),
    })
  } catch (error) {
    console.error('Error fetching delegations:', error)
    return NextResponse.json({ error: 'Failed to fetch delegations' }, { status: 500 })
  }
}
