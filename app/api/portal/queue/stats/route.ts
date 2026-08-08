import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextResponse } from 'next/server'

/**
 * GET /api/portal/queue/stats
 *
 * Queue statistics: counts by action state, base status, SLA breach count, etc.
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    // Counts by action_state
    const actionStateCounts = await query<{ action_state: string; count: string }>(
      `SELECT qs.action_state, COUNT(*) as count
       FROM ticket_queue_scores qs
       JOIN tickets t ON qs.ticket_id = t.id
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE qs.organization_id = $1 AND ts.base_status != 'closed'
       GROUP BY qs.action_state
       ORDER BY count DESC`,
      [orgId]
    )

    // Counts by base_status
    const statusCounts = await query<{ base_status: string; count: string }>(
      `SELECT ts.base_status, COUNT(*) as count
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.organization_id = $1 AND ts.base_status != 'closed'
       GROUP BY ts.base_status`,
      [orgId]
    )

    // Aggregate stats
    const stats = await queryOne<{
      avg_score: string | null
      unassigned_count: string
      sla_breach_count: string
      total_open: string
    }>(
      `SELECT
        AVG(qs.base_score)::NUMERIC(5,1) as avg_score,
        COUNT(*) FILTER (WHERE t.assigned_to IS NULL) as unassigned_count,
        COUNT(*) FILTER (WHERE COALESCE(t.sla_breached, false) = true) as sla_breach_count,
        COUNT(*) as total_open
      FROM tickets t
      JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_queue_scores qs ON t.id = qs.ticket_id
      WHERE t.organization_id = $1 AND ts.base_status != 'closed'`,
      [orgId]
    )

    // Avg time for needs_agent_action tickets
    const agentActionAvg = await queryOne<{ avg_age_hours: string | null }>(
      `SELECT
        AVG(EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600)::NUMERIC(8,1) as avg_age_hours
      FROM tickets t
      JOIN ticket_queue_scores qs ON t.id = qs.ticket_id
      JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE qs.organization_id = $1
        AND qs.action_state = 'needs_agent_action'
        AND ts.base_status = 'open'`,
      [orgId]
    )

    return NextResponse.json({
      actionStateCounts: actionStateCounts.reduce(
        (acc, r) => ({ ...acc, [r.action_state]: parseInt(r.count) }),
        {} as Record<string, number>
      ),
      statusCounts: statusCounts.reduce(
        (acc, r) => ({ ...acc, [r.base_status]: parseInt(r.count) }),
        {} as Record<string, number>
      ),
      avgScore: stats?.avg_score ? parseFloat(stats.avg_score) : null,
      unassignedCount: parseInt(stats?.unassigned_count || '0'),
      slaBreachCount: parseInt(stats?.sla_breach_count || '0'),
      totalOpen: parseInt(stats?.total_open || '0'),
      avgAgentActionAgeHours: agentActionAvg?.avg_age_hours
        ? parseFloat(agentActionAvg.avg_age_hours)
        : null,
    })
  } catch (error) {
    console.error('Error fetching queue stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
