import { auth } from '@/lib/auth'
import { getOrgId } from '@/lib/org'
import { pool, queryOne } from '@/lib/db'
import { hashApiKey } from '@/lib/api-keys'
import { isValidScope, type ApiScope } from '@obilabs/api-scopes'
import { keyTypeAllowedOnPath } from '@/lib/key-type-paths'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth context returned by every successful authentication path. The
 * `permissions` array is the union of scopes the caller is allowed to exercise
 * on this request — empty for session auth (where permissions are gated by the
 * UI), populated for API-key auth.
 */
export type KeyType =
  | 'personal'
  | 'mtp-polling'
  | 'delegated-write'
  | 'standard'
  | 'aegis-mtp-pairing'

export interface ApiAuthContext {
  userId: string
  orgId: string
  /** API-key id, present only for key-based auth paths. */
  keyId?: string
  /** Granted scopes for THIS request. Empty for session auth. */
  permissions: ApiScope[]
  /** Which authentication path validated this request. */
  authMethod: 'aegis_bearer' | 'session'
  /**
   * The api_keys.key_type for the key that authenticated this request.
   * Used by requireScope to enforce delegated-write per-call header
   * requirements. Absent for session auth (the UI is the gate).
   */
  keyType?: KeyType
  /**
   * The api_keys.key_owner_user_id — the user this personal key belongs
   * to. NULL for org-owned admin-issued keys (mtp-polling, delegated-
   * write). Used by the audit log to record who owned the key.
   */
  keyOwnerUserId?: string | null
}

/**
 * Fire-and-forget per-call API-key audit. Phase 1 MVP — logs what's known at
 * requireScope time (api_key_id, org, user, method, path, required_scope,
 * scope_granted, request_ip). Status code and duration_ms are NULL for now;
 * Phase 2 can add a middleware that fills them post-response. Failures are
 * swallowed — audit must never block the request.
 */
export function logApiKeyCall(opts: {
  apiKeyId: string
  organizationId: string
  userId: string
  method: string
  path: string
  requiredScope: ApiScope | null
  scopeGranted: boolean
  requestIp: string | null
  userAgent: string | null
  /** Set only when requireScope itself returns a response (e.g., 403). */
  statusCode?: number | null
  /**
   * Delegated-write assertion captured from the request headers. NULL
   * for personal / mtp-polling keys and for delegated-write keys when
   * the request omitted the headers (which would have been rejected
   * earlier with 412 — the call still gets a row so forensic queries
   * can see attempted-without-context patterns).
   */
  actingUserEmail?: string | null
  actionTicketRef?: string | null
}): void {
  pool.query(
    `INSERT INTO api_key_usage_logs
       (api_key_id, organization_id, user_id, method, path, status_code,
        required_scope, scope_granted, request_ip, user_agent,
        acting_user_email, action_ticket_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      opts.apiKeyId,
      opts.organizationId,
      opts.userId,
      opts.method,
      opts.path,
      opts.statusCode ?? null,
      opts.requiredScope,
      opts.scopeGranted,
      opts.requestIp,
      opts.userAgent,
      opts.actingUserEmail ?? null,
      opts.actionTicketRef ?? null,
    ],
  ).catch((err) => {
    console.error('[api-auth] api_key_usage_logs insert failed:', err.message)
  })
}

/**
 * Coerce a `text[]` column from `api_keys.scopes` into a typed `ApiScope[]`,
 * dropping any unknown values. Logs unknown scopes so DB drift is visible.
 */
function toApiScopes(raw: unknown, keyId: string): ApiScope[] {
  if (!Array.isArray(raw)) return []
  const valid: ApiScope[] = []
  for (const s of raw) {
    if (isValidScope(s)) {
      valid.push(s)
    } else {
      console.warn(
        `[api-auth] Dropping unknown scope on api_keys.id=${keyId}: ${JSON.stringify(s)}`
      )
    }
  }
  return valid
}

/**
 * Validates an external API request. Order of precedence:
 *   1. Aegis Bearer key  (Authorization: Bearer aegis_...)  — scopes enforced
 *   2. Session cookie    (UI requests)                       — UI is the gate
 *
 * The Better Auth `apiKey` plugin path is intentionally absent — Phase 1 (D7)
 * collapses to a single `api_keys` table; the parallel system is dropped.
 *
 * Usage in /api/v1/* routes: prefer `requireScope(req, 'tickets:read')` over
 * calling this directly. Routes that genuinely don't need a scope (rare) can
 * call `validateApiRequest` and skip the check.
 */
export async function validateApiRequest(
  request: NextRequest
): Promise<ApiAuthContext | NextResponse> {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer aegis_')) {
      const token = authHeader.slice(7)
      const hash = hashApiKey(token)
      const key = await queryOne<{
        id: string
        organization_id: string
        created_by: string
        is_active: boolean
        is_revoked: boolean
        expires_at: string | null
        scopes: string[] | null
        key_type: KeyType
        key_owner_user_id: string | null
      }>(
        `SELECT id, organization_id, created_by, is_active, is_revoked,
                expires_at, scopes, key_type, key_owner_user_id
         FROM api_keys WHERE key_hash = $1`,
        [hash]
      )
      if (!key || !key.is_active || key.is_revoked) {
        return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
      }
      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        return NextResponse.json({ error: 'API key has expired' }, { status: 401 })
      }

      // Cascade-revocation gate: if the bearer key belongs to a disabled
      // user, refuse — regardless of the key's own state. This closes
      // the NIST AC-12 window where a personal-key holder whose user
      // account got cascade-disabled would still authenticate until the
      // key's own TTL. Two paths matter here:
      //   1. Personal key: key_owner_user_id points at the disabled user
      //   2. Delegated-write or mtp-polling key: org-owned; no owner
      //      user, so no user-level gate applies. Cascade doesn't touch
      //      these — they'd be revoked by their own admin action.
      // Skip the lookup entirely for org-owned keys (fast path).
      if (key.key_owner_user_id) {
        const owner = await queryOne<{ status: string | null }>(
          `SELECT status FROM users WHERE id = $1 LIMIT 1`,
          [key.key_owner_user_id]
        )
        if (owner?.status === 'disabled') {
          return NextResponse.json(
            { error: 'API key owner is disabled' },
            { status: 401 }
          )
        }
      }

      // Path scoping by key type (audit C4). Enforced here — the single
      // resolution point every bearer flow passes through — so a restricted
      // key type (e.g. aegis-mtp-pairing, confined to /api/v1/mtp/*) cannot
      // reach a disallowed endpoint regardless of how that route wires auth.
      if (!keyTypeAllowedOnPath(key.key_type, new URL(request.url).pathname)) {
        return NextResponse.json(
          {
            error: 'forbidden_for_key_type',
            message: `A ${key.key_type} key is not permitted on this endpoint.`,
          },
          { status: 403 }
        )
      }

      return {
        userId: key.created_by,
        orgId: key.organization_id,
        keyId: key.id,
        permissions: toApiScopes(key.scopes, key.id),
        authMethod: 'aegis_bearer',
        keyType: key.key_type,
        keyOwnerUserId: key.key_owner_user_id,
      }
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide Authorization: Bearer <key> or session cookie.' },
        { status: 401 }
      )
    }
    const orgId = await getOrgId()
    return {
      userId: session.user.id,
      orgId,
      permissions: [],
      authMethod: 'session',
    }
  } catch (error) {
    console.error('API auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}
