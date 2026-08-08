/**
 * HMAC-signed Message-ID for Aegis outbound email (D28b).
 *
 * Format:
 *   aegis-{instanceUuid}-{ticketId}-{replyId}-{hmac24hex}@{host}
 *
 * The hmac is the first 96 bits (12 bytes, 24 hex chars) of
 * HMAC-SHA256(instanceUuid + ":" + ticketId + ":" + replyId)
 * keyed by AEGIS_SECRETS_KEY. 96 bits per NIST SP 800-107 — enough forgery
 * resistance for a tag exposed at scale, 4 bytes cheaper than 128.
 *
 * Verification is timing-safe via crypto.timingSafeEqual on the binary HMAC.
 *
 * Key rotation (D28h): verify with the current key first; if a previous key
 * is configured, fall back once. Tagged via `signedByPreviousKey` on the
 * verification result so the ingest log can record which key matched.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'

const HMAC_TAG_BYTES = 12 // 96 bits — D28b
const HMAC_TAG_HEX_LEN = HMAC_TAG_BYTES * 2

const SIGNED_RE = /^aegis-([0-9a-f-]{36})-([0-9a-f-]{36})-([0-9a-f-]{36})-([0-9a-f]{24})@(.+)$/i

/**
 * Result of parsing an inbound Message-ID. `signed=false` covers both
 * "doesn't look like our format" and "looks like our format but the HMAC
 * didn't verify under any configured key."
 */
export type ParsedMessageId =
  | {
      signed: false
      /** True if the input matched the structural format but failed HMAC verification. */
      structurallyAegis: boolean
    }
  | {
      signed: true
      instanceUuid: string
      ticketId: string
      replyId: string
      host: string
      signedByPreviousKey: boolean
    }

export interface SigningKeys {
  /** Hex-encoded current key. Required. */
  currentKey: string
  /** Hex-encoded previous key. Optional — present during a rotation window. */
  previousKey?: string | null
}

/**
 * Read the signing key from a file (D28h: AEGIS_SECRETS_KEY_FILE convention).
 * Returns the raw hex string with whitespace trimmed.
 */
export function loadKeyFromFile(path: string): string {
  return readFileSync(path, 'utf8').trim()
}

/**
 * Resolve signing keys from env: prefers `*_FILE` paths (Docker secret),
 * falls back to bare env vars (dev convenience). Throws if no current key
 * is configured.
 */
export function resolveSigningKeysFromEnv(env: NodeJS.ProcessEnv = process.env): SigningKeys {
  let currentKey: string | undefined
  if (env.AEGIS_SECRETS_KEY_FILE) {
    currentKey = loadKeyFromFile(env.AEGIS_SECRETS_KEY_FILE)
  } else if (env.AEGIS_SECRETS_KEY) {
    currentKey = env.AEGIS_SECRETS_KEY.trim()
  }

  if (!currentKey) {
    throw new Error(
      'AEGIS_SECRETS_KEY missing — set AEGIS_SECRETS_KEY_FILE (production, Docker secret) or AEGIS_SECRETS_KEY (dev fallback).',
    )
  }

  let previousKey: string | undefined
  if (env.AEGIS_SECRETS_KEY_PREVIOUS_FILE) {
    try {
      previousKey = loadKeyFromFile(env.AEGIS_SECRETS_KEY_PREVIOUS_FILE)
    } catch {
      // Optional file — quiet on miss.
    }
  } else if (env.AEGIS_SECRETS_KEY_PREVIOUS) {
    previousKey = env.AEGIS_SECRETS_KEY_PREVIOUS.trim()
  }

  return { currentKey, previousKey: previousKey || null }
}

function hmacTagHex(key: string, payload: string): string {
  return createHmac('sha256', Buffer.from(key, 'hex'))
    .update(payload)
    .digest()
    .subarray(0, HMAC_TAG_BYTES)
    .toString('hex')
}

/**
 * Build the HMAC-signed outbound Message-ID per D28b. Signs with the
 * current key only — dual-signing doubles the verification surface for
 * attackers and gains nothing operationally.
 */
export function buildSignedMessageId(args: {
  instanceUuid: string
  ticketId: string
  replyId: string
  host: string
  keys: SigningKeys
}): string {
  const { instanceUuid, ticketId, replyId, host, keys } = args
  const tag = hmacTagHex(keys.currentKey, `${instanceUuid}:${ticketId}:${replyId}`)
  return `aegis-${instanceUuid}-${ticketId}-${replyId}-${tag}@${host}`
}

/**
 * Parse an inbound Message-ID. If it matches the Aegis-signed structural
 * format AND the HMAC verifies under the current key (or previous key
 * during a rotation window), returns the decoded fields. Otherwise returns
 * `{ signed: false }` — caller falls through to legacy header / subject-token
 * paths.
 *
 * Strips angle brackets if present so callers can pass headers verbatim.
 */
export function verifyMessageId(messageId: string, keys: SigningKeys): ParsedMessageId {
  const trimmed = messageId.trim().replace(/^<|>$/g, '')
  const m = SIGNED_RE.exec(trimmed)
  if (!m) {
    return { signed: false, structurallyAegis: false }
  }

  const [, instanceUuid, ticketId, replyId, providedHex, host] = m
  if (providedHex.length !== HMAC_TAG_HEX_LEN) {
    return { signed: false, structurallyAegis: true }
  }

  const expectedCurrent = hmacTagHex(keys.currentKey, `${instanceUuid}:${ticketId}:${replyId}`)
  if (timingSafeEqualHex(expectedCurrent, providedHex)) {
    return { signed: true, instanceUuid, ticketId, replyId, host, signedByPreviousKey: false }
  }

  if (keys.previousKey) {
    const expectedPrevious = hmacTagHex(keys.previousKey, `${instanceUuid}:${ticketId}:${replyId}`)
    if (timingSafeEqualHex(expectedPrevious, providedHex)) {
      return { signed: true, instanceUuid, ticketId, replyId, host, signedByPreviousKey: true }
    }
  }

  return { signed: false, structurallyAegis: true }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * Generate a 32-byte (64 hex char) AES/HMAC key. Used by the rotate-key CLI
 * and unit tests; not by the request path.
 */
export function generateKeyHex(): string {
  // 64 hex chars = 256 bits — matches the spec's `openssl rand -hex 32` example.
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}
