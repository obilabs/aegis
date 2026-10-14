/**
 * Step 9 + 11: AI is off by default and nothing depends on it; no funding asks
 * anywhere; a sweep of the main pages for crashes, 5xx and placeholder text.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import { ARTIFACTS, authFile, expect, expectPortalRendered, mustState, shot, watchPage } from './helpers'

test.describe.configure({ mode: 'serial' })

// Wording ObiLabs does not ship (lib/no-funding-asks.test.ts guards the source;
// this guards what is actually rendered, including anything that comes from
// the database or a dependency).
const FUNDING = /donat(e|ion|ing)|please\s+support\s+us|support\s+the\s+project|sponsor\s+(us|this)|buy\s+me\s+a\s+coffee|patreon|open\s*collective|ko-fi/i

const ADMIN_PAGES = [
  '/portal/dashboard',
  '/portal/tickets',
  '/portal/tickets/new',
  '/portal/assets',
  '/portal/assets/new',
  '/portal/companies',
  '/portal/companies/new',
  '/portal/contacts',
  '/portal/contacts/new',
  '/portal/kb',
  '/portal/kb/new',
  '/portal/documents',
  '/portal/reports',
  '/portal/activity',
  '/portal/policies',
  '/portal/account',
  '/portal/settings',
  '/portal/settings/users',
  '/portal/settings/roles',
  '/portal/settings/features',
  '/portal/settings/ai',
  '/portal/settings/telemetry',
  '/portal/settings/ticket-types',
  '/portal/settings/statuses',
  '/portal/settings/categories',
  '/portal/settings/email',
]
const PUBLIC_PAGES = ['/', '/portal/login', '/kb', '/privacy', '/terms']

test('AI features are off by default and the product works without them', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  const page = await ctx.newPage()
  const w = watchPage(page, '06 ai off')

  const features = (await (await page.request.get('/api/features')).json()).features as Array<{ key: string; enabled: boolean }>
  const aiOn = features.filter((f) => /^ai_/.test(f.key) && f.enabled).map((f) => f.key)
  expect(aiOn).toEqual([])

  await page.goto('/portal/chat')
  await expect(page.getByText('AI Assistant is not enabled')).toBeVisible()

  // Nothing points people at a disabled assistant.
  await page.goto('/portal/dashboard')
  await expectPortalRendered(page)
  await expect(page.getByRole('link', { name: 'Start Chat' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'AI Assistant' })).toHaveCount(0)

  await page.goto('/portal/settings/ai')
  await expectPortalRendered(page)
  await shot(page, '15-settings-ai')

  // Everything the earlier steps did (tickets, replies, KB, attachments) ran
  // with AI off; the ticket page still renders fully.
  await page.goto(`/portal/tickets/${mustState('ticketId')}`)
  await expect(page.getByRole('heading', { name: mustState('ticketSubject') })).toBeVisible()

  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})

test('page sweep: no crashes, no 5xx, no funding asks, placeholder text reported', async ({ browser }) => {
  const report: Array<{ page: string; problems: string[]; notes: string[] }> = []
  const failures: string[] = []

  async function sweep(storage: string | undefined, pages: string[], label: string) {
    const ctx = await browser.newContext(storage ? { storageState: storage } : {})
    for (const path of pages) {
      const page = await ctx.newPage()
      const w = watchPage(page, `06 sweep ${label} ${path}`)
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      const html = await page.content()
      const text = await page.locator('body').innerText().catch(() => '')
      const notes: string[] = []
      for (const re of [/coming soon/i, /lorem ipsum/i, /\bTODO\b/, /not (yet )?implemented/i]) {
        const m = text.match(re)
        if (m) notes.push(`placeholder text: "${m[0]}"`)
      }
      const funding = html.match(FUNDING)
      if (funding) failures.push(`${label} ${path}: funding wording "${funding[0]}"`)
      if (/Application error/.test(text)) failures.push(`${label} ${path}: client-side crash`)
      for (const p of w.serverErrors()) failures.push(`${label} ${path}: ${p}`)
      await shot(page, `sweep-${label}${path.replace(/\W+/g, '_')}`)
      report.push({ page: `${label} ${path}`, problems: w.problems, notes })
      w.flush()
      await page.close()
    }
    await ctx.close()
  }

  await sweep(authFile('admin'), ADMIN_PAGES, 'admin')
  await sweep(authFile('enduser'), ['/portal/dashboard', '/portal/tickets', '/portal/kb', '/portal/account'], 'enduser')
  await sweep(undefined, PUBLIC_PAGES, 'public')
  await sweep(undefined, [`/kb/${mustState('kbSlug')}`], 'public')

  mkdirSync(ARTIFACTS, { recursive: true })
  writeFileSync(join(ARTIFACTS, 'page-sweep.json'), JSON.stringify(report, null, 2))
  expect(failures).toEqual([])
})
