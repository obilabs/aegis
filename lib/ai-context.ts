/**
 * Unified AI Context Builder
 *
 * Single entry point for all AI context retrieval. Searches KB articles,
 * tickets, and contacts using hybrid search, respects data access policies,
 * formats results for AI system prompts, and logs all access for audit.
 *
 * Replaces the inline searchKBForContext() in the chat route.
 */

import { query, queryOne } from './db'
import { hybridSearch, SearchResult, SearchTable } from './hybrid-search'
import type { AccessContext } from './access-context'
import { legacyContextLevel, type LegacyContextLevel } from './ai-chat-security'
import { estimateTokens } from './chunking'

export type ContextSource = 'kb' | 'tickets' | 'contacts'

export interface ContextParams {
  query: string
  organizationId: string
  accessContext: AccessContext
  sessionId?: string
  userId?: string
  contactId?: string
  sources?: ContextSource[]
  maxResults?: number
  maxTokens?: number
}

export interface AIContextSource {
  title: string
  type: ContextSource
  url: string
  id: string
}

export interface AIContext {
  systemContextBlock: string
  sources: AIContextSource[]
  searchMetrics: {
    ftsResults: number
    vectorResults: number
    hybridResults: number
    sourcesSearched: string[]
  }
}

// Map context source names to search table names
const SOURCE_TABLE_MAP: Record<ContextSource, SearchTable> = {
  kb: 'kb_articles',
  tickets: 'tickets',
  contacts: 'contacts',
}

// Default sources per legacy context-level encoding (used for routing only;
// the AccessContext primary type still drives policy lookups).
const DEFAULT_SOURCES: Record<LegacyContextLevel, ContextSource[]> = {
  end_user: ['kb'],
  technician: ['kb', 'tickets', 'contacts'],
  admin: ['kb', 'tickets', 'contacts'],
  provider: ['kb', 'tickets'],
}

/**
 * Build AI context by searching multiple sources with hybrid search.
 * Respects data access policies and formats results for AI prompts.
 */
export async function buildAIContext(params: ContextParams): Promise<AIContext> {
  const {
    query: searchQuery,
    organizationId,
    accessContext,
    sessionId,
    maxResults = 5,
    maxTokens = 3000,
  } = params
  const legacyLevel = legacyContextLevel(accessContext)
  const sources = params.sources ?? DEFAULT_SOURCES[legacyLevel]

  const allResults: SearchResult[] = []
  const sourcesSearched: string[] = []
  let totalFts = 0
  let totalVector = 0

  for (const source of sources) {
    const table = SOURCE_TABLE_MAP[source]

    // Check data access policy
    const policy = await getAccessPolicy(organizationId, legacyLevel, table)
    if (!policy || !policy.canSearch) {
      // Log denied access
      if (sessionId) {
        await logAccess(sessionId, table, 'search', searchQuery, 0, false, 'Search not permitted for ' + legacyLevel + ' context')
      }
      continue
    }

    // For KB articles with user context, use search_kb_articles_for_user
    // to properly resolve private article visibility via structured FK matching
    if (table === 'kb_articles' && (params.userId || params.contactId)) {
      const kbResults = await query<{
        id: string
        title: string
        summary: string
        slug: string
        category_name: string
        visibility: string
        relevance_score: number
        view_count: number
      }>(
        `SELECT id, title, COALESCE(summary, '') as summary, slug,
                COALESCE(category_name, 'Uncategorized') as category_name,
                visibility, relevance_score, view_count
         FROM search_kb_articles_for_user($1, $2, $3, $4, NULL, $5)`,
        [organizationId, searchQuery, params.userId || null, params.contactId || null, maxResults]
      )

      for (const r of kbResults) {
        totalFts++
        allResults.push({
          id: r.id,
          title: r.title,
          excerpt: r.summary,
          table: 'kb_articles',
          score: r.relevance_score || 0,
          metadata: {
            slug: r.slug,
            categorySlug: r.category_name,
            url: `/portal/kb/${r.slug}`,
            viewCount: r.view_count,
            ftsRank: totalFts,
          },
        })
      }

      sourcesSearched.push(source)

      if (sessionId) {
        await logAccess(sessionId, table, 'search', searchQuery, kbResults.length, true)
      }
      continue
    }

    // Build filters from policy
    const filters: Record<string, any> = {}
    if (table === 'kb_articles' && policy.scopeRestrictions?.visibility) {
      filters.visibility = policy.scopeRestrictions.visibility
    }

    // Run hybrid search for this source. userId scopes ticket retrieval to the
    // caller's ticket_access (getTicketAccessFilter) inside hybridSearch — the
    // AI must not surface tickets the REST API would deny (audit 2026-07-26).
    const results = await hybridSearch({
      query: searchQuery,
      table,
      organizationId,
      limit: maxResults,
      filters,
      userId: params.userId,
    })

    // Track metrics from metadata
    for (const r of results) {
      if (r.metadata.ftsRank) totalFts++
      if (r.metadata.vectorRank) totalVector++
    }

    allResults.push(...results)
    sourcesSearched.push(source)

    // Log successful access
    if (sessionId) {
      await logAccess(sessionId, table, 'search', searchQuery, results.length, true)
    }
  }

  // Build formatted context and sources
  const contextSources: AIContextSource[] = []
  const systemContextBlock = formatContextBlock(allResults, contextSources, maxTokens)

  return {
    systemContextBlock,
    sources: contextSources,
    searchMetrics: {
      ftsResults: totalFts,
      vectorResults: totalVector,
      hybridResults: allResults.length,
      sourcesSearched,
    },
  }
}

/**
 * Format search results into a system prompt context block.
 * Distributes token budget weighted by rank (higher-ranked results get more tokens).
 */
function formatContextBlock(
  results: SearchResult[],
  sourcesOut: AIContextSource[],
  maxTokens: number
): string {
  if (results.length === 0) {
    return '\n\n## Knowledge Base Context\n\nNo relevant articles or records were found for this question. If you cannot confidently answer, suggest the user create a support ticket at /portal/tickets/new.'
  }

  // Group results by source type
  const kbResults = results.filter(r => r.table === 'kb_articles')
  const ticketResults = results.filter(r => r.table === 'tickets')
  const contactResults = results.filter(r => r.table === 'contacts')

  // Distribute token budget proportionally
  const totalResults = results.length
  const sections: string[] = []

  if (kbResults.length > 0) {
    const budget = Math.floor(maxTokens * (kbResults.length / totalResults))
    sections.push(formatKBSection(kbResults, sourcesOut, budget))
  }

  if (ticketResults.length > 0) {
    const budget = Math.floor(maxTokens * (ticketResults.length / totalResults))
    sections.push(formatTicketSection(ticketResults, sourcesOut, budget))
  }

  if (contactResults.length > 0) {
    const budget = Math.floor(maxTokens * (contactResults.length / totalResults))
    sections.push(formatContactSection(contactResults, sourcesOut, budget))
  }

  return '\n\n' + sections.join('\n\n')
}

function formatKBSection(
  results: SearchResult[],
  sourcesOut: AIContextSource[],
  tokenBudget: number
): string {
  const perResultBudget = distributeTokenBudget(results.length, tokenBudget)

  const articles = results.map((r, i) => {
    sourcesOut.push({
      title: r.title,
      type: 'kb',
      url: r.metadata.url || '',
      id: r.id,
    })

    const content = r.matchedChunk || r.excerpt
    const truncated = truncateToTokens(content, perResultBudget[i])

    return `### ${i + 1}. ${r.title}\n- **Link**: ${r.metadata.url}\n- **Content**: ${truncated}`
  }).join('\n\n')

  return `## Knowledge Base Context\n\nThe following KB articles may be relevant. Reference them by title and include their links when applicable.\n\n${articles}`
}

function formatTicketSection(
  results: SearchResult[],
  sourcesOut: AIContextSource[],
  tokenBudget: number
): string {
  const perResultBudget = distributeTokenBudget(results.length, tokenBudget)

  const tickets = results.map((r, i) => {
    sourcesOut.push({
      title: `${r.metadata.ticketNumber}: ${r.title}`,
      type: 'tickets',
      url: r.metadata.url || '',
      id: r.id,
    })

    const truncated = truncateToTokens(r.excerpt, perResultBudget[i])

    return `### ${r.metadata.ticketNumber}: ${r.title}\n- **Status**: ${r.metadata.statusName || 'Unknown'}\n- **Priority**: ${r.metadata.priority || 'Unknown'}\n- **Description**: ${truncated}`
  }).join('\n\n')

  return `## Related Tickets\n\nSimilar past tickets that may provide resolution context.\n\n${tickets}`
}

function formatContactSection(
  results: SearchResult[],
  sourcesOut: AIContextSource[],
  _tokenBudget: number
): string {
  const contacts = results.map((r, i) => {
    sourcesOut.push({
      title: r.title,
      type: 'contacts',
      url: r.metadata.url || '',
      id: r.id,
    })

    return `### ${i + 1}. ${r.title}\n- **Email**: ${r.metadata.email || 'N/A'}\n- **Role**: ${r.metadata.jobTitle || 'N/A'}\n- **Type**: ${r.metadata.contactType || 'N/A'}`
  }).join('\n\n')

  return `## Related Contacts\n\n${contacts}`
}

/**
 * Distribute token budget weighted by rank (first result gets more).
 */
function distributeTokenBudget(count: number, totalTokens: number): number[] {
  if (count === 0) return []
  if (count === 1) return [totalTokens]

  // Weight: first result gets proportionally more
  const weights = Array.from({ length: count }, (_, i) => count - i)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  return weights.map(w => Math.floor((w / totalWeight) * totalTokens))
}

/**
 * Truncate text to approximately the given number of tokens.
 */
function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return ''
  const currentTokens = estimateTokens(text)
  if (currentTokens <= maxTokens) return text

  // Approximate character limit
  const maxChars = maxTokens * 4
  return text.slice(0, maxChars) + '...'
}

/**
 * Get data access policy for a resource type at a given context level.
 */
async function getAccessPolicy(
  organizationId: string,
  legacyLevel: LegacyContextLevel,
  resourceType: string
): Promise<{ canSearch: boolean; scopeRestrictions: Record<string, any> } | null> {
  const policy = await queryOne<{
    can_search: boolean
    scope_restrictions: Record<string, any>
  }>(
    `SELECT can_search, scope_restrictions
     FROM ai_data_access_policies
     WHERE organization_id = $1 AND context_level = $2 AND resource_type = $3`,
    [organizationId, legacyLevel, resourceType]
  )

  if (!policy) {
    // No policy defined — default behavior based on context level
    // End users: KB only (public). Technicians+: all sources.
    if (legacyLevel === 'end_user') {
      return resourceType === 'kb_articles'
        ? { canSearch: true, scopeRestrictions: { visibility: ['public'] } }
        : { canSearch: false, scopeRestrictions: {} }
    }
    // AUTHZ (audit 2026-07-26): a provider/crossOrg actor must NOT get an
    // implicit allow-all when no policy row exists — cross-org access requires
    // an EXPLICIT policy. Deny by default (defense-in-depth; the chat route
    // does not construct a provider context today, so this is latent, but the
    // default must be safe if that ever changes).
    if (legacyLevel === 'provider') {
      return { canSearch: false, scopeRestrictions: {} }
    }
    // Same-org staff (technician/admin): searchable. Ticket retrieval is
    // independently scoped to their ticket_access inside hybridSearch
    // (getTicketAccessFilter); KB goes through the role-aware
    // search_kb_articles_for_user when a user id is present.
    return { canSearch: true, scopeRestrictions: {} }
  }

  return {
    canSearch: policy.can_search,
    scopeRestrictions: policy.scope_restrictions || {},
  }
}

/**
 * Log data access for audit trail.
 */
async function logAccess(
  sessionId: string,
  resourceType: string,
  action: string,
  queryText: string,
  resultsCount: number,
  accessGranted: boolean,
  denialReason?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO ai_chat_data_access_log
       (session_id, resource_type, resource_id, action, query_text, results_count, access_granted, denial_reason)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
      [sessionId, resourceType, action, queryText, resultsCount, accessGranted, denialReason]
    )
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[AIContext] Failed to log data access:', error)
  }
}
