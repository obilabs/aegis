import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

/**
 * GET /api/portal/dashboard/policy-progress
 * Returns the current user's policy acknowledgment progress.
 * Only counts current-version, within-12-month acknowledgments as valid.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  try {
    // Count total policies THIS USER OWES (audience-resolved per policy-audience
    // migration 081). Was previously counting ALL policies in the org regardless
    // of audience — produced wildly inflated denominators.
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM kb_articles a
       WHERE a.organization_id = $1
         AND a.requires_acknowledgment = true
         AND a.status = 'published'
         AND a.is_deleted = false
         AND kb_article_owes(a.id, $2) = true`,
      [orgId, userId]
    )
    const total = parseInt(totalResult.rows[0].total, 10)

    if (total === 0) {
      return NextResponse.json({ total: 0, acknowledged: 0, percentage: 0 })
    }

    // Count policies this user has acknowledged AND still owes (current version, within 12 months)
    const ackResult = await pool.query(
      `SELECT COUNT(DISTINCT a.id) as acknowledged
       FROM kb_articles a
       INNER JOIN kb_article_acknowledgments ack ON ack.article_id = a.id
       WHERE a.organization_id = $1
         AND a.requires_acknowledgment = true
         AND a.status = 'published'
         AND a.is_deleted = false
         AND kb_article_owes(a.id, $2) = true
         AND ack.user_id = $2
         AND ack.article_version >= a.content_version
         AND ack.acknowledged_at > NOW() - INTERVAL '12 months'`,
      [orgId, userId]
    )
    const acknowledged = parseInt(ackResult.rows[0].acknowledged, 10)

    // Get unacknowledged policies for the "View all" list (audience-scoped)
    const unacked = await pool.query(
      `SELECT a.slug, a.title, c.slug as category_slug
       FROM kb_articles a
       LEFT JOIN kb_categories c ON c.id = a.category_id
       WHERE a.organization_id = $1
         AND a.requires_acknowledgment = true
         AND a.status = 'published'
         AND a.is_deleted = false
         AND kb_article_owes(a.id, $2) = true
         AND NOT EXISTS (
           SELECT 1 FROM kb_article_acknowledgments ack
           WHERE ack.article_id = a.id
             AND ack.user_id = $2
             AND ack.article_version >= a.content_version
             AND ack.acknowledged_at > NOW() - INTERVAL '12 months'
         )
       ORDER BY a.title
       LIMIT 5`,
      [orgId, userId]
    )

    return NextResponse.json({
      total,
      acknowledged,
      percentage: Math.round((acknowledged / total) * 100),
      unacknowledged: unacked.rows,
    })
  } catch (error) {
    console.error('Policy progress failed:', error)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}
