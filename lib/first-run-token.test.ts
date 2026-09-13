import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  currentSetupToken,
  destroySetupToken,
  ensureSetupToken,
  setupTokenFromHeaders,
  setupTokenPath,
  verifySetupToken,
  SETUP_TOKEN_HEADER,
} from './first-run-token'

describe('first-run setup token', () => {
  let dir: string
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aegis-setup-token-'))
    process.env.AEGIS_SECRETS_DIR = dir
    delete process.env.AEGIS_SETUP_TOKEN
    ;(globalThis as Record<string, unknown>).__aegisSetupToken = undefined
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    log.mockRestore()
    delete process.env.AEGIS_SECRETS_DIR
    delete process.env.AEGIS_SETUP_TOKEN
    rmSync(dir, { recursive: true, force: true })
  })

  it('has no token before one is ensured, and verification fails closed', () => {
    expect(currentSetupToken()).toBeNull()
    expect(verifySetupToken('anything')).toBe(false)
    expect(verifySetupToken('')).toBe(false)
  })

  it('generates a random token, persists it to the data volume, and logs it greppably', () => {
    const token = ensureSetupToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(readFileSync(setupTokenPath(), 'utf8')).toBe(token)
    if (process.platform !== 'win32') {
      expect(statSync(setupTokenPath()).mode & 0o777).toBe(0o600)
    }
    const logged = log.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toMatch(new RegExp(`setup token: ${token}`))
  })

  it('reuses the persisted token across calls (restart-safe) and logs once', () => {
    const a = ensureSetupToken()
    const b = ensureSetupToken()
    expect(b).toBe(a)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('two instances get different tokens', () => {
    const a = ensureSetupToken()
    destroySetupToken()
    const b = ensureSetupToken()
    expect(b).not.toBe(a)
  })

  it('AEGIS_SETUP_TOKEN pre-sets the token and writes no file', () => {
    process.env.AEGIS_SETUP_TOKEN = 'operator-chosen-token-value'
    expect(ensureSetupToken()).toBe('operator-chosen-token-value')
    expect(existsSync(setupTokenPath())).toBe(false)
    expect(verifySetupToken('operator-chosen-token-value')).toBe(true)
  })

  it('verifies only the exact token', () => {
    const token = ensureSetupToken()
    expect(verifySetupToken(token)).toBe(true)
    expect(verifySetupToken(token.slice(0, -1))).toBe(false)
    expect(verifySetupToken(token + 'x')).toBe(false)
    expect(verifySetupToken(undefined)).toBe(false)
    expect(verifySetupToken(123)).toBe(false)
  })

  it('reads the token from the request header', () => {
    const h = new Headers({ [SETUP_TOKEN_HEADER]: 'abc' })
    expect(setupTokenFromHeaders(h)).toBe('abc')
    expect(setupTokenFromHeaders(new Headers())).toBeNull()
  })

  it('is destroyed on completion', () => {
    const token = ensureSetupToken()
    destroySetupToken()
    expect(existsSync(setupTokenPath())).toBe(false)
    expect(verifySetupToken(token)).toBe(false)
  })

  it('picks up a token file written by another process (entrypoint / other bundle)', () => {
    writeFileSync(join(dir, 'setup-token'), 'from-disk-token\n')
    expect(verifySetupToken('from-disk-token')).toBe(true)
  })
})
