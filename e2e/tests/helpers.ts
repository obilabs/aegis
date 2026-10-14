import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const REPO_ROOT = resolve(__dirname, '..', '..')
export const ARTIFACTS = resolve(__dirname, '..', 'artifacts')
const STATE_FILE = join(ARTIFACTS, 'state.json')

export const BASE_URL = process.env.AEGIS_E2E_URL || 'http://localhost:18480'
export const ORIGIN = new URL(BASE_URL).origin

/** The compose command for the isolated test stack (run.sh exports it). */
export const COMPOSE =
  process.env.AEGIS_E2E_COMPOSE ||
  'docker compose -p aegis-e2e --env-file e2e/.env.e2e -f docker-compose.yml -f e2e/compose.e2e.yml'

export function compose(args: string, timeoutMs = 600_000): string {
  return execSync(`${COMPOSE} ${args}`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
}

/** Read the one-time setup token from the app log, the way the README says. */
export function setupTokenFromLogs(): string | null {
  const logs = compose('logs aegis')
  const matches = [...logs.matchAll(/setup token: (\S+)/g)]
  return matches.length ? matches[matches.length - 1][1] : null
}

/** psql against the test database (for assertions the UI cannot show). */
export function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return compose(`exec -T db psql -U aegis -d aegis -At -c "${escaped}"`).trim()
}

/** Shared state between spec files (they run serially, in file order). */
export type WalkState = Record<string, string>
export function loadState(): WalkState {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {}
}
export function saveState(patch: WalkState): WalkState {
  mkdirSync(ARTIFACTS, { recursive: true })
  const next = { ...loadState(), ...patch }
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2))
  return next
}
export function mustState(key: string): string {
  const v = loadState()[key]
  if (!v) throw new Error(`state "${key}" missing: run the specs in order (npx playwright test)`)
  return v
}

export const authFile = (who: 'admin' | 'tech' | 'enduser') => join(ARTIFACTS, `auth-${who}.json`)

/**
 * Test accounts. Passwords are generated per run (never committed) and kept in
 * artifacts/state.json so later spec files can sign in as the same people.
 */
export function generatedPassword(key: string): string {
  const existing = loadState()[key]
  if (existing) return existing
  const value = `E2e-${randomBytes(12).toString('base64url')}-9a`
  saveState({ [key]: value })
  return value
}
export const ADMIN = { name: 'Ada Admin', email: 'admin@e2e.example.com', get password() { return generatedPassword('pw.admin') } }
export const TECH = { first: 'Tess', last: 'Technician', email: 'tech@e2e.example.com', get password() { return generatedPassword('pw.tech') } }
export const ENDUSER = { first: 'Eddie', last: 'Enduser', email: 'enduser@e2e.example.com', get password() { return generatedPassword('pw.enduser') } }

/**
 * Records console errors, uncaught page errors and 4xx/5xx responses for a
 * page. `flush()` appends them to artifacts/browser-issues.log, and
 * `serverErrors()` returns the 5xx ones so a step can fail on them.
 */
export function watchPage(page: Page, label: string) {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
      problems.push(`console: ${msg.text().slice(0, 300)}`)
    }
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message.slice(0, 300)}`))
  page.on('response', (res) => {
    const url = res.url()
    if (res.status() >= 400 && !url.includes('/_next/')) {
      problems.push(`http ${res.status()} ${res.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`)
    }
  })
  return {
    problems,
    serverErrors: () => problems.filter((p) => /^http 5\d\d /.test(p) || p.startsWith('pageerror')),
    flush() {
      mkdirSync(ARTIFACTS, { recursive: true })
      const file = join(ARTIFACTS, 'browser-issues.log')
      const prev = existsSync(file) ? readFileSync(file, 'utf8') : ''
      writeFileSync(file, prev + problems.map((p) => `[${label}] ${p}`).join('\n') + (problems.length ? '\n' : ''))
    },
  }
}

export async function shot(page: Page, name: string) {
  mkdirSync(join(ARTIFACTS, 'screenshots'), { recursive: true })
  await page.screenshot({ path: join(ARTIFACTS, 'screenshots', `${name}.png`), fullPage: true })
}

/** Sign in through the login form and wait for a rendered portal page. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/portal/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/portal\/(?!login)/, { timeout: 45_000 })
  await expectPortalRendered(page)
}

/** The portal shell is on screen and the page did not crash. */
export async function expectPortalRendered(page: Page) {
  await expect(page.getByText('Application error')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Application error')).toHaveCount(0)
}

export async function waitForHealthy(request: APIRequestContext, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs
  let last = ''
  while (Date.now() < deadline) {
    try {
      const res = await request.get('/api/health', { timeout: 5_000 })
      if (res.ok()) return
      last = `status ${res.status()}`
    } catch (err) {
      last = (err as Error).message
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
  throw new Error(`stack not healthy after ${timeoutMs}ms (${last})`)
}

export const uniq = () => Date.now().toString(36)

export { expect }
