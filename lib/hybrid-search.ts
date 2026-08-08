/**
 * Hybrid Search Module
 *
 * Combines PostgreSQL full-text search (FTS) and pgvector cosine similarity
 * into a single ranked result set using Reciprocal Rank Fusion (RRF).
 *
 * Graceful degradation:
 * - No embeddings exist → FTS only (identical to current behavior)
 * - No embedding provider configured → FTS only
 * - Both available → hybrid RRF merge
 */

import { pool } from './db'
import { generateEmbedding } from './embeddings'
import { getTicketAccessFilter } from './permissions'

export type SearchTable = 'kb_articles' | 'tickets' | 'contacts'

export interface HybridSearchParams {
  query: string
  table: SearchTable
  organizationId: string
  limit?: number
  /**
   * Caller's application user id. REQUIRED for `table: 'tickets'` — the ticket
   * search is scoped to the caller's ticket_access via getTicketAccessFilter,
   * exactly like the REST API. Without it, ticket search fails closed (returns
   * nothing) rather than leaking org-wide tickets through the AI (audit
   * 2026-07-26: AI chat must not be a side-channel around ticket scoping).
   */
  userId?: string
  filters?: {
    visibility?: string[]
    status?: string
    categoryId?: string
  }
}

export interface SearchResult {
  id: string
  title: string
  excerpt: string
  table: SearchTable
  score: number
  matchedChunk?: string
  metadata: Record<string, any>
}

// RRF constant (standard value from the literature)
const RRF_K = 60

/**
 * Run hybrid search: FTS + vector, merged with RRF.
 * Falls back to FTS-only when no embeddings are available.
 */
export async function hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
  const { query, table, organizationId, limit = 10, filters, userId } = params

  if (!query.trim()) return []

  // AUTHZ (audit 2026-07-26): ticket retrieval MUST be scoped to the caller's
  // ticket_access the same way the REST API is (getTicketAccessFilter). Fail
  // closed — a ticket search with no caller identity returns nothing rather
  // than every org ticket. The AI chat is not a side-channel around scoping.
  if (table === 'tickets' && !userId) {
    console.warn('[HybridSearch] ticket search without userId — returning [] (fail-closed)')
    return []
  }

  // Run FTS and vector search in parallel
  const [ftsResults, vectorResults] = await Promise.all([
    ftsSearch(query, table, organizationId, limit * 2, filters, userId),
    vectorSearch(query, table, organizationId, limit * 2, filters, userId),
  ])

  // If no vector results, return FTS only
  if (vectorResults.length === 0) {
    return ftsResults.slice(0, limit)
  }

  // Merge with RRF
  return rrfMerge(ftsResults, vectorResults, limit)
}

/**
 * Full-text search using PostgreSQL to_tsvector/plainto_tsquery.
 */
async function ftsSearch(
  query: string,
  table: SearchTable,
  organizationId: string,
  limit: number,
  filters?: HybridSearchParams['filters'],
  userId?: string
): Promise<SearchResult[]> {
  try {
    switch (table) {
      case 'kb_articles':
        return ftsSearchKBArticles(query, organizationId, limit, filters)
      case 'tickets':
        return ftsSearchTickets(query, organizationId, limit, filters, userId)
      case 'contacts':
        return ftsSearchContacts(query, organizationId, limit)
      default:
        return []
    }
  } catch (error) {
    console.error(`[HybridSearch] FTS error on ${table}:`, error)
    return []
  }
}

async function ftsSearchKBArticles(
  query: string,
  organizationId: string,
  limit: number,
  filters?: HybridSearchParams['filters']
): Promise<SearchResult[]> {
  const visibilityFilter = filters?.visibility?.length
    ? `AND a.visibility = ANY($3)`
    : `AND a.visibility IN ('public', 'internal')`

  const categoryFilter = filters?.categoryId
    ? `AND a.category_id = $${filters?.visibility?.length ? 4 : 3}`
    : ''

  const params: any[] = [organizationId, query]
  if (filters?.visibility?.length) params.push(filters.visibility)
  if (filters?.categoryId) params.push(filters.categoryId)
  params.push(limit)

  const limitParam = `$${params.length}`

  const result = await pool.query(
    `SELECT
      a.id,
      a.title,
      COALESCE(a.summary, LEFT(a.content_plain, 200)) as excerpt,
      a.slug,
      COALESCE(c.slug, 'general') as category_slug,
      a.view_count,
      a.is_system,
      ts_rank(
        to_tsvector('english', COALESCE(a.title::text, '') || ' ' || COALESCE(a.content_plain, '') || ' ' || COALESCE(a.summary, '')),
        plainto_tsquery('english', $2)
      ) as relevance
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.organization_id = $1
      AND a.status = 'published'
      AND a.is_deleted = false
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
      ${visibilityFilter}
      ${categoryFilter}
      AND (
        to_tsvector('english', COALESCE(a.title::text, '') || ' ' || COALESCE(a.content_plain, '') || ' ' || COALESCE(a.summary, ''))
        @@ plainto_tsquery('english', $2)
        OR a.title ILIKE '%' || $2 || '%'
        OR a.summary ILIKE '%' || $2 || '%'
      )
    ORDER BY relevance DESC, a.view_count DESC
    LIMIT ${limitParam}`,
    params
  )

  return result.rows.map((r: any, i: number) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    table: 'kb_articles' as const,
    score: r.relevance,
    metadata: {
      slug: r.slug,
      categorySlug: r.category_slug,
      url: `/portal/kb/${r.category_slug}/${r.slug}`,
      viewCount: r.view_count,
      isSystem: r.is_system,
      ftsRank: i + 1,
    },
  }))
}

async function ftsSearchTickets(
  query: string,
  organizationId: string,
  limit: number,
  filters?: HybridSearchParams['filters'],
  userId?: string
): Promise<SearchResult[]> {
  const statusFilter = filters?.status
    ? `AND ts.base_status = $3`
    : ''

  const params: any[] = [organizationId, query]
  if (filters?.status) params.push(filters.status)

  // AUTHZ: scope to the caller's ticket_access — same predicate as the REST API.
  // hybridSearch guarantees userId is present for ticket searches (fail-closed).
  const access = await getTicketAccessFilter(userId!, organizationId, 't', params.length + 1)
  params.push(...access.params)

  params.push(limit)
  const limitParam = `$${params.length}`

  const result = await pool.query(
    `SELECT
      t.id,
      t.subject as title,
      LEFT(COALESCE(t.description, ''), 200) as excerpt,
      t.prefix,
      t.ticket_number,
      t.priority,
      ts.name as status_name,
      ts_rank(
        to_tsvector('english', COALESCE(t.subject::text, '') || ' ' || COALESCE(t.description, '')),
        plainto_tsquery('english', $2)
      ) as relevance
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
    WHERE t.organization_id = $1
      AND t.is_deleted = false
      ${statusFilter}
      ${access.clause}
      AND (
        to_tsvector('english', COALESCE(t.subject::text, '') || ' ' || COALESCE(t.description, ''))
        @@ plainto_tsquery('english', $2)
        OR t.subject ILIKE '%' || $2 || '%'
      )
    ORDER BY relevance DESC, t.created_at DESC
    LIMIT ${limitParam}`,
    params
  )

  return result.rows.map((r: any, i: number) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    table: 'tickets' as const,
    score: r.relevance,
    metadata: {
      ticketNumber: `${r.prefix}-${r.ticket_number}`,
      priority: r.priority,
      statusName: r.status_name,
      url: `/portal/tickets/${r.id}`,
      ftsRank: i + 1,
    },
  }))
}

async function ftsSearchContacts(
  query: string,
  organizationId: string,
  limit: number
): Promise<SearchResult[]> {
  const result = await pool.query(
    `SELECT
      c.id,
      COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') as title,
      COALESCE(c.email, '') || CASE WHEN c.title IS NOT NULL THEN ' - ' || c.title ELSE '' END as excerpt,
      c.email,
      c.title as job_title,
      c.contact_type,
      ts_rank(
        to_tsvector('english',
          COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') || ' ' ||
          COALESCE(c.email, '') || ' ' || COALESCE(c.notes, '')
        ),
        plainto_tsquery('english', $2)
      ) as relevance
    FROM contacts c
    WHERE c.organization_id = $1
      AND c.is_deleted = false
      AND (
        to_tsvector('english',
          COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') || ' ' ||
          COALESCE(c.email, '') || ' ' || COALESCE(c.notes, '')
        )
        @@ plainto_tsquery('english', $2)
        OR (c.first_name || ' ' || c.last_name) ILIKE '%' || $2 || '%'
        OR c.email ILIKE '%' || $2 || '%'
      )
    ORDER BY relevance DESC
    LIMIT $3`,
    [organizationId, query, limit]
  )

  return result.rows.map((r: any, i: number) => ({
    id: r.id,
    title: r.title.trim(),
    excerpt: r.excerpt,
    table: 'contacts' as const,
    score: r.relevance,
    metadata: {
      email: r.email,
      jobTitle: r.job_title,
      contactType: r.contact_type,
      url: `/portal/contacts/${r.id}`,
      ftsRank: i + 1,
    },
  }))
}

/**
 * Vector similarity search using pgvector cosine distance.
 * Returns empty array if no embedding provider is configured or no embeddings exist.
 */
async function vectorSearch(
  query: string,
  table: SearchTable,
  organizationId: string,
  limit: number,
  filters?: HybridSearchParams['filters'],
  userId?: string
): Promise<SearchResult[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, organizationId)
    if (!queryEmbedding) return []

    const vectorStr = `[${queryEmbedding.join(',')}]`

    switch (table) {
      case 'kb_articles':
        return vectorSearchKBArticles(vectorStr, organizationId, limit, filters)
      case 'tickets':
        return vectorSearchTickets(vectorStr, organizationId, limit, filters, userId)
      case 'contacts':
        return vectorSearchContacts(vectorStr, organizationId, limit)
      default:
        return []
    }
  } catch (error) {
    console.error(`[HybridSearch] Vector search error on ${table}:`, error)
    return []
  }
}

async function vectorSearchKBArticles(
  vectorStr: string,
  organizationId: string,
  limit: number,
  filters?: HybridSearchParams['filters']
): Promise<SearchResult[]> {
  const visibilityFilter = filters?.visibility?.length
    ? `AND a.visibility = ANY($3)`
    : `AND a.visibility IN ('public', 'internal')`

  const params: any[] = [organizationId, vectorStr]
  if (filters?.visibility?.length) params.push(filters.visibility)
  params.push(limit)
  const limitParam = `$${params.length}`

  // Search both article-level and chunk-level embeddings
  const result = await pool.query(
    `WITH article_matches AS (
      SELECT
        a.id,
        a.title,
        COALESCE(a.summary, LEFT(a.content_plain, 200)) as excerpt,
        a.slug,
        COALESCE(c.slug, 'general') as category_slug,
        a.view_count,
        a.is_system,
        (a.embedding <=> $2::vector) as distance,
        NULL as matched_chunk
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = $1
        AND a.status = 'published'
        AND a.is_deleted = false
        AND a.embedding IS NOT NULL
        AND a.embedding_status = 'complete'
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ${visibilityFilter}
    ),
    chunk_matches AS (
      SELECT
        a.id,
        a.title,
        COALESCE(a.summary, LEFT(a.content_plain, 200)) as excerpt,
        a.slug,
        COALESCE(c.slug, 'general') as category_slug,
        a.view_count,
        a.is_system,
        (ch.embedding <=> $2::vector) as distance,
        ch.chunk_text as matched_chunk
      FROM kb_article_chunks ch
      JOIN kb_articles a ON ch.article_id = a.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE ch.organization_id = $1
        AND a.status = 'published'
        AND a.is_deleted = false
        AND ch.embedding IS NOT NULL
        AND ch.embedding_status = 'complete'
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ${visibilityFilter}
    ),
    combined AS (
      SELECT * FROM article_matches
      UNION ALL
      SELECT * FROM chunk_matches
    )
    SELECT DISTINCT ON (id) *
    FROM combined
    ORDER BY id, distance ASC
    LIMIT ${limitParam}`,
    params
  )

  // Sort by distance (ascending = most similar first)
  const sorted = result.rows.sort((a: any, b: any) => a.distance - b.distance)

  return sorted.map((r: any, i: number) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    table: 'kb_articles' as const,
    score: 1 - r.distance, // Convert distance to similarity
    matchedChunk: r.matched_chunk || undefined,
    metadata: {
      slug: r.slug,
      categorySlug: r.category_slug,
      url: `/portal/kb/${r.category_slug}/${r.slug}`,
      viewCount: r.view_count,
      isSystem: r.is_system,
      vectorRank: i + 1,
      cosineDistance: r.distance,
    },
  }))
}

async function vectorSearchTickets(
  vectorStr: string,
  organizationId: string,
  limit: number,
  filters?: HybridSearchParams['filters'],
  userId?: string
): Promise<SearchResult[]> {
  const statusFilter = filters?.status
    ? `AND ts.base_status = $3`
    : ''

  const params: any[] = [organizationId, vectorStr]
  if (filters?.status) params.push(filters.status)

  // AUTHZ: scope to the caller's ticket_access — same predicate as the REST API.
  const access = await getTicketAccessFilter(userId!, organizationId, 't', params.length + 1)
  params.push(...access.params)

  params.push(limit)
  const limitParam = `$${params.length}`

  const result = await pool.query(
    `SELECT
      t.id,
      t.subject as title,
      LEFT(COALESCE(t.description, ''), 200) as excerpt,
      t.prefix,
      t.ticket_number,
      t.priority,
      ts.name as status_name,
      (t.embedding <=> $2::vector) as distance
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
    WHERE t.organization_id = $1
      AND t.is_deleted = false
      AND t.embedding IS NOT NULL
      AND t.embedding_status = 'complete'
      ${statusFilter}
      ${access.clause}
    ORDER BY distance ASC
    LIMIT ${limitParam}`,
    params
  )

  return result.rows.map((r: any, i: number) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    table: 'tickets' as const,
    score: 1 - r.distance,
    metadata: {
      ticketNumber: `${r.prefix}-${r.ticket_number}`,
      priority: r.priority,
      statusName: r.status_name,
      url: `/portal/tickets/${r.id}`,
      vectorRank: i + 1,
      cosineDistance: r.distance,
    },
  }))
}

async function vectorSearchContacts(
  vectorStr: string,
  organizationId: string,
  limit: number
): Promise<SearchResult[]> {
  const result = await pool.query(
    `SELECT
      c.id,
      COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') as title,
      COALESCE(c.email, '') || CASE WHEN c.title IS NOT NULL THEN ' - ' || c.title ELSE '' END as excerpt,
      c.email,
      c.title as job_title,
      c.contact_type,
      (c.embedding <=> $2::vector) as distance
    FROM contacts c
    WHERE c.organization_id = $1
      AND c.is_deleted = false
      AND c.embedding IS NOT NULL
      AND c.embedding_status = 'complete'
    ORDER BY distance ASC
    LIMIT $3`,
    [organizationId, vectorStr, limit]
  )

  return result.rows.map((r: any, i: number) => ({
    id: r.id,
    title: r.title.trim(),
    excerpt: r.excerpt,
    table: 'contacts' as const,
    score: 1 - r.distance,
    metadata: {
      email: r.email,
      jobTitle: r.job_title,
      contactType: r.contact_type,
      url: `/portal/contacts/${r.id}`,
      vectorRank: i + 1,
      cosineDistance: r.distance,
    },
  }))
}

/**
 * Reciprocal Rank Fusion (RRF) merge.
 * Combines two ranked lists without score normalization.
 * Formula: score = 1/(k + rank_fts) + 1/(k + rank_vector)
 */
function rrfMerge(
  ftsResults: SearchResult[],
  vectorResults: SearchResult[],
  limit: number
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>()

  // Add FTS contributions
  ftsResults.forEach((r, i) => {
    const rrfScore = 1 / (RRF_K + i + 1)
    scoreMap.set(r.id, { result: r, rrfScore })
  })

  // Add vector contributions
  vectorResults.forEach((r, i) => {
    const vectorRrfScore = 1 / (RRF_K + i + 1)
    const existing = scoreMap.get(r.id)
    if (existing) {
      // Combine scores — keep the better metadata (vector has matchedChunk)
      existing.rrfScore += vectorRrfScore
      if (r.matchedChunk) {
        existing.result.matchedChunk = r.matchedChunk
      }
      // Merge metadata
      existing.result.metadata = { ...existing.result.metadata, ...r.metadata }
    } else {
      scoreMap.set(r.id, { result: r, rrfScore: vectorRrfScore })
    }
  })

  // Sort by RRF score descending
  return Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map(({ result, rrfScore }) => ({ ...result, score: rrfScore }))
}
