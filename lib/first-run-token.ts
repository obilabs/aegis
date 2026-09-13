/**
 * First-run setup token (the "initial admin password" pattern).
 *
 * While no organization exists (nobody has completed setup, so no admin),
 * claiming the instance requires a one-time token that only the operator can
 * see: it is printed to the container log and written to the data volume.
 *
 *   docker compose logs aegis | grep 'setup token'
 *   cat ./data/secrets/setup-token
 *
 * Resolution order:
 *   1. `AEGIS_SETUP_TOKEN` env (pre-set by the operator, e.g. scripted deploys)
 *   2. the persisted file `${AEGIS_SECRETS_DIR}/setup-token`
 *   3. a freshly generated random token, persisted 0600 (in-memory fallback if
 *      the volume is not writable)
 *
 * It is required by the first-user sign-up, /api/setup/set-admin and
 * /api/setup/complete, compared in constant time, and destroyed when setup
 * completes. Distinct from `lib/setup-tokens.ts` (per-user set-password links).
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SETUP_TOKEN_HEADER } from '@/lib/first-run-client'

export { SETUP_TOKEN_HEADER }
const FILE_NAME = 'setup-token'

// Route handlers and instrumentation can be separate bundles; share the
// in-memory fallback + "already logged" flag through globalThis.
const g = globalThis as unknown as {
  __aegisSetupToken?: { memory: string | null; logged: boolean }
}
function state() {
  if (!g.__aegisSetupToken) g.__aegisSetupToken = { memory: null, logged: false }
  return g.__aegisSetupToken
}

export function setupTokenPath(): string {
  return join(process.env.AEGIS_SECRETS_DIR || '/app/data/secrets', FILE_NAME)
}

function fromEnv(): string | null {
  const v = process.env.AEGIS_SETUP_TOKEN?.trim()
  return v ? v : null
}

function fromFile(): string | null {
  try {
    const file = setupTokenPath()
    if (!existsSync(file)) return null
    const v = readFileSync(file, 'utf8').trim()
    return v || null
  } catch {
    return null
  }
}

/** The current token, if one exists. Never generates. */
export function currentSetupToken(): string | null {
  return fromEnv() ?? fromFile() ?? state().memory
}

/**
 * Make sure a token exists (generating + persisting one if needed) and log it
 * once per process. Call only while setup is still open.
 */
export function ensureSetupToken(): string {
  const s = state()
  let token = currentSetupToken()
  let persistedTo: string | null = fromEnv() ? 'AEGIS_SETUP_TOKEN' : token ? setupTokenPath() : null

  if (!token) {
    token = randomBytes(24).toString('base64url')
    const file = setupTokenPath()
    try {
      mkdirSync(join(file, '..'), { recursive: true, mode: 0o700 })
      writeFileSync(file, token, { mode: 0o600 })
      persistedTo = file
    } catch (err) {
      s.memory = token
      persistedTo = null
      console.error(
        `[setup] could not write the setup token to ${file} (${(err as Error).message}); ` +
          'it is held in memory and will change on restart.',
      )
    }
  }

  if (!s.logged) {
    s.logged = true
    const where = persistedTo === 'AEGIS_SETUP_TOKEN'
      ? 'from AEGIS_SETUP_TOKEN'
      : persistedTo
        ? `also saved to ${persistedTo}`
        : 'not persisted'
    const bar = '='.repeat(64)
    console.log(
      `\n${bar}\n` +
        'Aegis is not set up yet. Open /portal/setup and enter this setup token:\n\n' +
        `  setup token: ${token}\n\n` +
        `(${where}; it is removed once setup completes)\n` +
        `${bar}\n`,
    )
  }
  return token
}

function digest(v: string): Buffer {
  return createHash('sha256').update(v, 'utf8').digest()
}

/** Constant-time check of a candidate against the current token. */
export function verifySetupToken(candidate: unknown): boolean {
  const expected = currentSetupToken()
  if (!expected || typeof candidate !== 'string' || candidate.length === 0) return false
  // Hash both sides so the comparison is fixed-length regardless of input.
  return timingSafeEqual(digest(candidate.trim()), digest(expected))
}

/** Read the token a request presents (header). */
export function setupTokenFromHeaders(headers: Headers | null | undefined): string | null {
  return headers?.get(SETUP_TOKEN_HEADER) ?? null
}

/** Remove the persisted / in-memory token once setup has completed. */
export function destroySetupToken(): void {
  state().memory = null
  try {
    const file = setupTokenPath()
    if (existsSync(file)) unlinkSync(file)
  } catch (err) {
    console.error('[setup] could not remove the setup token file:', (err as Error).message)
  }
}
