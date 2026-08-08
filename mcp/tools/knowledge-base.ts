import { Pool } from 'pg'

export function createKBTools(pool: Pool) {
  return {
    'aegis.kb.search': {
      description: 'Search the Aegis knowledge base for articles matching a query. Returns titles, summaries, and slugs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          category: { type: 'string', description: 'Optional category slug to filter by' },
          limit: { type: 'number', description: 'Max results (default 5, max 20)' },
        },
        required: ['query'],
      },
      execute: async (args: { query: string; category?: string; limit?: number }) => {
        const limit = Math.min(args.limit || 5, 20)
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { articles: [], message: 'No organization found' }

        const result = await pool.query(`
          SELECT
            a.title,
            a.slug,
            a.summary,
            COALESCE(c.slug, 'general') as category_slug,
            c.name as category_name,
            a.view_count,
            CASE
              WHEN (a.helpful_count + a.not_helpful_count) > 0
              THEN ROUND(a.helpful_count::DECIMAL * 100 / (a.helpful_count + a.not_helpful_count), 1)
              ELSE NULL
            END as helpful_ratio,
            a.updated_at
          FROM kb_articles a
          LEFT JOIN kb_categories c ON a.category_id = c.id
          WHERE a.organization_id = $1
            AND a.status = 'published'
            AND a.visibility IN ('public', 'internal')
            AND (a.expires_at IS NULL OR a.expires_at > NOW())
            AND ($3::text IS NULL OR c.slug = $3)
            AND (
              to_tsvector('english', COALESCE(a.title, '') || ' ' || COALESCE(a.content_plain, '') || ' ' || COALESCE(a.summary, ''))
              @@ plainto_tsquery('english', $2)
              OR a.title ILIKE '%' || $2 || '%'
              OR a.summary ILIKE '%' || $2 || '%'
            )
          ORDER BY
            ts_rank(
              to_tsvector('english', COALESCE(a.title, '') || ' ' || COALESCE(a.content_plain, '') || ' ' || COALESCE(a.summary, '')),
              plainto_tsquery('english', $2)
            ) DESC
          LIMIT $4
        `, [orgId, args.query, args.category || null, limit])

        return {
          articles: result.rows,
          total: result.rows.length,
          query: args.query,
        }
      },
    },

    'aegis.kb.get': {
      description: 'Get full details of a knowledge base article by its slug.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Article slug' },
        },
        required: ['slug'],
      },
      execute: async (args: { slug: string }) => {
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { error: 'No organization found' }

        const result = await pool.query(`
          SELECT
            a.title,
            a.slug,
            a.summary,
            a.content_plain as content,
            c.name as category_name,
            c.slug as category_slug,
            a.view_count,
            a.helpful_count,
            a.not_helpful_count,
            a.tags,
            a.published_at,
            a.updated_at
          FROM kb_articles a
          LEFT JOIN kb_categories c ON a.category_id = c.id
          WHERE a.organization_id = $1
            AND a.slug = $2
            AND a.status = 'published'
        `, [orgId, args.slug])

        if (result.rows.length === 0) {
          return { error: 'Article not found' }
        }

        return { article: result.rows[0] }
      },
    },

    'aegis.kb.categories': {
      description: 'List all knowledge base categories with article counts.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { categories: [] }

        const result = await pool.query(`
          SELECT
            c.name,
            c.slug,
            c.description,
            c.icon,
            COUNT(a.id) FILTER (WHERE a.status = 'published' AND a.visibility IN ('public', 'internal')) as article_count
          FROM kb_categories c
          LEFT JOIN kb_articles a ON a.category_id = c.id
          WHERE c.organization_id = $1
          GROUP BY c.id, c.name, c.slug, c.description, c.icon, c.display_order
          ORDER BY c.display_order ASC
        `, [orgId])

        return { categories: result.rows }
      },
    },
  }
}
