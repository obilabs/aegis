/**
 * MTP pairing key utilities — issue, verify, revoke, atomic handshake.
 *
 * Storage backend: `api_keys` table with `key_type='aegis-mtp-pairing'`.
 * The atomic-claim contract on handshake is preserved EXACTLY per
 * CLAUDE.md (the `WHERE paired_at IS NULL AND pairing_window_expires_at
 * > NOW()` predicate stays inside the UPDATE; never refactor to
 * SELECT-then-UPDATE).
 *
 * Wire format: canonical `aegis_*` prefix, same as every other API
 * key in the system. The `key_type` discriminator (not the prefix
 * string) signals "this is a pairing key" — apps/mtp and any tooling
 * just treat all aegis credentials uniformly.
 *
 * SHA-256 hashing scheme matches `lib/api-keys.ts`. Only the hash is
 * stored; the full key is shown to the customer exactly once at
 * issuance.
 */

import { timingSafeEqual } from 'crypto'
import { pool, queryOne } from '@/lib/db'
import { generateApiKey, hashApiKey } from '@/lib/api-keys'

export interface GeneratedPairingKey {
  fullKey: string         // shown to customer once
  prefix: string          // first 12 chars, stored for UI display
  hash: string            // SHA-256, stored
}

/**
 * Generate a new pairing key. Reuses the canonical `aegis_*` format
 * from lib/api-keys — pairing keys are normal aegis keys
 * differentiated only by their key_type column in api_keys.
 */
export function generatePairingKey(): GeneratedPairingKey {
  const { fullKey, prefix, hash } = generateApiKey()
  return { fullKey, prefix, hash }
}

export function hashPairingKey(rawKey: string): string {
  return hashApiKey(rawKey)
}

export interface MtpPairingRecord {
  id: string
  organization_id: string
  display_name: string
  scopes: string[]
  status: 'active' | 'revoked'
  last_used_at: Date | null
}

/**
 * Verify a raw pairing key against api_keys. Returns the matching
 * active pairing or null if invalid/revoked.
 *
 * Constant-time hash comparison via timingSafeEqual. The DB lookup
 * is keyed on hash; the partial index
 * `idx_api_keys_pairing_lookup` makes this O(log n) for unpaired
 * keys.
 */
export async function verifyPairingKey(rawKey: string): Promise<MtpPairingRecord | null> {
  if (!rawKey.startsWith('aegis_')) return null

  const expectedHash = hashPairingKey(rawKey)
  const row = await queryOne<{
    id: string
    organization_id: string
    name: string
    key_hash: string
    scopes: string[]
    is_active: boolean
    is_revoked: boolean
    last_used_at: Date | null
  }>(
    `SELECT id, organization_id, name, key_hash, scopes,
            is_active, is_revoked, last_used_at
       FROM api_keys
      WHERE key_hash = $1
        AND key_type = 'aegis-mtp-pairing'
        AND is_active = true
        AND is_revoked = false
      LIMIT 1`,
    [expectedHash],
  )
  if (!row) return null

  // Defense in depth: timing-safe compare on the bytes themselves so a
  // row that somehow matched on a partial-collision SQL plan still
  // rejects on the bytes.
  const a = Buffer.from(row.key_hash, 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Fire-and-forget last_used_at touch; failures don't block the request.
  pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id])
    .catch(() => {})

  return {
    id: row.id,
    organization_id: row.organization_id,
    display_name: row.name,
    scopes: row.scopes,
    status: row.is_revoked ? 'revoked' : 'active',
    last_used_at: row.last_used_at,
  }
}

/**
 * Issue a new pairing. Returns the full key (caller is responsible
 * for showing it to the customer ONCE) plus the persisted record id.
 *
 * The 15-minute pairing window is set explicitly here (no DB DEFAULT
 * on the api_keys.pairing_window_expires_at column — that column is
 * nullable and used by every key type, not just pairings).
 *
 * After successful handshake, the key is bound for life of the
 * pairing — see completeHandshake() below.
 */
export async function issuePairing(opts: {
  organizationId: string
  displayName: string
  createdByUserId: string
  scopes?: string[]
}): Promise<{ id: string; fullKey: string; prefix: string; pairingWindowExpiresAt: Date }> {
  const generated = generatePairingKey()
  const scopes = opts.scopes && opts.scopes.length > 0 ? opts.scopes : ['tickets:read']

  const inserted = await queryOne<{ id: string; pairing_window_expires_at: Date }>(
    `INSERT INTO api_keys (
       organization_id, name, key_hash, key_prefix,
       scopes, permissions,
       rate_limit, is_active, ai_context_level,
       created_by,
       key_type, key_owner_user_id,
       pairing_window_expires_at
     ) VALUES (
       $1, $2, $3, $4,
       $5::text[], to_jsonb($5::text[]),
       500, true, 'technician',
       $6,
       'aegis-mtp-pairing', NULL,
       NOW() + INTERVAL '15 minutes'
     )
     RETURNING id, pairing_window_expires_at`,
    [opts.organizationId, opts.displayName, generated.hash, generated.prefix,
     scopes, opts.createdByUserId],
  )
  if (!inserted) throw new Error('Failed to insert pairing')
  return {
    id: inserted.id,
    fullKey: generated.fullKey,
    prefix: generated.prefix,
    pairingWindowExpiresAt: inserted.pairing_window_expires_at,
  }
}

/**
 * Atomically complete the handshake for a pairing key. Used ONLY by
 * the /api/v1/mtp/handshake route.
 *
 * The check-and-update is ONE SQL statement so two concurrent
 * handshakes (e.g., legitimate MTP and an attacker who got the key
 * in flight) can't both succeed — exactly one UPDATE matches the
 * predicate.
 *
 * **CRITICAL — DO NOT REFACTOR**: the
 * `WHERE paired_at IS NULL AND pairing_window_expires_at > NOW()`
 * predicate MUST live inside the UPDATE statement. The race-
 * prevention guarantee depends on the predicate being evaluated
 * atomically with the column write. A SELECT-then-UPDATE pattern
 * (even in a single transaction) reintroduces the race because the
 * row-level lock is taken too late. See CLAUDE.md "MTP pairing
 * model" / "atomic-claim" guidance.
 */
export type HandshakeOutcome =
  | { kind: 'ok'; pairing: MtpPairingRecord }
  | { kind: 'invalid' }
  | { kind: 'already_paired'; pairedAt: Date }
  | { kind: 'window_closed'; windowExpiresAt: Date }

export async function completeHandshake(opts: {
  rawKey: string
  fromIp: string | null
  userAgent: string | null
}): Promise<HandshakeOutcome> {
  if (!opts.rawKey.startsWith('aegis_')) {
    return { kind: 'invalid' }
  }

  const expectedHash = hashPairingKey(opts.rawKey)

  // Atomic claim: succeeds iff the key is active AND not yet paired
  // AND the window is still open. Diagnostic columns returned for
  // the loser-side error message.
  const claimed = await queryOne<{
    id: string
    organization_id: string
    name: string
    key_hash: string
    scopes: string[]
    last_used_at: Date | null
  }>(
    `UPDATE api_keys
        SET paired_at = NOW(),
            paired_from_ip = $2,
            paired_user_agent = $3,
            last_used_at = NOW()
      WHERE key_hash = $1
        AND key_type = 'aegis-mtp-pairing'
        AND is_active = true
        AND is_revoked = false
        AND paired_at IS NULL
        AND pairing_window_expires_at > NOW()
      RETURNING id, organization_id, name, key_hash, scopes, last_used_at`,
    [expectedHash, opts.fromIp, opts.userAgent],
  )

  if (claimed) {
    // Defense-in-depth timing-safe compare on bytes.
    const a = Buffer.from(claimed.key_hash, 'hex')
    const b = Buffer.from(expectedHash, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { kind: 'invalid' }

    return {
      kind: 'ok',
      pairing: {
        id: claimed.id,
        organization_id: claimed.organization_id,
        display_name: claimed.name,
        scopes: claimed.scopes,
        status: 'active',
        last_used_at: claimed.last_used_at,
      },
    }
  }

  // No row claimed — figure out why so the caller can return a
  // clear error. Look up by hash without the binding/window predicates.
  const row = await queryOne<{
    paired_at: Date | null
    pairing_window_expires_at: Date | null
    is_active: boolean
    is_revoked: boolean
  }>(
    `SELECT paired_at, pairing_window_expires_at, is_active, is_revoked
       FROM api_keys
      WHERE key_hash = $1
        AND key_type = 'aegis-mtp-pairing'
      LIMIT 1`,
    [expectedHash],
  )

  if (!row || !row.is_active || row.is_revoked) return { kind: 'invalid' }
  if (row.paired_at) return { kind: 'already_paired', pairedAt: row.paired_at }
  if (row.pairing_window_expires_at && row.pairing_window_expires_at <= new Date()) {
    return { kind: 'window_closed', windowExpiresAt: row.pairing_window_expires_at }
  }
  // Shouldn't happen: row is active + not paired + window open, but
  // UPDATE didn't claim it. Treat as transient and refuse.
  return { kind: 'invalid' }
}

/**
 * Extend the pairing window for an unpaired key. No-op if already
 * paired (binding is permanent — caller must re-issue instead).
 */
export async function extendPairingWindow(opts: {
  pairingId: string
  organizationId: string
  minutes: number
}): Promise<{ pairingWindowExpiresAt: Date } | null> {
  const minutes = Math.max(1, Math.min(60, Math.floor(opts.minutes)))
  const updated = await queryOne<{ pairing_window_expires_at: Date }>(
    `UPDATE api_keys
        SET pairing_window_expires_at = NOW() + ($3 * INTERVAL '1 minute')
      WHERE id = $1
        AND organization_id = $2
        AND key_type = 'aegis-mtp-pairing'
        AND is_active = true
        AND is_revoked = false
        AND paired_at IS NULL
      RETURNING pairing_window_expires_at`,
    [opts.pairingId, opts.organizationId, minutes],
  )
  if (!updated) return null
  return { pairingWindowExpiresAt: updated.pairing_window_expires_at }
}

export async function revokePairing(opts: {
  pairingId: string
  organizationId: string  // safety: callers must provide the org to prevent cross-org revocation
  reason: string
}): Promise<boolean> {
  const updated = await queryOne<{ id: string }>(
    `UPDATE api_keys
        SET is_revoked = true,
            is_active = false,
            revoked_at = NOW(),
            revoked_reason = $3
      WHERE id = $1
        AND organization_id = $2
        AND key_type = 'aegis-mtp-pairing'
        AND is_revoked = false
      RETURNING id`,
    [opts.pairingId, opts.organizationId, opts.reason],
  )
  return updated !== null
}
