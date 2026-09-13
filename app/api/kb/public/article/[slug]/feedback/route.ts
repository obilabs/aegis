/**
 * Public KB Article Feedback API
 *
 * Allows anonymous feedback on public articles
 * Scoped to single-tenant org
 */

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { getClientIp } from '@/lib/audit'
import { createFixedWindowLimiter } from '@/lib/rate-limit'
import { z } from 'zod'

// Unauthenticated endpoint: bound body size and per-IP request rate.
const FEEDBACK_LIMIT_PER_HOUR = 20
const feedbackLimiter = createFixedWindowLimiter({ windowMs: 60 * 60 * 1000 })

const feedbackSchema = z.object({
  is_helpful: z.boolean(),
  feedback_text: z.string().trim().max(2000).optional().nullable(),
  feedback_category: z.string().trim().max(50).optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // nginx sets X-Real-IP from the socket address, so prefer it.
    const ip = getClientIp(request.headers) || 'unknown'
    if (!feedbackLimiter.hit(`kb-feedback:${ip}`, FEEDBACK_LIMIT_PER_HOUR)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '3600' } }
      )
    }

    if (slug.length > 255) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const parsed = feedbackSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
    }
    const { is_helpful, feedback_text, feedback_category } = parsed.data

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
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500)

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
