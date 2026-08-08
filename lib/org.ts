import { pool } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { Session } from '@/lib/auth'

// Single-tenant: cache the one organization ID in memory
let cachedOrgId: string | null = null

/**
 * Get the organization ID for this single-tenant instance.
 * Queries once and caches in memory for the lifetime of the process.
 */
export async function getOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId

  // Single-tenant: there must be exactly ONE organization. ORDER BY created_at
  // makes this deterministic if a stray row ever appears — the original
  // setup org (oldest) always wins, so a rogue org can't poison identity
  // resolution for the whole instance (audit 2026-07-26).
  const result = await pool.query(
    'SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1'
  )

  if (result.rows.length === 0) {
    throw new Error('No organization found. Run the setup wizard first.')
  }

  cachedOrgId = result.rows[0].id as string
  return cachedOrgId!
}

// Cache: Better Auth email → users.id (application UUID)
const userIdCache = new Map<string, string>()

/**
 * Map a Better Auth session user to the application `users` table UUID.
 *
 * Better Auth stores users in its own `"user"` table (text IDs).
 * The application `users` table has separate UUID IDs with FK constraints.
 * This helper resolves the mapping via email lookup.
 */
export async function getUserId(sessionEmail: string): Promise<string> {
  const cached = userIdCache.get(sessionEmail)
  if (cached) return cached

  const orgId = await getOrgId()
  const result = await pool.query(
    'SELECT id FROM users WHERE organization_id = $1 AND email = $2 LIMIT 1',
    [orgId, sessionEmail]
  )

  if (result.rows.length === 0) {
    throw new Error(`No application user found for ${sessionEmail}. Contact an administrator.`)
  }

  const userId = result.rows[0].id as string
  userIdCache.set(sessionEmail, userId)
  return userId
}

/**
 * Authenticate a request and resolve all identity context in one call.
 *
 * Returns the Better Auth session, the Aegis application user UUID,
 * and the organization ID — or null if the request is not authenticated.
 */
export async function getAuthContext(request: Request): Promise<{
  session: Session
  userId: string
  orgId: string
} | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null

  const orgId = await getOrgId()
  const userId = await getUserId(session.user.email)

  return { session, userId, orgId }
}
