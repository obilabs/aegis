import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapability } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'

/**
 * GET /api/portal/reports/compliance/export
 * Returns CSV download of compliance data.
 * Requires 'reports' capability.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  const canReport = await hasCapability(userId, 'reports')
  if (!canReport) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const userCountResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE organization_id = $1 AND status = 'active'`,
      [orgId]
    )
    const totalUsers = parseInt(userCountResult.rows[0].total, 10)

    const policies = await pool.query(
      `SELECT
         a.title,
         a.tags,
         a.content_version,
         a.updated_at,
         COUNT(DISTINCT ack.user_id) FILTER (
           WHERE ack.article_version >= a.content_version
             AND ack.acknowledged_at > NOW() - INTERVAL '12 months'
         ) as ack_count
       FROM kb_articles a
       LEFT JOIN kb_article_acknowledgments ack ON ack.article_id = a.id
       WHERE a.organization_id = $1
         AND a.requires_acknowledgment = true
         AND a.status = 'published'
         AND a.is_deleted = false
       GROUP BY a.id, a.title, a.tags, a.content_version, a.updated_at
       ORDER BY a.title`,
      [orgId]
    )

    // Build CSV
    const headers = ['Policy', 'Framework Tags', 'Version', 'Last Updated', 'Total Users', 'Acknowledged', 'Percentage']
    const rows = policies.rows.map((row) => {
      const ackCount = parseInt(row.ack_count as string, 10)
      const pct = totalUsers > 0 ? Math.round((ackCount / totalUsers) * 100) : 0
      return [
        escapeCsvField(row.title as string),
        escapeCsvField((row.tags || []).join('; ')),
        row.content_version,
        new Date(row.updated_at as string).toISOString().split('T')[0],
        totalUsers,
        ackCount,
        `${pct}%`,
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\r\n')
    const date = new Date().toISOString().split('T')[0]

    logAudit({
      orgId, userId, action: 'compliance_exported', actionCategory: 'export',
      entityType: 'reports', entityName: `compliance-report-${date}.csv`,
      newValues: { policyCount: policies.rows.length, totalUsers },
      actorIp: getClientIp(request.headers),
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="compliance-report-${date}.csv"`,
      },
    })
  } catch (error) {
    console.error('Compliance CSV export failed:', error)
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
