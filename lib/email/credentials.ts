/**
 * Mailbox credential encryption — AES-256-GCM with the AEGIS_SECRETS_KEY (D32).
 *
 * Key sourced from a file path (`AEGIS_SECRETS_KEY_FILE`, Docker secret) or
 * the bare env var (dev only). 32-byte key → 256-bit AES.
 *
 * Output format (all base64url):
 *   v1.<nonce>.<ciphertext>.<authTag>
 *
 * Versioned so the at-rest format can change without breaking existing rows
 * (rotation script re-encrypts under the new key + same v1 envelope).
 *
 * Never logged. Never returned over the API. The db column stores ONLY the
 * envelope string; the plaintext password lives in memory for the duration
 * of one IMAP poll.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { resolveSigningKeysFromEnv } from './signing'

const ALGO = 'aes-256-gcm'
const NONCE_BYTES = 12 // recommended for GCM
const TAG_BYTES = 16

interface SymmetricKeys {
  current: Buffer
  previous: Buffer | null
}

/**
 * Resolve the symmetric key(s) from env. Reuses `resolveSigningKeysFromEnv`
 * — the same hex-encoded 32-byte key serves both HMAC signing (D28b) and
 * credential encryption (D32). If the key is shorter than 32 bytes the
 * cipher will throw at use time.
 */
export function loadSymmetricKeys(env: NodeJS.ProcessEnv = process.env): SymmetricKeys {
  const { currentKey, previousKey } = resolveSigningKeysFromEnv(env)
  return {
    current: Buffer.from(currentKey, 'hex'),
    previous: previousKey ? Buffer.from(previousKey, 'hex') : null,
  }
}

/**
 * Encrypt a plaintext credential string under the current key. Returns the
 * `v1.<nonce>.<ciphertext>.<authTag>` envelope (URL-safe base64 in each
 * field).
 */
export function encryptCredential(plaintext: string, keys: SymmetricKeys): string {
  if (keys.current.length !== 32) {
    throw new Error(
      `AEGIS_SECRETS_KEY must be 32 bytes (64 hex chars); got ${keys.current.length} bytes`,
    )
  }
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(ALGO, keys.current, nonce)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${b64u(nonce)}.${b64u(ct)}.${b64u(tag)}`
}

/**
 * Decrypt an envelope. Tries the current key first, falls back to previous
 * once (D28h rotation window). Throws on tampering or missing key.
 */
export function decryptCredential(envelope: string, keys: SymmetricKeys): string {
  const parts = envelope.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('credential envelope: malformed (expected v1.<nonce>.<ct>.<tag>)')
  }
  const [, nonceB64, ctB64, tagB64] = parts
  const nonce = b64uDecode(nonceB64)
  const ct = b64uDecode(ctB64)
  const tag = b64uDecode(tagB64)
  if (tag.length !== TAG_BYTES) {
    throw new Error(`credential envelope: auth tag length ${tag.length} != ${TAG_BYTES}`)
  }

  for (const candidate of [keys.current, keys.previous].filter((k): k is Buffer => k !== null)) {
    try {
      const decipher = createDecipheriv(ALGO, candidate, nonce)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    } catch {
      // try next key
    }
  }
  throw new Error('credential envelope: decrypt failed under all configured keys')
}

function b64u(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64uDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + padding, 'base64')
}
