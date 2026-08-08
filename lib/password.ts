/**
 * Canonical credential-password hashing — must match Better Auth exactly.
 *
 * Better Auth passes the password and salt as STRINGS to scrypt (UTF-8). The
 * salt is the 32-char hex string itself (NOT decoded to 16 bytes) — decoding it
 * would produce a hash Better Auth can't verify on login (the 2026-06 salt-
 * encoding gotcha). Keep this the single source of truth so create-user, admin
 * reset, and the headless seed all agree.
 */
import { scrypt, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: Record<string, number>,
) => Promise<Buffer>

const SCRYPT_CONFIG = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }

/** Hash a plaintext password into Better Auth's `${saltHex}:${derivedKeyHex}` form. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password.normalize('NFKC'), salt, 64, SCRYPT_CONFIG)
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Generate a readable-enough temporary password for admin-driven onboarding /
 * reset (no SMTP required). ~13 chars, mixed case + digits, url-safe.
 */
export function generateTempPassword(): string {
  return randomBytes(10).toString('base64url').slice(0, 14)
}
