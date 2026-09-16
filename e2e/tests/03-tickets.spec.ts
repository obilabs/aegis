/**
 * Step 5-6: tickets from an end user and a technician, an inert hostile reply,
 * assignment, the status workflow to closed with timestamps and history, and a
 * ~5 MB attachment round trip (nginx body size + MinIO).
 */
import { createHash, randomBytes } from 'node:crypto'
import { test, type Page } from '@playwright/test'
import {
  ENDUSER, ORIGIN, TECH, authFile, expect, expectPortalRendered, mustState, saveState, shot, sql, uniq, watchPage,
} from './helpers'

test.describe.configure({ mode: 'serial' })

async function createTicketViaUi(page: Page, subject: string, description: string, files?: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  await page.goto('/portal/tickets/new')
  await expectPortalRendered(page)
  await page.getByRole('button', { name: /Hardware$/ }).click()
  await page.getByPlaceholder('Brief description of the issue').fill(subject)
  await page.locator('textarea').first().fill(description)
  if (files) {
    await page.getByTestId('new-ticket-attach-input').setInputFiles(files)
    await expect(page.getByTestId('new-ticket-pending-files')).toContainText(files[0].name)
  }
  const created = page.waitForResponse((r) => r.url().endsWith('/api/portal/tickets') && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Submit Ticket/ }).click()
  const res = await created
  expect(res.status(), await res.text()).toBe(201)
  const { id } = await res.json()
  await page.waitForURL(new RegExp(`/portal/tickets/${id}`), { timeout: 45_000 })
  await expect(page.getByRole('heading', { name: subject })).toBeVisible()
  return id as string
}

test('an end user raises a ticket and only sees their own tickets', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('enduser') })
  const page = await ctx.newPage()
  const w = watchPage(page, '03 end-user ticket')

  const subject = `Printer on floor 2 jams ${uniq()}`
  const id = await createTicketViaUi(page, subject, 'Every print job jams after two pages.')
  saveState({ endUserTicketId: id, endUserTicketSubject: subject })
  await shot(page, '09-enduser-ticket')

  // End users do not get to re-status a ticket; the UI must say so, not pretend.
  const statusRes = await page.request.patch(`/api/portal/tickets/${id}`, {
    headers: { origin: ORIGIN }, data: { priority: 'critical' },
  })
  expect(statusRes.status()).toBe(403)

  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})

test('a technician raises a ticket (with an attachment) and replies with hostile markup that renders inert', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('tech') })
  const page = await ctx.newPage()
  const w = watchPage(page, '03 tech ticket')
  const dialogs: string[] = []
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}) })

  const subject = `Laptop will not boot ${uniq()}`
  const small = { name: 'boot-screen.txt', mimeType: 'text/plain', buffer: Buffer.from('black screen after logo\n') }
  const id = await createTicketViaUi(page, subject, 'Black screen after the vendor logo.', [small])
  saveState({ ticketId: id, ticketSubject: subject })
  await expect(page.getByTestId('ticket-attachments')).toContainText('boot-screen.txt')

  // A normal reply through the editor.
  const editor = page.locator('[contenteditable="true"]').first()
  await editor.click()
  await page.keyboard.type('Hello from the technician. Can you try a hard reset?')
  const sent = page.waitForResponse((r) => r.url().endsWith(`/api/portal/tickets/${id}/replies`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send Reply' }).click()
  expect((await sent).status()).toBe(201)
  await expect(page.getByText('Can you try a hard reset?')).toBeVisible()

  // Hostile rich text, posted straight to the API the editor uses (an attacker
  // does not have to go through the editor).
  const marker = `xss-probe-${uniq()}`
  const payload =
    `<p>${marker}</p>` +
    `<img src=x onerror=alert(1)>` +
    `<img src=x onerror="window.__xssImg=1">` +
    `<script>window.__xssScript=1;alert(2)</script>` +
    `<a href="javascript:alert(3)">click me</a>` +
    `<svg onload="window.__xssSvg=1"></svg>`
  const hostile = await page.request.post(`/api/portal/tickets/${id}/replies`, {
    headers: { origin: ORIGIN }, data: { content: payload, is_internal: false },
  })
  expect(hostile.status()).toBe(201)

  await page.reload()
  await expect(page.getByText(marker)).toBeVisible()
  await page.waitForTimeout(1_500) // give any injected handler a chance to fire
  expect(dialogs).toEqual([])
  const flags = await page.evaluate(() => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img: (window as any).__xssImg, script: (window as any).__xssScript, svg: (window as any).__xssSvg,
    onerror: document.querySelectorAll('[onerror]').length,
    onload: document.querySelectorAll('[onload]').length,
    jsLinks: document.querySelectorAll('a[href^="javascript:" i]').length,
    inlineProbeScripts: [...document.querySelectorAll('script')].filter((s) => s.textContent?.includes('__xssScript')).length,
  }))
  expect(flags).toEqual({ img: undefined, script: undefined, svg: undefined, onerror: 0, onload: 0, jsLinks: 0, inlineProbeScripts: 0 })
  // And it is not stored in a dangerous form either.
  const stored = sql(`SELECT content FROM ticket_replies WHERE content LIKE '%${marker}%'`)
  expect(stored).toContain(marker)
  expect(stored).not.toMatch(/onerror|<script|javascript:|onload/i)
  await shot(page, '10-hostile-reply-inert')

  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})

test('a ~5 MB attachment uploads through nginx and downloads back byte-identical', async ({ browser }) => {
  const id = mustState('ticketId')
  const ctx = await browser.newContext({ storageState: authFile('tech') })
  const page = await ctx.newPage()
  const w = watchPage(page, '03 attachment')

  const buffer = randomBytes(5 * 1024 * 1024 + 123)
  const sha = createHash('sha256').update(buffer).digest('hex')
  await page.goto(`/portal/tickets/${id}`)
  await expectPortalRendered(page)
  const uploaded = page.waitForResponse((r) => r.url().endsWith(`/api/portal/tickets/${id}/attachments`) && r.request().method() === 'POST')
  await page.getByTestId('ticket-attach-input').setInputFiles({ name: 'diagnostics.zip', mimeType: 'application/zip', buffer })
  const up = await uploaded
  expect(up.status(), await up.text()).toBe(201)
  const link = page.getByTestId('ticket-attachments').getByRole('link', { name: 'diagnostics.zip' })
  await expect(link).toBeVisible()
  await expect(page.getByTestId('ticket-attachments')).toContainText('5.0 MB')

  const download = await page.request.get((await link.getAttribute('href'))!)
  expect(download.status()).toBe(200)
  expect(download.headers()['content-disposition']).toContain('diagnostics.zip')
  const body = await download.body()
  expect(body.length).toBe(buffer.length)
  expect(createHash('sha256').update(body).digest('hex')).toBe(sha)
  saveState({ attachmentUrl: (await link.getAttribute('href'))!, attachmentSha: sha })
  await shot(page, '11-attachment')

  // Someone who cannot see the ticket cannot see or fetch its files.
  const end = await browser.newContext({ storageState: authFile('enduser') })
  expect((await end.request.get(`/api/portal/tickets/${id}`)).status()).toBe(404)
  expect((await end.request.get(`/api/portal/tickets/${id}/attachments`)).status()).toBe(404)
  expect((await end.request.get((await link.getAttribute('href'))!)).status()).toBe(404)
  await end.close()

  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})

test('admin assigns the end user ticket to the technician, who works it to closed', async ({ browser }) => {
  const id = mustState('endUserTicketId')

  // Before assignment the ticket is outside a team-scoped technician's view.
  const before = await browser.newContext({ storageState: authFile('tech') })
  expect((await before.request.get(`/api/portal/tickets/${id}`)).status()).toBe(404)
  expect((await before.request.patch(`/api/portal/tickets/${id}`, { headers: { origin: ORIGIN }, data: { priority: 'high' } })).status()).toBe(404)
  await before.close()

  const admin = await browser.newContext({ storageState: authFile('admin') })
  const page = await admin.newPage()
  const w = watchPage(page, '03 assign + workflow')

  await page.goto(`/portal/tickets/${id}`)
  await expectPortalRendered(page)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const assign = page.locator('label:has-text("Assigned To") + select')
  await assign.selectOption({ label: `${TECH.first} ${TECH.last}` })
  const saved = page.waitForResponse((r) => r.url().endsWith(`/api/portal/tickets/${id}`) && r.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByText(`${TECH.first} ${TECH.last}`).first()).toBeVisible()
  expect(sql(`SELECT u.email FROM tickets t JOIN users u ON u.id = t.assigned_to WHERE t.id = '${id}'`)).toBe(TECH.email)
  await admin.close()

  // The technician moves it through the workflow.
  const techCtx = await browser.newContext({ storageState: authFile('tech') })
  const tech = await techCtx.newPage()
  const tw = watchPage(tech, '03 tech workflow')
  await tech.goto(`/portal/tickets/${id}`)
  await expectPortalRendered(tech)

  async function changeStatus(name: string, resolution?: { cause: string; fix: string }) {
    await tech.getByRole('button', { name: 'Change Status' }).click()
    const patched = tech.waitForResponse((r) => r.url().endsWith(`/api/portal/tickets/${id}`) && r.request().method() === 'PATCH')
    await tech.getByRole('button', { name, exact: true }).click()
    if (resolution) {
      await tech.getByPlaceholder(/account was locked/).fill(resolution.cause)
      await tech.getByPlaceholder(/Unlocked the account/).fill(resolution.fix)
      await tech.getByRole('button', { name: 'Save & Resolve' }).click()
    }
    const res = await patched
    expect(res.status(), `${name}: ${await res.text()}`).toBe(200)
    await expect(tech.getByTestId('ticket-action-error')).toHaveCount(0)
    const current = await (await tech.request.get(`/api/portal/tickets/${id}`)).json()
    expect(current.ticket.status).toBe(name)
    return current.ticket
  }

  await changeStatus('In Progress')
  const resolved = await changeStatus('Resolved', { cause: 'Corrupted boot record', fix: 'Repaired the boot record from recovery media' })
  expect(resolved.resolved_at).toBeTruthy()
  expect(resolved.root_cause).toBe('Corrupted boot record')
  const closed = await changeStatus('Closed', { cause: 'Corrupted boot record', fix: 'Confirmed with the user' })
  expect(new Date(closed.resolved_at).getTime()).toBeGreaterThan(new Date(closed.created_at).getTime() - 1)

  // Timestamps on the page, and an audit trail of who changed what.
  await tech.reload()
  await expect(tech.getByText('Resolved', { exact: true }).last()).toBeVisible()
  await tech.getByRole('button', { name: /History/ }).click()
  await expect(tech.getByText(/Changed\s+status\s+from/).first()).toBeVisible()
  await shot(tech, '12-ticket-closed-history')

  const history = await (await tech.request.get(`/api/portal/tickets/${id}/history`)).json()
  const statusChanges = history.events.filter((e: { field_name: string }) => e.field_name === 'status_id')
  const targets = statusChanges.map((e: { new_display: string }) => e.new_display)
  expect(targets).toEqual(expect.arrayContaining(['In Progress', 'Resolved', 'Closed']))
  expect(history.events.some((e: { field_name: string; new_display?: string }) => e.field_name === 'assigned_to' && e.new_display === `${TECH.first} ${TECH.last}`)).toBeTruthy()
  expect(Number(sql(`SELECT COUNT(*) FROM audit_log WHERE entity_id = '${id}'`))).toBeGreaterThanOrEqual(3)

  // Reassignment is still a triage action for a technician.
  const reassign = await tech.request.patch(`/api/portal/tickets/${id}`, { headers: { origin: ORIGIN }, data: { assigned_to: '' } })
  expect(reassign.status()).toBe(403)

  expect(w.serverErrors()).toEqual([])
  expect(tw.serverErrors()).toEqual([])
  w.flush()
  tw.flush()
  await techCtx.close()
})

test('internal notes stay internal', async ({ browser }) => {
  const id = mustState('endUserTicketId')
  const tech = await browser.newContext({ storageState: authFile('tech') })
  // An admin writes the note on the end user's ticket.
  const admin = await browser.newContext({ storageState: authFile('admin') })
  const note = `internal-only ${uniq()}`
  const posted = await admin.request.post(`/api/portal/tickets/${id}/replies`, {
    headers: { origin: ORIGIN }, data: { content: `<p>${note}</p>`, is_internal: true },
  })
  expect(posted.status()).toBe(201)

  const end = await browser.newContext({ storageState: authFile('enduser') })
  const view = await (await end.request.get(`/api/portal/tickets/${id}`)).json()
  expect(JSON.stringify(view.replies)).not.toContain(note)
  const history = await (await end.request.get(`/api/portal/tickets/${id}/history`)).json()
  expect(history.events.some((e: { is_internal?: boolean }) => e.is_internal)).toBeFalsy()
  // ...and an end user cannot write one.
  const own = await end.request.post(`/api/portal/tickets/${id}/replies`, {
    headers: { origin: ORIGIN }, data: { content: 'sneaky internal', is_internal: true },
  })
  expect(own.status()).toBe(403)
  // ...or reply to someone else's ticket.
  const other = await end.request.post(`/api/portal/tickets/${mustState('ticketId')}/replies`, {
    headers: { origin: ORIGIN }, data: { content: 'not mine', is_internal: false },
  })
  expect(other.status()).toBe(404)

  const endPage = await end.newPage()
  await endPage.goto(`/portal/tickets/${id}`)
  await expect(endPage.getByRole('heading', { name: mustState('endUserTicketSubject') })).toBeVisible()
  await expect(endPage.getByText(note)).toHaveCount(0)
  expect(ENDUSER.email).toContain('@')

  await Promise.all([tech.close(), admin.close(), end.close()])
})
