import { pool } from '@/lib/db'

type ActionCategory = 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout' | 'export' | 'settings'

/**
 * Auth lifecycle events that Better Auth `hooks.after` propagates into the
 * audit log. Includes the legacy `login` / `logout` / `login_failed` set plus
 * the full credential-handling chain required by auth-foundations Phase 1
 * (D8).
 */
export type AuthLifecycleAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'signup'
  | 'otp_sent'
  | 'otp_verified'
  | 'password_reset_completed'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'api_key_rotated'

const AUTH_ACTION_CATEGORY: Record<AuthLifecycleAction, ActionCategory> = {
  login: 'login',
  logout: 'logout',
  login_failed: 'login',
  signup: 'create',
  otp_sent: 'login',
  otp_verified: 'login',
  password_reset_completed: 'update',
  api_key_created: 'create',
  api_key_revoked: 'delete',
  api_key_rotated: 'update',
}

interface AuditOptions {
  orgId: string
  userId: string
  action: string
  actionCategory: ActionCategory
  entityType: string
  entityId?: string
  entityName?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  actorIp?: string | null
  success?: boolean
  errorMessage?: string
}

/**
 * Extract client IP address from request headers.
 * nginx sets X-Real-IP and X-Forwarded-For.
 */
export function getClientIp(headers: Headers): string | null {
  return (
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  )
}

/**
 * Log an audit event. Fire-and-forget — never throws.
 * Call without await so it doesn't block the response.
 */
/**
 * Log a login or logout event. Fire-and-forget.
 * Looks up orgId/userId from email since these may not be available at call time.
 */
export function logAuthEvent(opts: {
  email?: string
  userId?: string
  action: AuthLifecycleAction
  method?: string       // 'email' | 'google' | 'api_key' | 'otp_sign-in' | etc.
  actorIp?: string | null
  success?: boolean
  errorMessage?: string
  userAgent?: string | null
  /** Optional payload — e.g., key id for api_key_*, OTP type for otp_*. */
  metadata?: Record<string, unknown>
}): void {
  const { email, userId, action, method, actorIp, success = true, errorMessage, userAgent, metadata } = opts
  const category: ActionCategory = AUTH_ACTION_CATEGORY[action]

  // Look up user info and org from email or userId.
  //
  // Note on two user tables:
  // - Better Auth "user" (singular): id is text like "user-<hex>"
  // - Application users (plural): id is uuid
  // audit_log.user_id is uuid, so we MUST resolve to the application users.id.
  // Match by email (the stable identity), not by Better Auth's text id.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const lookupAndInsert = async () => {
    let resolvedUserId: string | null = null
    let resolvedEmail: string | null = email || null
    let orgId: string | null = null

    // If caller passed a Better Auth text id, resolve its email so we can look
    // up the application user. UUIDs are assumed to already be application ids.
    if (userId) {
      if (UUID_RE.test(userId)) {
        resolvedUserId = userId
      } else if (!resolvedEmail) {
        const ba = await pool.query(
          'SELECT email FROM "user" WHERE id = $1 LIMIT 1',
          [userId]
        )
        if (ba.rows[0]?.email) resolvedEmail = ba.rows[0].email
      }
    }

    // Resolve (or confirm) application user via email.
    if (!resolvedUserId && resolvedEmail) {
      const appUser = await pool.query(
        'SELECT id, organization_id FROM users WHERE email = $1 LIMIT 1',
        [resolvedEmail]
      )
      if (appUser.rows[0]) {
        resolvedUserId = appUser.rows[0].id
        orgId = appUser.rows[0].organization_id || null
      }
    }

    // If we have a UUID user id but no org yet, fetch the org.
    if (resolvedUserId && !orgId) {
      const org = await pool.query(
        'SELECT organization_id FROM users WHERE id = $1 LIMIT 1',
        [resolvedUserId]
      )
      orgId = org.rows[0]?.organization_id || null
    }

    // Fall back to the single org (single-tenant install).
    if (!orgId) {
      const org = await pool.query('SELECT id FROM organizations LIMIT 1')
      orgId = org.rows[0]?.id || null
    }

    // During initial setup, no organization exists yet — skip audit logging.
    if (!orgId) return

    // Resolve display name from Better Auth (it carries "name"; our users
    // table does not have a single "name" column).
    let actorName = resolvedEmail
    if (resolvedEmail) {
      const u = await pool.query(
        'SELECT name FROM "user" WHERE email = $1 LIMIT 1',
        [resolvedEmail]
      )
      if (u.rows[0]?.name) actorName = u.rows[0].name
    }

    await pool.query(
      `INSERT INTO audit_log (
        organization_id, actor_type, user_id, actor_name, actor_email, actor_ip,
        action, action_category, entity_type, entity_name,
        new_values, success, error_message
      ) VALUES ($1, 'user', $2, $3, $4, $5, $6, $7, 'session', $8, $9, $10, $11)`,
      [
        orgId,
        resolvedUserId,
        actorName,
        resolvedEmail,
        actorIp || null,
        action,
        category,
        method || null,
        JSON.stringify({ method, userAgent: userAgent?.substring(0, 200), ...(metadata || {}) }),
        success,
        errorMessage || null,
      ]
    )
  }

  lookupAndInsert().catch(err => {
    console.error('[audit] Failed to log auth event:', err.message)
  })
}

/**
 * Log an audit event. Fire-and-forget — never throws.
 * Call without await so it doesn't block the response.
 */
const AUDIT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function logAudit(opts: AuditOptions): void {
  const {
    orgId, userId, action, actionCategory, entityType,
    entityId, entityName, oldValues, newValues,
    actorIp, success = true, errorMessage,
  } = opts

  // Compute changed fields from old/new values
  let changedFields: string[] | null = null
  if (oldValues && newValues) {
    changedFields = Object.keys(newValues).filter(
      key => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
    )
  }

  // Resolve userId to an application users.id UUID. Callers generally pass
  // the UUID already, but guard against Better Auth text IDs (user-<hex>)
  // to keep audit writes from failing silently. Also resolve name/email in
  // JS so we can join across users (has email) and "user" (has name).
  const insert = async () => {
    let resolvedUserId: string | null = userId
    if (userId && !AUDIT_UUID_RE.test(userId)) {
      const ba = await pool.query('SELECT email FROM "user" WHERE id = $1 LIMIT 1', [userId])
      const baEmail = ba.rows[0]?.email
      if (baEmail) {
        const appUser = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [baEmail])
        resolvedUserId = appUser.rows[0]?.id ?? null
      } else {
        resolvedUserId = null
      }
    }

    let actorName: string | null = null
    let actorEmail: string | null = null
    if (resolvedUserId) {
      const u = await pool.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [resolvedUserId])
      actorEmail = u.rows[0]?.email ?? null
      if (actorEmail) {
        const ba = await pool.query('SELECT name FROM "user" WHERE email = $1 LIMIT 1', [actorEmail])
        actorName = ba.rows[0]?.name ?? actorEmail
      }
    }

    await pool.query(
      `INSERT INTO audit_log (
        organization_id, actor_type, user_id, actor_name, actor_email, actor_ip,
        action, action_category, entity_type, entity_id, entity_name,
        old_values, new_values, changed_fields,
        success, error_message
      ) VALUES (
        $1, 'user', $2, $3, $4,
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )`,
    [
      orgId,
      resolvedUserId,
      actorName,
      actorEmail,
      actorIp || null,
      action,
      actionCategory,
      entityType,
      entityId || null,
      entityName || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changedFields,
      success,
      errorMessage || null,
    ]
    )
  }

  insert().catch(err => {
    console.error('[audit] Failed to log event:', err.message)
  })
}
