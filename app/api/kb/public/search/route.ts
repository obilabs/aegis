/**
 * Public Knowledge Base Search API
 *
 * Searches only public articles (visibility = 'public')
 * No authentication required — scoped to single-tenant org
 */

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const categorySlug = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    let organizationId: string
    try {
      organizationId = await getOrgId()
    } catch {
      return NextResponse.json({ articles: [] })
    }

    // If no query but category slug, list all articles in that category
    if (!query.trim() && categorySlug) {
      const result = await pool.query(`
        SELECT
          a.id,
          a.title,
          a.slug,
          a.summary,
          c.name as category_name,
          c.slug as category_slug,
          a.view_count,
          CASE
            WHEN (a.helpful_count + a.not_helpful_count) > 0
            THEN ROUND(a.helpful_count::DECIMAL * 100 / (a.helpful_count + a.not_helpful_count), 1)
            ELSE NULL
          END as helpful_ratio,
          a.published_at
        FROM kb_articles a
        LEFT JOIN kb_categories c ON a.category_id = c.id
        WHERE a.organization_id = $1
          AND a.status = 'published'
          AND a.visibility = 'public'
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
          AND c.slug = $2
        ORDER BY a.view_count DESC, a.published_at DESC NULLS LAST
        LIMIT $3
      `, [organizationId, categorySlug, limit])

      return NextResponse.json({
        articles: result.rows,
        query: '',
        total: result.rows.length,
      })
    }

    if (!query.trim()) {
      return NextResponse.json({ articles: [] })
    }

    // Search public articles using full-text search
    const result = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        c.name as category_name,
        c.slug as category_slug,
        a.view_count,
        CASE
          WHEN (a.helpful_count + a.not_helpful_count) > 0
          THEN ROUND(a.helpful_count::DECIMAL * 100 / (a.helpful_count + a.not_helpful_count), 1)
          ELSE NULL
        END as helpful_ratio,
        ts_rank(
          to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, '') || ' ' || coalesce(a.summary, '')),
          plainto_tsquery('english', $1)
        ) as relevance_score
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = $2
        AND a.status = 'published'
        AND a.visibility = 'public'
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ($3::text IS NULL OR c.slug = $3)
        AND (
          to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, '') || ' ' || coalesce(a.summary, ''))
          @@ plainto_tsquery('english', $1)
          OR a.title ILIKE '%' || $1 || '%'
          OR a.summary ILIKE '%' || $1 || '%'
        )
      ORDER BY relevance_score DESC, a.view_count DESC
      LIMIT $4
    `, [query, organizationId, categorySlug, limit])

    return NextResponse.json({
      articles: result.rows,
      query,
      total: result.rows.length,
    })
  } catch (error) {
    console.error('KB search failed:', error)
    return NextResponse.json(
      { error: 'Search failed', articles: [] },
      { status: 500 }
    )
  }
}
