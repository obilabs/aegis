import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapability } from '@/lib/permissions'

/**
 * GET /api/portal/reports/compliance
 * Returns per-policy aggregate compliance data.
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
    // Total active users in organization
    const userCountResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE organization_id = $1 AND status = 'active'`,
      [orgId]
    )
    const totalUsers = parseInt(userCountResult.rows[0].total, 10)

    // Per-policy acknowledgment data
    const policies = await pool.query(
      `SELECT
         a.id,
         a.title,
         a.slug,
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
       GROUP BY a.id, a.title, a.slug, a.tags, a.content_version, a.updated_at
       ORDER BY a.title`,
      [orgId]
    )

    const data = policies.rows.map((row) => {
      const ackCount = parseInt(row.ack_count as string, 10)
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        tags: row.tags || [],
        version: row.content_version,
        updated_at: row.updated_at,
        total_users: totalUsers,
        acknowledged_count: ackCount,
        percentage: totalUsers > 0 ? Math.round((ackCount / totalUsers) * 100) : 0,
      }
    })

    return NextResponse.json({
      policies: data,
      total_users: totalUsers,
      total_policies: data.length,
      overall_percentage: data.length > 0 && totalUsers > 0
        ? Math.round(data.reduce((sum, p) => sum + p.percentage, 0) / data.length)
        : 0,
    })
  } catch (error) {
    console.error('Compliance report failed:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
