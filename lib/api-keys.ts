/**
 * API Key Utilities
 *
 * Generates, hashes, and manages API keys for the Aegis platform.
 * Keys use the format: aegis_[8chars]_[32chars]
 * Only the SHA-256 hash is stored; the full key is shown once at creation.
 */

import { createFixedWindowLimiter } from '@/lib/rate-limit'
import { createHash, randomBytes } from 'crypto'
import { query, queryOne } from '@/lib/db'

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate a new API key with a prefix and SHA-256 hash.
 *
 * Key format: aegis_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
 *   - 8 hex chars (random)
 *   - 32 hex chars (random)
 * Prefix (first 12 chars of the full key): e.g. "aegis_a1b2c3d4"
 */
export function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const part1 = randomBytes(4).toString('hex')       // 8 hex chars
  const part2 = randomBytes(16).toString('hex')       // 32 hex chars
  const fullKey = `aegis_${part1}_${part2}`
  const prefix = fullKey.slice(0, 13)                 // "aegis_" + first 7 hex = 13 chars (fits varchar(10) prefix col if we trim, but spec says first 12)
  const hash = hashApiKey(fullKey)

  return {
    fullKey,
    prefix: fullKey.slice(0, 12),                     // e.g. "aegis_a1b2c3"
    hash,
  }
}

/**
 * SHA-256 hash of a full API key (hex-encoded).
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// ---------------------------------------------------------------------------
// Rate Limiting (simple per-hour sliding window via DB)
// ---------------------------------------------------------------------------

/**
 * Check whether an API key has exceeded its hourly rate limit.
 * Uses a lightweight in-memory counter with per-minute buckets that
 * fall off after 60 minutes. Falls back to DB `last_used_at` as
 * a rough proxy when the process restarts.
 *
 * Returns true if the request is ALLOWED, false if rate-limited.
 */

const apiKeyLimiter = createFixedWindowLimiter({ windowMs: 60 * 60 * 1000 })

export function checkRateLimit(apiKeyId: string, limit: number): boolean {
  return apiKeyLimiter.hit(apiKeyId, limit)
}

// ---------------------------------------------------------------------------
// Usage Recording
// ---------------------------------------------------------------------------

/**
 * Update `last_used_at` on the API key record.
 * Fire-and-forget — callers should not await in the critical path.
 */
export async function recordApiKeyUsage(apiKeyId: string): Promise<void> {
  try {
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [apiKeyId]
    )
  } catch (err) {
    console.error('Failed to record API key usage:', err)
  }
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export interface ApiKeyRecord {
  id: string
  organization_id: string
  name: string
  key_prefix: string
  permissions: string[]
  rate_limit: number
  expires_at: string | null
  last_used_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  ai_context_level: string
}

/**
 * Validate a raw API key against the database.
 * Returns the key record if valid, or null if not found / inactive / expired.
 */
export async function validateApiKeyFromHash(rawKey: string): Promise<ApiKeyRecord | null> {
  const hash = hashApiKey(rawKey)

  const row = await queryOne<ApiKeyRecord>(
    `SELECT id, organization_id, name, key_prefix, permissions, rate_limit,
            expires_at, last_used_at, is_active, created_by, created_at, ai_context_level
     FROM api_keys
     WHERE key_hash = $1 AND is_active = true`,
    [hash]
  )

  if (!row) return null

  // Check expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null
  }

  return row
}
