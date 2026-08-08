import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

/**
 * Helper to get the contact_id linked to a user, if any.
 */
async function getUserContactId(userId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT contact_id FROM users WHERE id = $1',
    [userId]
  )
  return result.rows[0]?.contact_id || null
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const contactId = await getUserContactId(userId)

  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const categorySlug = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    // If no query but has category, use search_kb_articles_for_user with empty query
    // to return all visible articles (including private ones the user is entitled to)
    if (!query.trim() && categorySlug) {
      // Get category ID from slug
      const catResult = await pool.query(
        'SELECT id, name, slug, description, icon FROM kb_categories WHERE organization_id = $1 AND slug = $2',
        [orgId, categorySlug]
      )
      const category = catResult.rows[0] || null
      const categoryId = category?.id || null

      // Use the function which handles all visibility logic including private
      const result = await pool.query(`
        SELECT * FROM search_kb_articles_for_user($1, NULL, $2, $3, $4, $5)
      `, [orgId, userId, contactId, categoryId, limit])

      // Get org industry for policy filtering
      const orgResult = await pool.query(
        "SELECT settings->>'industry' as industry FROM organizations WHERE id = $1",
        [orgId]
      )

      return NextResponse.json({
        articles: result.rows,
        category,
        total: result.rows.length,
        org_industry: orgResult.rows[0]?.industry || null,
      })
    }

    if (!query.trim()) {
      return NextResponse.json({ articles: [], total: 0 })
    }

    // Use search_kb_articles_for_user for text search — it handles all visibility
    // including private article scoping via structured FK matching
    const result = await pool.query(`
      SELECT * FROM search_kb_articles_for_user($1, $2, $3, $4, NULL, $5)
    `, [orgId, query, userId, contactId, limit])

    const articles = result.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary,
      category_name: r.category_name,
      category_slug: null,
      view_count: r.view_count || 0,
      helpful_ratio: r.helpful_ratio,
      relevance_score: r.relevance_score,
      visibility: r.visibility,
    }))

    return NextResponse.json({
      articles,
      query,
      total: articles.length,
    })
  } catch (error) {
    console.error('KB search failed:', error)
    return NextResponse.json({ error: 'Search failed', articles: [] }, { status: 500 })
  }
}
