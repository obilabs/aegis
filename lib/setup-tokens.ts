/**
 * One-time set-password tokens (spec: admin-password-onboarding).
 *
 * Admins never learn a user's password. Create-user and reset both mint a
 * single-use, expiring token; the raw value is returned exactly once (inside a
 * link) and only its SHA-256 hash is stored. The user redeems the link to set
 * their own password.
 */
import { createHash, randomBytes } from 'node:crypto'
import { pool } from '@/lib/db'

const DEFAULT_TTL_HOURS = 72

export type TokenPurpose = 'invite' | 'reset'

/** SHA-256 hex of the raw token — what we store and look up on. */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Build the public set-password URL. */
function setPasswordUrl(baseUrl: string, rawToken: string): string {
  return `${baseUrl.replace(/\/$/, '')}/set-password/${rawToken}`
}

/**
 * The PUBLIC base URL for links the user must reach. `new URL(request.url).origin`
 * is the internal container origin (e.g. http://0.0.0.0:3000) behind a proxy, so
 * prefer the configured `BETTER_AUTH_URL` (the operator's real external URL),
 * then the proxy's forwarded host, then the raw origin as a last resort.
 */
export function publicBaseUrl(request: Request): string {
  const configured = process.env.BETTER_AUTH_URL
  if (configured && !/localhost|0\.0\.0\.0|127\.0\.0\.1/.test(configured)) {
    return configured.replace(/\/$/, '')
  }
  const xfHost = request.headers.get('x-forwarded-host')
  if (xfHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${xfHost}`
  }
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

/**
 * Mint a token for a user, invalidating any prior unused token of the same
 * purpose so only the newest link works. Returns the raw token and the link.
 */
export async function mintToken(params: {
  userId: string
  orgId: string
  purpose: TokenPurpose
  createdBy: string
  baseUrl: string
  ttlHours?: number
}): Promise<{ rawToken: string; url: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(rawToken)
  const ttl = params.ttlHours ?? DEFAULT_TTL_HOURS
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Invalidate prior unused tokens of the same purpose for this user.
    await client.query(
      `UPDATE password_setup_tokens SET used_at = NOW()
       WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
      [params.userId, params.purpose],
    )
    const res = await client.query<{ expires_at: Date }>(
      `INSERT INTO password_setup_tokens
         (organization_id, user_id, token_hash, purpose, expires_at, created_by)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::interval, $6)
       RETURNING expires_at`,
      [params.orgId, params.userId, tokenHash, params.purpose, String(ttl), params.createdBy],
    )
    await client.query('COMMIT')
    return {
      rawToken,
      url: setPasswordUrl(params.baseUrl, rawToken),
      expiresAt: res.rows[0].expires_at,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Atomically validate + consume a token. Returns the bound user on success, or
 * null for any invalid/expired/used/unknown token (callers surface a single
 * generic error so validity can't be probed).
 */
export async function consumeToken(
  rawToken: string,
): Promise<{ userId: string; orgId: string; purpose: TokenPurpose; email: string } | null> {
  if (!rawToken || rawToken.length < 20) return null
  const tokenHash = hashToken(rawToken)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Lock the row; only unused + unexpired tokens qualify.
    const res = await client.query<{
      id: string
      user_id: string
      organization_id: string
      purpose: TokenPurpose
    }>(
      `SELECT id, user_id, organization_id, purpose
         FROM password_setup_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
        FOR UPDATE`,
      [tokenHash],
    )
    if (res.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }
    const row = res.rows[0]
    await client.query(`UPDATE password_setup_tokens SET used_at = NOW() WHERE id = $1`, [row.id])
    const userRes = await client.query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1 AND organization_id = $2`,
      [row.user_id, row.organization_id],
    )
    await client.query('COMMIT')
    if (userRes.rows.length === 0) return null
    return {
      userId: row.user_id,
      orgId: row.organization_id,
      purpose: row.purpose,
      email: userRes.rows[0].email,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Peek at a token's validity for the set-password PAGE (does not consume).
 * Returns the purpose + email for display, or null. */
export async function peekToken(
  rawToken: string,
): Promise<{ purpose: TokenPurpose; email: string } | null> {
  if (!rawToken || rawToken.length < 20) return null
  const res = await pool.query<{ purpose: TokenPurpose; email: string }>(
    `SELECT t.purpose, u.email
       FROM password_setup_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW()`,
    [hashToken(rawToken)],
  )
  return res.rows[0] ?? null
}
