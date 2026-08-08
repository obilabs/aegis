/**
 * Public Knowledge Base API
 *
 * Returns only public articles (visibility = 'public')
 * No authentication required — scoped to single-tenant org
 */

import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET() {
  try {
    let orgId: string
    try {
      orgId = await getOrgId()
    } catch {
      return NextResponse.json({ categories: [], featuredArticles: [] })
    }

    // Get public categories with article counts
    const categoriesResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.icon,
        COUNT(a.id) FILTER (WHERE a.status = 'published' AND a.visibility = 'public') as article_count
      FROM kb_categories c
      LEFT JOIN kb_articles a ON a.category_id = c.id AND a.organization_id = $1
      WHERE c.organization_id = $1
        AND c.is_public = true
      GROUP BY c.id, c.name, c.slug, c.description, c.icon, c.display_order
      HAVING COUNT(a.id) FILTER (WHERE a.status = 'published' AND a.visibility = 'public') > 0
      ORDER BY c.display_order ASC
    `, [orgId])

    // Get popular public articles
    const featuredResult = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        c.name as category_name,
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
      ORDER BY
        a.view_count DESC,
        a.helpful_count DESC,
        a.published_at DESC NULLS LAST
      LIMIT 6
    `, [orgId])

    return NextResponse.json({
      categories: categoriesResult.rows,
      featuredArticles: featuredResult.rows,
    })
  } catch (error) {
    console.error('Failed to fetch public KB:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base' },
      { status: 500 }
    )
  }
}
