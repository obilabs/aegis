/**
 * Role-Based Permission System
 *
 * Reads structured JSONB permissions from user_roles:
 *   { capabilities: string[], ticket_access: "own"|"team"|"all", admin_access: boolean }
 *
 * Provides helpers for checking capabilities, scoping ticket queries,
 * and determining access levels.
 */

import { cache } from 'react'
import { queryOne } from './db'

/** All known capability names */
export const CAPABILITIES = [
  'triage',
  'bulk_actions',
  'reports',
  'settings',
  'user_management',
  'credentials',
] as const

export type Capability = (typeof CAPABILITIES)[number]
export type TicketAccess = 'own' | 'team' | 'all'

export interface UserPermissions {
  capabilities: Capability[]
  ticketAccess: TicketAccess
  adminAccess: boolean
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  capabilities: [],
  ticketAccess: 'own',
  adminAccess: false,
}

/**
 * Fetch structured permissions for a user.
 * Uses React `cache()` so repeated calls in a single request are free.
 */
export const getUserPermissions = cache(
  async (userId: string): Promise<UserPermissions> => {
    const row = await queryOne<{ permissions: Record<string, unknown> }>(
      `SELECT r.permissions
       FROM users u
       JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    )

    if (!row?.permissions) {
      return DEFAULT_PERMISSIONS
    }

    const p = row.permissions
    return {
      capabilities: (Array.isArray(p.capabilities) ? p.capabilities : []) as Capability[],
      ticketAccess: (['own', 'team', 'all'].includes(p.ticket_access as string)
        ? p.ticket_access
        : 'own') as TicketAccess,
      adminAccess: p.admin_access === true,
    }
  }
)

/**
 * Check if user has a specific capability.
 */
export async function hasCapability(userId: string, capability: Capability): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.capabilities.includes(capability)
}

/**
 * Check if the user is an admin OR holds a specific capability. One cached
 * permissions lookup. Use for surfaces that admins always reach but that a
 * role can also be granted access to explicitly — e.g. the credential vault
 * (`credentials`), which is admin + any role with the capability.
 */
export async function hasCapabilityOrAdmin(
  userId: string,
  capability: Capability,
): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.adminAccess || perms.capabilities.includes(capability)
}

/**
 * Get the ticket access level for a user.
 */
export async function getTicketAccess(userId: string): Promise<TicketAccess> {
  const perms = await getUserPermissions(userId)
  return perms.ticketAccess
}

/**
 * Check if user is an admin.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.adminAccess
}

/**
 * Build a WHERE clause fragment that scopes ticket visibility
 * based on the user's ticket_access level.
 *
 * @param userId - The user requesting access
 * @param alias  - SQL alias for the tickets table (default: 't')
 * @returns { clause, params } to append to a WHERE clause
 *
 * Usage:
 *   const filter = await getTicketAccessFilter(userId, orgId)
 *   const sql = `SELECT * FROM tickets t WHERE t.organization_id = $1 ${filter.clause}`
 *   const result = await query(sql, [orgId, ...filter.params])
 */
export async function getTicketAccessFilter(
  userId: string,
  orgId: string,
  alias: string = 't',
  startParamIndex: number = 2
): Promise<{ clause: string; params: unknown[] }> {
  const perms = await getUserPermissions(userId)

  switch (perms.ticketAccess) {
    case 'all':
      // Can see everything in the organization — no extra filter
      return { clause: '', params: [] }

    case 'team': {
      // Can see tickets assigned to them or their team.
      // NOTE: tickets.assigned_team is varchar(100) holding a team UUID string
      // (the assign route validates it as z.string().uuid()), while
      // team_members.team_id is uuid. Compare on ::text — a bare
      // `assigned_team IN (SELECT team_id ...)` is a varchar-vs-uuid type error
      // that 500s EVERY team-scoped ticket query (REST list/detail + AI). Fixed
      // 2026-07-26.
      const p1 = startParamIndex
      const p2 = startParamIndex + 1
      return {
        clause: `AND (${alias}.assigned_to = $${p1} OR ${alias}.assigned_team IN (
          SELECT team_id::text FROM team_members WHERE user_id = $${p2}
        ) OR ${alias}.created_by = $${p2})`,
        params: [userId, userId],
      }
    }

    case 'own': {
      // Can only see their own tickets (created by or assigned to them)
      const p1 = startParamIndex
      return {
        clause: `AND (${alias}.created_by = $${p1} OR ${alias}.contact_id IN (
          SELECT id FROM contacts WHERE email = (SELECT email FROM users WHERE id = $${p1})
        ))`,
        params: [userId],
      }
    }
  }
}

/**
 * D28f — email-ingest sender authorization.
 *
 * Returns true iff `senderEmail` matches any of: ticket.requester_email,
 * ticket.cc_list, ticket.collaborators, or the ticket's assignee email.
 * Lives here (NOT in lib/email/threading.ts) so the email path uses the
 * same RBAC layer as the UI — auth-foundations D5 ("AI tools route through
 * the same RBAC the UI uses"; the inbound-email path is no different).
 *
 * Comparisons are case-insensitive and trim whitespace. Pattern parity with
 * GLPI's MailCollector but without GLPI's "creates a new ticket on auth
 * failure" silent-link — the caller decides what to do with `false`
 * (typically: create new ticket linked to original via ticket_links per
 * D28j). Admin-of-org is intentionally NOT authorized (privilege-escalation
 * via phished admin email).
 */
export async function isEmailSenderAuthorizedForTicket(
  senderEmail: string,
  ticketId: string,
  orgId: string,
): Promise<boolean> {
  const lower = senderEmail.toLowerCase().trim()
  if (!lower) return false

  const ticket = await queryOne<{
    requester_email: string | null
    cc_list: string[] | null
    collaborators: string[] | null
    assignee_email: string | null
  }>(
    `SELECT
       t.requester_email,
       t.cc_list,
       t.collaborators,
       u.email AS assignee_email
     FROM tickets t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.id = $1 AND t.organization_id = $2`,
    [ticketId, orgId],
  )

  if (!ticket) return false

  if (ticket.requester_email && ticket.requester_email.toLowerCase().trim() === lower) {
    return true
  }
  if (ticket.assignee_email && ticket.assignee_email.toLowerCase().trim() === lower) {
    return true
  }
  if (ticket.cc_list && ticket.cc_list.some(e => e.toLowerCase().trim() === lower)) {
    return true
  }
  if (
    ticket.collaborators &&
    ticket.collaborators.some(e => e.toLowerCase().trim() === lower)
  ) {
    return true
  }

  return false
}

/**
 * D28i — merge new participants from an inbound email's To/CC headers into
 * an existing ticket's cc_list. Case-insensitive de-duplication; preserves
 * the canonical casing of pre-existing entries. Excludes the ingest mailbox
 * itself (the customer doesn't want their support@ as a cc on its own
 * tickets).
 *
 * Pure function — caller is responsible for the UPDATE.
 */
export function mergeParticipants(
  existing: string[],
  incoming: { to: string[]; cc: string[] },
  ingestMailbox: string,
): string[] {
  const ingestLower = ingestMailbox.toLowerCase().trim()
  const seen = new Set<string>()
  const result: string[] = []

  for (const e of existing) {
    const k = e.toLowerCase().trim()
    if (!seen.has(k)) {
      seen.add(k)
      result.push(e)
    }
  }

  for (const e of [...incoming.to, ...incoming.cc]) {
    const k = e.toLowerCase().trim()
    if (!k || k === ingestLower || seen.has(k)) continue
    seen.add(k)
    result.push(e)
  }

  return result
}
