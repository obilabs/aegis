import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const params = request.nextUrl.searchParams
  const from = params.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = params.get('to') || new Date().toISOString().split('T')[0]

  try {
    // By status
    const byStatus = await query(
      `SELECT ts.name AS status, ts.mapped_state, ts.color, COUNT(*)::int AS count
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')
       GROUP BY ts.name, ts.mapped_state, ts.color
       ORDER BY count DESC`,
      [orgId, from, to]
    )

    // By priority
    const byPriority = await query(
      `SELECT t.priority, COUNT(*)::int AS count
       FROM tickets t
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')
       GROUP BY t.priority
       ORDER BY count DESC`,
      [orgId, from, to]
    )

    // By type
    const byType = await query(
      `SELECT COALESCE(tt.name, 'Untyped') AS type, COUNT(*)::int AS count
       FROM tickets t
       LEFT JOIN ticket_types tt ON t.type_id = tt.id
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')
       GROUP BY tt.name
       ORDER BY count DESC`,
      [orgId, from, to]
    )

    // Totals
    const totals = await query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ts.mapped_state = 'open')::int AS open,
        COUNT(*) FILTER (WHERE ts.mapped_state = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE ts.mapped_state = 'closed')::int AS closed,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)::numeric, 1) AS avg_resolution_hours
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')`,
      [orgId, from, to]
    )

    // Daily trend
    const dailyTrend = await query(
      `SELECT DATE(t.created_at) AS date, COUNT(*)::int AS created,
        COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL)::int AS resolved
       FROM tickets t
       WHERE t.organization_id = $1
         AND t.created_at >= $2 AND t.created_at <= ($3::date + interval '1 day')
       GROUP BY DATE(t.created_at)
       ORDER BY date`,
      [orgId, from, to]
    )

    return NextResponse.json({
      report: {
        period: { from, to },
        totals: totals[0] || { total: 0, open: 0, in_progress: 0, closed: 0, avg_resolution_hours: null },
        byStatus,
        byPriority,
        byType,
        dailyTrend,
      },
    })
  } catch (error) {
    console.error('Failed to generate ticket summary:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
