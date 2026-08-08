/**
 * Public KB Article Feedback API
 *
 * Allows anonymous feedback on public articles
 * Scoped to single-tenant org
 */

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { is_helpful, feedback_text, feedback_category } = body

    let orgId: string
    try {
      orgId = await getOrgId()
    } catch {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Get the article ID
    const articleResult = await pool.query(`
      SELECT id FROM kb_articles
      WHERE organization_id = $1
        AND slug = $2
        AND status = 'published'
        AND visibility = 'public'
    `, [orgId, slug])

    if (articleResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    const articleId = articleResult.rows[0].id

    // Get client info
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Generate a session ID for anonymous tracking (based on IP + user agent hash)
    const sessionId = Buffer.from(`${ip}-${userAgent}`).toString('base64').slice(0, 32)

    // Check if this session already submitted feedback
    const existingFeedback = await pool.query(`
      SELECT id FROM kb_article_feedback 
      WHERE article_id = $1 AND session_id = $2
    `, [articleId, sessionId])

    if (existingFeedback.rows.length > 0) {
      return NextResponse.json(
        { error: 'Feedback already submitted' },
        { status: 409 }
      )
    }

    // Insert feedback
    await pool.query(`
      INSERT INTO kb_article_feedback (
        article_id, session_id, is_helpful, feedback_text, feedback_category,
        source, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, 'public_kb', $6, $7)
    `, [articleId, sessionId, is_helpful, feedback_text || null, feedback_category || null, ip, userAgent])

    // Update article counts
    if (is_helpful) {
      await pool.query(`
        UPDATE kb_articles SET helpful_count = helpful_count + 1 WHERE id = $1
      `, [articleId])
    } else {
      await pool.query(`
        UPDATE kb_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = $1
      `, [articleId])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to submit feedback:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
