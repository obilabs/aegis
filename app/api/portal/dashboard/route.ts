import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    // Ticket stats
    const ticketStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE ts.base_status = 'open') as open,
        COUNT(*) FILTER (WHERE ts.base_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE ts.base_status = 'closed' AND t.closed_at >= CURRENT_DATE) as closed_today,
        COUNT(*) as total
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE t.organization_id = $1
    `, [orgId])

    // Ticket trend (compare this week vs last week)
    const trendResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE t.created_at >= NOW() - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE t.created_at >= NOW() - INTERVAL '14 days' AND t.created_at < NOW() - INTERVAL '7 days') as last_week
      FROM tickets t
      WHERE t.organization_id = $1
    `, [orgId])

    const thisWeek = parseInt(trendResult.rows[0]?.this_week || '0', 10)
    const lastWeek = parseInt(trendResult.rows[0]?.last_week || '0', 10)
    const trend = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0

    // Asset stats
    const assetStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'deployed' OR status = 'active') as deployed,
        COUNT(*) FILTER (WHERE status = 'available' OR status = 'in_stock') as available,
        COUNT(*) FILTER (WHERE status = 'maintenance' OR status = 'repair') as maintenance
      FROM assets
      WHERE organization_id = $1
    `, [orgId])

    // Service request stats
    const requestStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'pending_approval') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress' OR status = 'approved') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed' OR status = 'fulfilled') as completed
      FROM service_requests
      WHERE organization_id = $1
    `, [orgId])

    // User stats
    const userStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_this_month
      FROM contacts
      WHERE organization_id = $1
    `, [orgId])

    // Recent activity (recent tickets + status changes)
    const recentActivity = await pool.query(`
      (
        SELECT
          t.id,
          'ticket_created' as type,
          'New ticket: ' || t.subject as title,
          COALESCE(c.first_name || ' ' || c.last_name, 'System') as description,
          t.created_at as timestamp,
          t.priority,
          '/portal/tickets/' || t.id as link
        FROM tickets t
        LEFT JOIN contacts c ON t.contact_id = c.id
        WHERE t.organization_id = $1
        ORDER BY t.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT
          t.id,
          CASE WHEN ts.base_status = 'closed' THEN 'ticket_resolved' ELSE 'ticket_created' END as type,
          'Ticket ' || COALESCE(ts.name, 'updated') || ': ' || t.subject as title,
          COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as description,
          t.updated_at as timestamp,
          t.priority,
          '/portal/tickets/' || t.id as link
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.organization_id = $1 AND t.updated_at != t.created_at
        ORDER BY t.updated_at DESC
        LIMIT 5
      )
      ORDER BY timestamp DESC
      LIMIT 10
    `, [orgId])

    return NextResponse.json({
      tickets: {
        open: parseInt(ticketStats.rows[0]?.open || '0', 10),
        pending: parseInt(ticketStats.rows[0]?.pending || '0', 10),
        closedToday: parseInt(ticketStats.rows[0]?.closed_today || '0', 10),
        trend,
      },
      assets: {
        total: parseInt(assetStats.rows[0]?.total || '0', 10),
        deployed: parseInt(assetStats.rows[0]?.deployed || '0', 10),
        available: parseInt(assetStats.rows[0]?.available || '0', 10),
        maintenance: parseInt(assetStats.rows[0]?.maintenance || '0', 10),
      },
      users: {
        total: parseInt(userStats.rows[0]?.total || '0', 10),
        active: parseInt(userStats.rows[0]?.total || '0', 10),
        newThisMonth: parseInt(userStats.rows[0]?.new_this_month || '0', 10),
      },
      requests: {
        total: parseInt(requestStats.rows[0]?.total || '0', 10),
        pending: parseInt(requestStats.rows[0]?.pending || '0', 10),
        inProgress: parseInt(requestStats.rows[0]?.in_progress || '0', 10),
        completed: parseInt(requestStats.rows[0]?.completed || '0', 10),
      },
      activity: recentActivity.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        timestamp: row.timestamp,
        priority: row.priority,
        link: row.link,
      })),
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
