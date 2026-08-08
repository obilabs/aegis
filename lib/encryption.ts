/**
 * AES-256-GCM encryption for credential vault.
 *
 * Stored format: base64( iv[12] + authTag[16] + ciphertext )
 * Key: 32-byte hex string from CREDENTIAL_ENCRYPTION_KEY env var
 */

import crypto from 'node:crypto'
import { resolveSecret } from './secret-bootstrap'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  // Env wins; otherwise a persisted/auto-generated 32-byte key so the vault
  // works on a minimal .env (spec: zero-config-secret-bootstrap). A malformed
  // EXPLICIT env value is returned by resolveSecret and still fails the length
  // check below — we never silently replace an operator-supplied key (D4).
  const hex = resolveSecret('CREDENTIAL_ENCRYPTION_KEY')
  if (!hex || hex.length !== 64) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Omit it entirely to have one auto-generated + persisted to ./data/secrets/, ' +
      'or generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

/** Encrypt plaintext → base64 string */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/** Decrypt base64 string → plaintext */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const data = Buffer.from(ciphertext, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
}
