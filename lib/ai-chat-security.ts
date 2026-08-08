/**
 * AI Chat Security Layer
 *
 * Ensures the AI chat never leaks unauthorized data. The in-memory model is
 * the orthogonal `AccessContext { depth, crossOrg, delegationChain? }`
 * (auth-foundations Phase 1, D4). The legacy 4-tuple text encoding
 * (`'end_user' | 'technician' | 'admin' | 'provider'`) is kept ONLY at the DB
 * boundary — `ai_chat_sessions.context_level` and `ai_data_access_policies.context_level`
 * are still text columns. The schema squash later this phase replaces those
 * columns with `depth` + `cross_org` + `delegation_chain` and removes
 * `legacyContextLevel`.
 */

import { query, queryOne } from './db'
import type { AccessContext, DepthLevel } from './access-context'

export type { AccessContext, DepthLevel } from './access-context'

/** Legacy DB encoding. Do NOT use in new code paths — call sites should pass AccessContext. */
export type LegacyContextLevel = 'end_user' | 'technician' | 'admin' | 'provider'

export interface ChatSession {
  id: string
  organizationId: string
  userId: string | null
  contactId: string | null
  accessContext: AccessContext
  /** Convenience flag derived from accessContext.delegationChain. */
  providerAccessGrantId: string | null
}

export interface DataAccessPolicy {
  resourceType: string
  canRead: boolean
  canSearch: boolean
  scopeRestrictions: Record<string, unknown>
  redactedFields: string[]
}

/**
 * Map AccessContext to the legacy 4-tuple text encoding for DB lookups.
 * Provider/MSP actors collapse to `'provider'` regardless of their depth —
 * legacy policies are keyed on the 4-tuple. The schema squash will replace
 * this with first-class columns.
 */
export function legacyContextLevel(ac: AccessContext): LegacyContextLevel {
  if (ac.crossOrg) return 'provider'
  return ac.depth
}

/**
 * Decode a legacy 4-tuple text value back into AccessContext. Used when
 * reading sessions persisted under the old schema.
 */
export function accessContextFromLegacy(level: LegacyContextLevel): AccessContext {
  if (level === 'provider') {
    // Old shape didn't carry an explicit depth — provider technicians are the
    // expected default; if a richer encoding is needed it lives in
    // delegationChain (loaded separately from provider_access_grants).
    return { depth: 'technician', crossOrg: true }
  }
  return { depth: level, crossOrg: false }
}

/**
 * Determine the AccessContext for a user based on their role/permissions.
 * `providerAccessGrantId` flips `crossOrg` and is the parent contract.
 */
export async function determineAccessContext(
  userId: string,
  _organizationId: string,
  providerAccessGrantId?: string,
): Promise<AccessContext> {
  const userRole = await queryOne<{ permissions: Record<string, unknown> }>(
    `SELECT r.permissions
     FROM users u
     JOIN user_roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId],
  )

  const depth = depthFromPermissions(userRole?.permissions)

  if (providerAccessGrantId) {
    return {
      depth,
      crossOrg: true,
      // delegationChain is populated by the caller (e.g., createSecureChatSession)
      // once it loads the parent API key + contract scopes. We surface the bare
      // crossOrg flag here; full chain construction needs more context.
    }
  }

  return { depth, crossOrg: false }
}

function depthFromPermissions(p: Record<string, unknown> | undefined): DepthLevel {
  if (!p) return 'end_user'
  if (p.admin_access === true) return 'admin'

  const capabilities = Array.isArray(p.capabilities) ? p.capabilities : []
  if (capabilities.includes('settings') || capabilities.includes('user_management')) {
    return 'admin'
  }
  if (capabilities.includes('triage') || capabilities.includes('bulk_actions')) {
    return 'technician'
  }
  if (p.ticket_access === 'all' || p.ticket_access === 'team') {
    return 'technician'
  }
  return 'end_user'
}

/**
 * Get the data access policy for an AccessContext + resource type.
 * Looks up against the legacy text encoding until the schema squash lands.
 */
export async function getDataAccessPolicy(
  organizationId: string,
  ac: AccessContext,
  resourceType: string,
): Promise<DataAccessPolicy | null> {
  const policy = await queryOne<{
    can_read: boolean
    can_search: boolean
    scope_restrictions: Record<string, unknown>
    redacted_fields: string[]
  }>(
    `SELECT can_read, can_search, scope_restrictions, redacted_fields
     FROM ai_data_access_policies
     WHERE organization_id = $1 AND context_level = $2 AND resource_type = $3`,
    [organizationId, legacyContextLevel(ac), resourceType],
  )

  if (!policy) {
    return {
      resourceType,
      canRead: false,
      canSearch: false,
      scopeRestrictions: {},
      redactedFields: [],
    }
  }

  return {
    resourceType,
    canRead: policy.can_read,
    canSearch: policy.can_search,
    scopeRestrictions: policy.scope_restrictions || {},
    redactedFields: policy.redacted_fields || [],
  }
}

/**
 * Check if a user can access a specific resource.
 */
export async function canAccessResource(
  session: ChatSession,
  resourceType: string,
  resourceId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = await getDataAccessPolicy(
    session.organizationId,
    session.accessContext,
    resourceType,
  )

  if (!policy || !policy.canRead) {
    return { allowed: false, reason: 'No read access to this resource type' }
  }

  if (policy.scopeRestrictions.own_only && resourceId) {
    if (resourceType === 'tickets') {
      const isOwner = await queryOne<{ exists: boolean }>(
        `SELECT EXISTS(
          SELECT 1 FROM tickets
          WHERE id = $1
          AND (created_by = $2 OR contact_id = $3)
        ) as exists`,
        [resourceId, session.userId, session.contactId],
      )
      if (!isOwner?.exists) {
        return { allowed: false, reason: 'You can only access your own tickets' }
      }
    }
  }

  return { allowed: true }
}

/**
 * Redact sensitive fields from an object based on policy.
 */
export function redactFields<T extends Record<string, unknown>>(
  data: T,
  redactedFields: string[],
): T {
  if (!redactedFields.length) return data
  const result: Record<string, unknown> = { ...data }
  for (const field of redactedFields) {
    if (field in result) {
      result[field] = '[REDACTED]'
    }
  }
  return result as T
}

/**
 * Search knowledge base with visibility restrictions.
 * Uses the search_kb_articles_for_user DB function to handle private article
 * visibility based on user/contact attributes. Falls back to hybrid search.
 */
export async function searchKnowledgeBase(
  session: ChatSession,
  searchQuery: string,
  limit: number = 5,
): Promise<Array<{
  id: string
  title: string
  excerpt: string
  categoryName: string
}>> {
  const policy = await getDataAccessPolicy(
    session.organizationId,
    session.accessContext,
    'kb_articles',
  )

  if (!policy || !policy.canSearch) {
    return []
  }

  let allowedVisibility = ['public', 'internal', 'private']
  const policyVisibility = policy.scopeRestrictions.visibility
  if (Array.isArray(policyVisibility)) {
    allowedVisibility = policyVisibility as string[]
  }

  try {
    if (allowedVisibility.includes('private') && (session.userId || session.contactId)) {
      const results = await query<{
        id: string
        title: string
        summary: string
        category_name: string
      }>(
        `SELECT id, title, COALESCE(summary, '') as summary, COALESCE(category_name, 'Uncategorized') as category_name
         FROM search_kb_articles_for_user($1, $2, $3, $4, NULL, $5)`,
        [session.organizationId, searchQuery, session.userId, session.contactId, limit],
      )

      await logDataAccess(session.id, 'kb_articles', null, 'search', searchQuery, results.length, true)

      return results.map(r => ({
        id: r.id,
        title: r.title,
        excerpt: r.summary,
        categoryName: r.category_name,
      }))
    }

    const { hybridSearch } = await import('./hybrid-search')
    const results = await hybridSearch({
      query: searchQuery,
      table: 'kb_articles',
      organizationId: session.organizationId,
      limit,
      filters: { visibility: allowedVisibility.filter(v => v !== 'private') },
    })

    await logDataAccess(session.id, 'kb_articles', null, 'search', searchQuery, results.length, true)

    return results.map(r => ({
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      categoryName: (r.metadata.categorySlug as string) || 'Uncategorized',
    }))
  } catch (error) {
    console.error('[AI Security] KB search failed, falling back to ILIKE:', error)

    const results = await query<{
      id: string
      title: string
      content_plain: string
      category_name: string
    }>(
      `SELECT
        kb.id,
        kb.title,
        LEFT(kb.content_plain, 300) as content_plain,
        COALESCE(cat.name, 'Uncategorized') as category_name
       FROM kb_articles kb
       LEFT JOIN kb_categories cat ON kb.category_id = cat.id
       WHERE kb.organization_id = $1
         AND kb.status = 'published'
         AND kb.is_deleted = false
         AND kb.visibility = ANY($2)
         AND (
           kb.title ILIKE '%' || $3 || '%'
           OR kb.content_plain ILIKE '%' || $3 || '%'
         )
       ORDER BY
         CASE WHEN kb.title ILIKE '%' || $3 || '%' THEN 0 ELSE 1 END,
         kb.updated_at DESC
       LIMIT $4`,
      [session.organizationId, allowedVisibility.filter(v => v !== 'private'), searchQuery, limit],
    )

    await logDataAccess(session.id, 'kb_articles', null, 'search', searchQuery, results.length, true)

    return results.map(r => ({
      id: r.id,
      title: r.title,
      excerpt: r.content_plain,
      categoryName: r.category_name,
    }))
  }
}

/**
 * Search tickets with permission restrictions.
 */
export async function searchTickets(
  session: ChatSession,
  searchQuery?: string,
  status?: string,
  limit: number = 10,
): Promise<Array<{
  id: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  createdAt: Date
}>> {
  const policy = await getDataAccessPolicy(
    session.organizationId,
    session.accessContext,
    'tickets',
  )

  if (!policy || !policy.canSearch) {
    return []
  }

  let whereClause = 'WHERE t.organization_id = $1'
  const params: unknown[] = [session.organizationId]
  let paramIndex = 2

  if (policy.scopeRestrictions.own_only) {
    whereClause += ` AND (t.created_by = $${paramIndex} OR t.contact_id = $${paramIndex + 1})`
    params.push(session.userId, session.contactId)
    paramIndex += 2
  }

  if (searchQuery) {
    whereClause += ` AND t.subject ILIKE '%' || $${paramIndex} || '%'`
    params.push(searchQuery)
    paramIndex++
  }

  if (status) {
    whereClause += ` AND ts.base_status = $${paramIndex}`
    params.push(status)
    paramIndex++
  }

  params.push(limit)

  const results = await query<{
    id: string
    prefix: string
    number: number
    subject: string
    status_name: string
    priority: string
    created_at: Date
  }>(
    `SELECT
      t.id,
      t.prefix,
      t.number,
      t.subject,
      ts.name as status_name,
      t.priority,
      t.created_at
     FROM tickets t
     LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${paramIndex}`,
    params,
  )

  await logDataAccess(session.id, 'tickets', null, 'search', searchQuery || '', results.length, true)

  return results.map(r => ({
    id: r.id,
    ticketNumber: `${r.prefix}-${r.number}`,
    subject: r.subject,
    status: r.status_name,
    priority: r.priority,
    createdAt: r.created_at,
  }))
}

/**
 * Get ticket details with field redaction.
 */
export async function getTicketDetails(
  session: ChatSession,
  ticketId: string,
): Promise<{
  id: string
  ticketNumber: string
  subject: string
  description: string
  status: string
  priority: string
  category: string
  createdAt: Date
  canViewInternalNotes: boolean
} | null> {
  const access = await canAccessResource(session, 'tickets', ticketId)
  if (!access.allowed) {
    await logDataAccess(session.id, 'tickets', ticketId, 'read', '', 0, false, access.reason)
    return null
  }

  const policy = await getDataAccessPolicy(session.organizationId, session.accessContext, 'tickets')
  const redactedFields = policy?.redactedFields || []

  const ticket = await queryOne<{
    id: string
    prefix: string
    number: number
    subject: string
    description: string
    status_name: string
    priority: string
    category_name: string
    created_at: Date
  }>(
    `SELECT
      t.id,
      t.prefix,
      t.number,
      t.subject,
      t.description,
      ts.name as status_name,
      t.priority,
      tc.name as category_name,
      t.created_at
     FROM tickets t
     LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
     LEFT JOIN ticket_categories tc ON t.category_id = tc.id
     WHERE t.id = $1 AND t.organization_id = $2`,
    [ticketId, session.organizationId],
  )

  if (!ticket) {
    await logDataAccess(session.id, 'tickets', ticketId, 'read', '', 0, false, 'Ticket not found')
    return null
  }

  await logDataAccess(session.id, 'tickets', ticketId, 'read', '', 1, true, undefined, redactedFields)

  return {
    id: ticket.id,
    ticketNumber: `${ticket.prefix}-${ticket.number}`,
    subject: ticket.subject,
    description: redactedFields.includes('description') ? '[Content hidden]' : ticket.description,
    status: ticket.status_name,
    priority: ticket.priority,
    category: ticket.category_name || 'Uncategorized',
    createdAt: ticket.created_at,
    canViewInternalNotes: !redactedFields.includes('internal_notes'),
  }
}

/**
 * Log AI data access for audit.
 */
async function logDataAccess(
  sessionId: string,
  resourceType: string,
  resourceId: string | null,
  action: string,
  queryText: string,
  resultsCount: number,
  accessGranted: boolean,
  denialReason?: string,
  redactedFields?: string[],
): Promise<void> {
  try {
    await query(
      `INSERT INTO ai_chat_data_access_log
       (session_id, resource_type, resource_id, action, query_text, results_count, access_granted, denial_reason, redacted_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sessionId, resourceType, resourceId, action, queryText, resultsCount, accessGranted, denialReason, redactedFields],
    )
  } catch (error) {
    console.error('Failed to log AI data access:', error)
  }
}

/**
 * Create a secure chat session with proper access context.
 */
export async function createSecureChatSession(
  organizationId: string,
  userId: string | null,
  contactId: string | null,
  chatType: 'user_support' | 'admin_support' | 'general',
  providerAccessGrantId?: string,
): Promise<ChatSession> {
  let accessContext: AccessContext = { depth: 'end_user', crossOrg: false }

  if (userId) {
    accessContext = await determineAccessContext(userId, organizationId, providerAccessGrantId)
  } else if (providerAccessGrantId) {
    // No userId — bare provider context (e.g., delegated key without a user).
    accessContext = { depth: 'technician', crossOrg: true }
  }

  const session = await queryOne<{ id: string }>(
    `INSERT INTO ai_chat_sessions
     (organization_id, user_id, contact_id, chat_type, context_level, provider_access_grant_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      organizationId,
      userId,
      contactId,
      chatType,
      legacyContextLevel(accessContext),
      providerAccessGrantId,
    ],
  )

  if (!session) {
    throw new Error('Failed to create chat session')
  }

  return {
    id: session.id,
    organizationId,
    userId,
    contactId,
    accessContext,
    providerAccessGrantId: providerAccessGrantId || null,
  }
}

/**
 * Get security context message for AI system prompt.
 *
 * Switches on the orthogonal (depth, crossOrg) tuple. Provider/MSP actors get
 * the cross-org disclaimer regardless of their depth — depth controls
 * UI-equivalent power, crossOrg controls bounded delegation.
 */
export function getSecurityContextMessage(ac: AccessContext): string {
  if (ac.crossOrg) {
    return `
SECURITY CONTEXT: External Provider (MSP)
- Your access is limited by the access grant from the client
- You can only see data within your granted scope
- You CANNOT access: credentials, billing info, data outside your scope
- All your actions are logged and visible to the client
- Respect the client's data sovereignty`
  }

  switch (ac.depth) {
    case 'end_user':
      return `
SECURITY CONTEXT: End User
- You can ONLY show this user their OWN tickets
- You can ONLY show PUBLIC knowledge base articles
- You CANNOT access: other users' data, internal notes, credentials, assets, admin info
- If asked about restricted data, say: "I don't have access to that information"
- All data access is logged for security`

    case 'technician':
      return `
SECURITY CONTEXT: IT Technician
- You can access all tickets and internal KB articles
- You can look up assets and contacts
- You CANNOT reveal: credential passwords, billing info, personal employee data
- Sensitive fields are automatically redacted
- All data access is logged for audit`

    case 'admin':
      return `
SECURITY CONTEXT: Administrator
- You have full access to organizational data
- You can access credentials (passwords will be shown on request)
- You can view audit logs and system settings
- All data access is logged for compliance`
  }
}
