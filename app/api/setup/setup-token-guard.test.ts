/**
 * First-run claim requires the one-time setup token (lib/first-run-token.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const state = { orgs: 0, users: 1 }

vi.mock('@/lib/db', () => ({
  pool: {
    query: async (sql: string) => {
      if (/FROM organizations/.test(sql)) return { rows: [{ n: state.orgs, count: String(state.orgs) }] }
      if (/COUNT\(\*\) as count FROM "user"/.test(sql)) return { rows: [{ count: String(state.users) }] }
      if (/SELECT id FROM "user" WHERE id/.test(sql)) return { rows: [{ id: 'ba-1' }] }
      return { rows: [{ id: 'row-1' }] }
    },
  },
}))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => ({ user: { id: 'ba-1', email: 'owner@example.com', name: 'Owner' } }) } },
}))
vi.mock('@/lib/seed-articles', () => ({ seedSystemArticles: vi.fn(async () => {}) }))
vi.mock('@/lib/seed-feature-registry', () => ({ seedFeatureRegistry: vi.fn(async () => {}) }))
vi.mock('@/lib/seed-policies', () => ({ seedPolicyArticles: vi.fn(async () => {}) }))
vi.mock('@/lib/seed-training', () => ({ seedTrainingArticles: vi.fn(async () => {}) }))
vi.mock('@/lib/seed-procedures', () => ({ seedProcedureArticles: vi.fn(async () => {}) }))
vi.mock('@/lib/features', () => ({ getPresetsForProfile: () => ({ defaults: {}, sources: {} }) }))
vi.mock('@/lib/telemetry', () => ({
  generateInstanceId: () => 'inst',
  sendInstallPing: vi.fn(async () => {}),
  sendSetupSnapshot: vi.fn(async () => {}),
  setTelemetryTier: vi.fn(async () => {}),
}))
vi.mock('@/lib/telemetry-consent', () => ({ setTelemetryEnabled: vi.fn(async () => {}) }))

const { ensureSetupToken, setupTokenPath, SETUP_TOKEN_HEADER } = await import('@/lib/first-run-token')
const setAdmin = await import('./set-admin/route')
const complete = await import('./complete/route')

function req(url: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== undefined) headers[SETUP_TOKEN_HEADER] = token
  return new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body), headers })
}

let dir: string
let token: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aegis-setup-guard-'))
  process.env.AEGIS_SECRETS_DIR = dir
  delete process.env.AEGIS_SETUP_TOKEN
  ;(globalThis as Record<string, unknown>).__aegisSetupToken = undefined
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.orgs = 0
  state.users = 1
  token = ensureSetupToken()
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

describe('POST /api/setup/set-admin', () => {
  it('refuses without the setup token', async () => {
    const res = await setAdmin.POST(req('/api/setup/set-admin', { userId: 'ba-1' }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('setup_token_invalid')
  })

  it('refuses a wrong setup token', async () => {
    const res = await setAdmin.POST(req('/api/setup/set-admin', { userId: 'ba-1' }, 'nope'))
    expect(res.status).toBe(403)
  })

  it('accepts the correct setup token', async () => {
    const res = await setAdmin.POST(req('/api/setup/set-admin', { userId: 'ba-1' }, token))
    expect(res.status).toBe(200)
  })

  it('is closed once an organization exists, token or not', async () => {
    state.orgs = 1
    const res = await setAdmin.POST(req('/api/setup/set-admin', { userId: 'ba-1' }, token))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/setup/complete', () => {
  it('refuses without the setup token', async () => {
    const res = await complete.POST(req('/api/setup/complete', { company_name: 'Acme' }))
    expect(res.status).toBe(403)
    expect(existsSync(setupTokenPath())).toBe(true)
  })

  it('refuses a wrong setup token', async () => {
    const res = await complete.POST(req('/api/setup/complete', { company_name: 'Acme' }, token + 'x'))
    expect(res.status).toBe(403)
  })

  it('with the correct token proceeds and destroys the token', async () => {
    const res = await complete.POST(req('/api/setup/complete', { company_name: 'Acme' }, token))
    expect(res.status).not.toBe(403)
    expect(existsSync(setupTokenPath())).toBe(false)
  })
})
