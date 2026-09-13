/**
 * Step 10: `docker compose down` (no -v) then `up`: data, files, secrets and
 * sessions survive, and setup stays closed.
 */
import { test } from '@playwright/test'
import {
  ADMIN, authFile, compose, expect, expectPortalRendered, mustState, setupTokenFromLogs, signIn, sql, waitForHealthy,
} from './helpers'
import { createHash } from 'node:crypto'

test.describe.configure({ mode: 'serial' })

test('data, attachments, secrets and sessions survive a stack restart', async ({ browser, request }) => {
  test.setTimeout(600_000)
  const before = {
    tickets: sql('SELECT COUNT(*) FROM tickets'),
    users: sql('SELECT COUNT(*) FROM users'),
    feedback: sql('SELECT COUNT(*) FROM kb_article_feedback'),
    assets: sql('SELECT COUNT(*) FROM assets'),
  }

  compose('down', 300_000)
  compose('up -d', 300_000)
  await waitForHealthy(request)

  // Setup is still closed: no new token is printed and the claim form is gone.
  expect(setupTokenFromLogs()).toBeNull()
  const status = await (await request.get('/api/setup/status')).json()
  expect(status).toMatchObject({ setupRequired: false, wizardRequired: false })

  expect({
    tickets: sql('SELECT COUNT(*) FROM tickets'),
    users: sql('SELECT COUNT(*) FROM users'),
    feedback: sql('SELECT COUNT(*) FROM kb_article_feedback'),
    assets: sql('SELECT COUNT(*) FROM assets'),
  }).toEqual(before)

  // A session issued before the restart is still valid: the auth secret was
  // persisted, not regenerated.
  const old = await browser.newContext({ storageState: authFile('tech') })
  const session = await (await old.request.get('/api/auth/get-session')).json()
  expect(session?.user?.email).toBeTruthy()
  // The ticket API must answer for the pre-restart session. Poll briefly: in
  // CI the first requests after `up` occasionally land before the app has
  // finished warming its database pool, and the page renders "not found" for
  // any failed fetch. Record what came back so a real regression is visible.
  const ticketUrl = `/api/portal/tickets/${mustState('ticketId')}`
  const seen: number[] = []
  await expect(async () => {
    const res = await old.request.get(ticketUrl)
    seen.push(res.status())
    expect(res.status()).toBe(200)
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] })
  if (seen.length > 1) console.log(`ticket API after restart answered ${seen.join(', ')} before 200`)
  const oldPage = await old.newPage()
  await oldPage.goto(`/portal/tickets/${mustState('ticketId')}`)
  await expect(oldPage.getByRole('heading', { name: mustState('ticketSubject') })).toBeVisible()

  // The 5 MB attachment is still in object storage, byte-identical.
  const file = await old.request.get(mustState('attachmentUrl'))
  expect(file.status()).toBe(200)
  expect(createHash('sha256').update(await file.body()).digest('hex')).toBe(mustState('attachmentSha'))
  await old.close()

  // And a fresh sign-in works.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await signIn(page, ADMIN.email, ADMIN.password)
  await expectPortalRendered(page)
  await page.goto(`/kb/${mustState('kbSlug')}`)
  await expect(page.getByRole('heading', { name: mustState('kbTitle') })).toBeVisible()
  await ctx.close()
})
