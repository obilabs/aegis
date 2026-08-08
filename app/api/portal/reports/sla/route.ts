import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  // Authorization (audit 2026-07-23): SLA reports are a reporting surface.
  const ctx = await getAuthContext(request)
  if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'reports'))) {
    return NextResponse.json({ error: 'Requires reports capability' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const from = params.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = params.get('to') || new Date().toISOString().split('T')[0]

  try {
    // Response SLA compliance
    const responseCompliance = await query(
      `SELECT
        COUNT(*) FILTER (WHERE t.sla_first_response_at IS NOT NULL AND t.sla_first_response_due_at IS NOT NULL
          AND t.sla_first_response_at <= t.sla_first_response_due_at)::int AS response_met,
        COUNT(*) FILTER (WHERE t.sla_first_response_at IS NOT NULL AND t.sla_first_response_due_at IS NOT NULL
          AND t.sla_first_response_at > t.sla_first_response_due_at)::int AS response_breached,
        COUNT(*) FILTER (WHERE t.sla_first_response_due_at IS NOT NULL)::int AS response_total
       FROM tickets t
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')`,
      [orgId, from, to]
    )

    // Resolution SLA compliance
    const resolutionCompliance = await query(
      `SELECT
        COUNT(*) FILTER (WHERE t.sla_resolved_at IS NOT NULL AND t.sla_resolution_due_at IS NOT NULL
          AND t.sla_resolved_at <= t.sla_resolution_due_at)::int AS resolution_met,
        COUNT(*) FILTER (WHERE t.sla_resolved_at IS NOT NULL AND t.sla_resolution_due_at IS NOT NULL
          AND t.sla_resolved_at > t.sla_resolution_due_at)::int AS resolution_breached,
        COUNT(*) FILTER (WHERE t.sla_breached = true)::int AS currently_breached,
        COUNT(*) FILTER (WHERE t.sla_resolution_due_at IS NOT NULL)::int AS resolution_total
       FROM tickets t
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')`,
      [orgId, from, to]
    )

    // By priority breakdown
    const byPriority = await query(
      `SELECT
        t.priority,
        COUNT(*) FILTER (WHERE t.sla_resolution_due_at IS NOT NULL)::int AS total,
        COUNT(*) FILTER (WHERE t.sla_breached = true)::int AS breached,
        ROUND(AVG(EXTRACT(EPOCH FROM (
          COALESCE(t.sla_resolved_at, NOW()) - t.created_at
        )) / 3600)::numeric, 1) AS avg_hours
       FROM tickets t
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')
         AND t.sla_resolution_due_at IS NOT NULL
       GROUP BY t.priority
       ORDER BY
         CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      [orgId, from, to]
    )

    // Recent breaches
    const recentBreaches = await query(
      `SELECT t.id, t.subject, t.priority, t.created_at,
        t.sla_resolution_due_at, t.sla_resolved_at,
        u.name AS assigned_to_name
       FROM tickets t
       LEFT JOIN "user" u ON t.assigned_to::text = u.id
       WHERE t.organization_id = $1
         AND t.sla_breached = true
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [orgId, from, to]
    )

    const resp = responseCompliance[0] || { response_met: 0, response_breached: 0, response_total: 0 }
    const res = resolutionCompliance[0] || { resolution_met: 0, resolution_breached: 0, currently_breached: 0, resolution_total: 0 }

    return NextResponse.json({
      report: {
        period: { from, to },
        response: {
          met: resp.response_met,
          breached: resp.response_breached,
          total: resp.response_total,
          percentage: resp.response_total > 0 ? Math.round((resp.response_met / resp.response_total) * 100) : null,
        },
        resolution: {
          met: res.resolution_met,
          breached: res.resolution_breached,
          currentlyBreached: res.currently_breached,
          total: res.resolution_total,
          percentage: res.resolution_total > 0 ? Math.round((res.resolution_met / res.resolution_total) * 100) : null,
        },
        byPriority,
        recentBreaches,
      },
    })
  } catch (error) {
    console.error('Failed to generate SLA report:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
