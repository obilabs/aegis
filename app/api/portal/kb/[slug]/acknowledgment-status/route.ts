import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

/**
 * GET /api/portal/kb/[slug]/acknowledgment-status
 * Returns the current user's acknowledgment status for a policy article.
 * Includes: whether acknowledged, whether still valid (within 12 months),
 * whether the article has been updated since last acknowledgment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const { userId, orgId } = ctx

  try {
    // Get the article + audience check (policy-audience migration 081):
    // a user only owes acknowledgment if they're in the audience. Users
    // outside the audience see the article (read-visibility) but don't
    // see the acknowledgment prompt — `requires_acknowledgment: false`
    // surfaces here as "no ack required FROM YOU."
    const article = await pool.query(
      `SELECT id, content_version, requires_acknowledgment,
              kb_article_owes(id, $3) AS owes
       FROM kb_articles
       WHERE organization_id = $1 AND slug = $2 AND is_deleted = false`,
      [orgId, slug, userId]
    )

    if (article.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const { id: articleId, content_version, requires_acknowledgment, owes } = article.rows[0]

    if (!requires_acknowledgment || !owes) {
      return NextResponse.json({
        requires_acknowledgment: false,
        acknowledged: false,
        valid: false,
      })
    }

    // Get the latest acknowledgment for this user on this article
    const ack = await pool.query(
      `SELECT article_version, acknowledged_at
       FROM kb_article_acknowledgments
       WHERE article_id = $1 AND user_id = $2
       ORDER BY acknowledged_at DESC
       LIMIT 1`,
      [articleId, userId]
    )

    if (ack.rows.length === 0) {
      return NextResponse.json({
        requires_acknowledgment: true,
        acknowledged: false,
        valid: false,
        version_current: content_version,
      })
    }

    const { article_version: ackedVersion, acknowledged_at } = ack.rows[0]
    const ackedDate = new Date(acknowledged_at)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const isCurrentVersion = ackedVersion >= content_version
    const isWithinValidity = ackedDate > twelveMonthsAgo
    const valid = isCurrentVersion && isWithinValidity

    return NextResponse.json({
      requires_acknowledgment: true,
      acknowledged: true,
      valid,
      acknowledged_at: acknowledged_at,
      acknowledged_version: ackedVersion,
      version_current: content_version,
      needs_reack: !isCurrentVersion,
      expired: !isWithinValidity,
    })
  } catch (error) {
    console.error('Acknowledgment status failed:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
