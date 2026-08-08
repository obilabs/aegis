import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx

    const result = await pool.query(`
      SELECT
        sp.id,
        sp.provider_id,
        sp.provider_name,
        sp.provider_domain,
        sp.contact_email,
        sp.status,
        sp.contract_type,
        sp.contract_end,
        sp.created_at,
        COALESCE(pu.active_users, 0)::int as active_users,
        COALESCE(al.total_actions_30d, 0)::int as total_actions_30d,
        al.last_activity_at
      FROM service_providers sp
      LEFT JOIN (
        SELECT provider_id, COUNT(*) as active_users
        FROM provider_users
        WHERE organization_id = $1 AND is_active = true
        GROUP BY provider_id
      ) pu ON sp.id = pu.provider_id
      LEFT JOIN (
        SELECT
          provider_name,
          COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '30 days') as total_actions_30d,
          MAX(started_at) as last_activity_at
        FROM provider_action_log
        WHERE organization_id = $1
        GROUP BY provider_name
      ) al ON sp.provider_name = al.provider_name
      WHERE sp.organization_id = $1
      ORDER BY sp.status ASC, sp.provider_name ASC
    `, [orgId])

    // Get access grants for each provider
    const grants = await pool.query(`
      SELECT
        g.id,
        g.provider_id,
        g.name,
        g.permissions,
        g.is_active,
        g.valid_until
      FROM provider_access_grants g
      WHERE g.organization_id = $1
      ORDER BY g.is_active DESC, g.name ASC
    `, [orgId])

    // Group grants by provider_id
    const grantsByProvider: Record<string, typeof grants.rows> = {}
    for (const grant of grants.rows) {
      const pid = grant.provider_id
      if (!grantsByProvider[pid]) grantsByProvider[pid] = []
      grantsByProvider[pid].push(grant)
    }

    // Attach grants to providers
    const providers = result.rows.map(p => ({
      ...p,
      access_grants: grantsByProvider[p.id] || [],
    }))

    logAudit({
      orgId, userId, action: 'providers_viewed', actionCategory: 'view',
      entityType: 'providers', entityName: 'service_providers',
      newValues: { providerCount: providers.length },
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('Error fetching providers:', error)
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
  }
}
