import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

/**
 * POST /api/portal/kb/[slug]/acknowledge
 * Records that the current user has read and understood a policy article.
 */
export async function POST(
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
    // Find the article and verify it requires acknowledgment
    const article = await pool.query(
      `SELECT id, content_version, requires_acknowledgment
       FROM kb_articles
       WHERE organization_id = $1 AND slug = $2 AND is_deleted = false`,
      [orgId, slug]
    )

    if (article.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const { id: articleId, content_version, requires_acknowledgment } = article.rows[0]

    if (!requires_acknowledgment) {
      return NextResponse.json({ error: 'This article does not require acknowledgment' }, { status: 400 })
    }

    // Check if already acknowledged for this version
    const existing = await pool.query(
      `SELECT id FROM kb_article_acknowledgments
       WHERE article_id = $1 AND user_id = $2 AND article_version = $3`,
      [articleId, userId, content_version]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({ acknowledged: true, already: true })
    }

    // Get IP and user agent for audit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Insert acknowledgment
    await pool.query(
      `INSERT INTO kb_article_acknowledgments
       (article_id, user_id, ip_address, user_agent, article_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [articleId, userId, ip, userAgent, content_version]
    )

    return NextResponse.json({ acknowledged: true, already: false })
  } catch (error) {
    console.error('Acknowledgment failed:', error)
    return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500 })
  }
}
