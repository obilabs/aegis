/**
 * API key scope helpers — role-to-scope mapping, quota, intersection.
 *
 * Spec: openspec/changes/api-keys-typed-scoped/design.md (D4)
 *
 * Three exported helpers:
 *   - userMaxScopes(userId): the set of canonical scopes a user can grant
 *     on a personal key, derived from their user_roles capabilities. This
 *     is the ceiling — the user can never grant scopes that exceed their
 *     own in-app permissions.
 *   - personalKeysForUser(userId): { count, keys } for the org's personal
 *     keys owned by this user. Used by the quota check and the
 *     non-admin list view.
 *   - intersectScopes(requested, allowed): given a requested scope array
 *     and the user's ceiling, returns the subset that's actually
 *     granted + the dropped scopes for UI display.
 */

import type { ApiScope } from '@obilabs/api-scopes'
import { query, queryOne } from './db'

export const PERSONAL_KEY_QUOTA = 5

/**
 * Map the user_roles.permissions.capabilities JSONB array to a canonical
 * scope set. Coarse mapping per design D4 — a future fine-grained role
 * model would refine this, but the current capability vocabulary is
 * itself coarse (triage / bulk_actions / reports / settings / etc.) so
 * 1:1 fine-grained scope mapping isn't possible today.
 *
 * - `triage`           → tickets:read, tickets:write
 * - `bulk_actions`     → tickets:delete, assets:delete
 * - `reports`          → audit:read, tickets:read, assets:read, users:read
 * - `settings`         → (none — settings are session-only, no external API)
 * - `user_management`  → users:read, users:write, groups:read, groups:write
 * - `admin_access` OR role.is_admin → admin:full
 *
 * A user with NO mapped capabilities still gets read-only access to KB +
 * AI chat (everyone can use those internally; mirroring that to API
 * keys is consistent).
 */
const CAPABILITY_TO_SCOPES: Record<string, ApiScope[]> = {
  triage: ['tickets:read', 'tickets:write'],
  // bulk_actions implies destructive ticket operations + write-level
  // asset manipulation. `assets:delete` doesn't exist in the canonical
  // scope set today; map to assets:write (the broadest destructive
  // asset scope available).
  bulk_actions: ['tickets:delete', 'assets:write'],
  reports: ['audit:read', 'tickets:read', 'assets:read', 'users:read'],
  settings: [],
  user_management: ['users:read', 'users:write', 'groups:read', 'groups:write'],
  admin_access: ['admin:full'],
}

const BASELINE_SCOPES: ApiScope[] = ['kb:read', 'ai:chat']

interface UserRoleRow {
  capabilities: string[] | null
  role_name: string | null
}

/**
 * Return the maximum scope set a user can grant on a personal API key.
 * Includes baseline read-only scopes (KB + AI chat) that every
 * authenticated user has access to.
 */
export async function userMaxScopes(userId: string): Promise<ApiScope[]> {
  // Postgres won't cast a JSONB array to text[] directly — have to go
  // through jsonb_array_elements_text(). Wrapped in COALESCE so a NULL
  // capabilities array (user with no role assignment) returns {} not NULL.
  const row = await queryOne<UserRoleRow & { admin_access: boolean | null }>(
    `SELECT
       COALESCE(
         ARRAY(
           SELECT jsonb_array_elements_text(ur.permissions -> 'capabilities')
         ),
         ARRAY[]::text[]
       ) AS capabilities,
       (ur.permissions ->> 'admin_access')::boolean AS admin_access,
       ur.name AS role_name
       FROM users u
       LEFT JOIN user_roles ur ON ur.id = u.role_id
      WHERE u.id = $1`,
    [userId],
  )

  // admin_access is stored as a boolean sibling of `capabilities` (not a
  // capability string), so the CAPABILITY_TO_SCOPES['admin_access'] mapping
  // never fired for admins — the System Admin's ceiling silently excluded
  // admin:full and everything it implies (audit M4). Honor it explicitly:
  // admin_access grants the admin:full wildcard, which short-circuits.
  if (row?.admin_access === true) return ['admin:full']

  const out = new Set<ApiScope>(BASELINE_SCOPES)

  const capabilities = row?.capabilities ?? []
  for (const cap of capabilities) {
    const mapped = CAPABILITY_TO_SCOPES[cap]
    if (mapped) {
      for (const scope of mapped) out.add(scope)
    }
  }

  // admin:full is the wildcard — short-circuit and return just it,
  // since hasScope() treats admin:full as granting everything.
  if (out.has('admin:full')) return ['admin:full']

  return Array.from(out).sort() as ApiScope[]
}

export interface PersonalKeyListItem {
  id: string
  key_prefix: string
  name: string
  scopes: string[]
  last_used_at: Date | null
  expires_at: Date | null
  created_at: Date
  is_active: boolean
}

export interface PersonalKeyList {
  count: number
  keys: PersonalKeyListItem[]
}

/**
 * Return the count of non-revoked personal keys owned by this user, plus
 * the list itself. Used both by the quota check (count) and the
 * non-admin list view (keys).
 *
 * Non-revoked = is_active = true AND (expires_at IS NULL OR expires_at > NOW()).
 * Revoked keys don't count toward the per-user quota.
 */
export async function personalKeysForUser(userId: string): Promise<PersonalKeyList> {
  const keys = await query<PersonalKeyListItem>(
    `SELECT id, key_prefix, name, scopes, last_used_at, expires_at,
            created_at, is_active
       FROM api_keys
      WHERE key_type = 'personal'
        AND key_owner_user_id = $1
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC`,
    [userId],
  )
  return { count: keys.length, keys }
}

export interface IntersectionResult {
  /** Scopes that survived the ceiling check — what the key actually gets. */
  granted: ApiScope[]
  /** Scopes the user requested but isn't allowed to grant — for UI hint. */
  dropped: ApiScope[]
}

/**
 * Intersect a requested scope set with the user's ceiling. Anything the
 * user can't grant gets dropped (silently from the key's perspective,
 * loudly via the dropped array so the UI can show "we removed these").
 *
 * Special case: if the ceiling includes admin:full, every requested
 * scope is granted (admin:full is the wildcard).
 */
export function intersectScopes(
  requested: readonly ApiScope[],
  allowed: readonly ApiScope[],
): IntersectionResult {
  if (allowed.includes('admin:full')) {
    return { granted: [...requested], dropped: [] }
  }
  const allowedSet = new Set<string>(allowed)
  const granted: ApiScope[] = []
  const dropped: ApiScope[] = []
  for (const scope of requested) {
    if (allowedSet.has(scope)) {
      granted.push(scope)
    } else {
      dropped.push(scope)
    }
  }
  return { granted, dropped }
}
