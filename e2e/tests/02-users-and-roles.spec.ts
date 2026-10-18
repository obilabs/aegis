/**
 * Step 3-4: sign out / in, invite a technician and an end user, and prove a
 * non-admin cannot give themselves admin (UI and API).
 */
import { test, type Browser, type Page } from '@playwright/test'
import {
  ADMIN, ENDUSER, ORIGIN, TECH, authFile, expect, expectPortalRendered, saveState, shot, signIn, watchPage,
} from './helpers'

test.describe.configure({ mode: 'serial' })

async function inviteUser(page: Page, who: { first: string; last: string; email: string }, roleLabel: RegExp) {
  await page.goto('/portal/settings/users')
  await page.getByRole('button', { name: 'Invite User' }).click()
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create User' }) })
  await form.getByPlaceholder('Jane', { exact: true }).fill(who.first)
  await form.getByPlaceholder('Doe', { exact: true }).fill(who.last)
  await form.getByPlaceholder('jane.doe@company.com').fill(who.email)
  const roleSelect = form.locator('select').first()
  const option = roleSelect.locator('option').filter({ hasText: roleLabel })
  await roleSelect.selectOption(await option.first().getAttribute('value') as string)
  const created = page.waitForResponse((r) => r.url().endsWith('/api/portal/users') && r.request().method() === 'POST')
  await form.getByRole('button', { name: 'Create User' }).click()
  return created
}

async function setPasswordAndSignIn(browser: Browser, link: string, email: string, password: string, who: 'tech' | 'enduser') {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(link)
  const pw = page.locator('input[type=password]')
  await pw.nth(0).fill(password)
  await pw.nth(1).fill(password)
  await page.getByRole('button', { name: 'Set password' }).click()
  await page.waitForURL(/\/portal\/login/, { timeout: 30_000 })
  await signIn(page, email, password)
  await ctx.storageState({ path: authFile(who) })
  return { ctx, page }
}

test('admin can sign out and sign back in (dashboard renders after login)', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  const page = await ctx.newPage()
  const w = watchPage(page, '02 sign out/in')

  await page.goto('/portal/dashboard')
  await expectPortalRendered(page)
  await page.getByRole('button', { name: 'A', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/portal\/login/)
  const session = await (await page.request.get('/api/auth/get-session')).text()
  expect(session === 'null' || session === '').toBeTruthy()

  // Client-side navigation from the login page into the portal shell.
  await signIn(page, ADMIN.email, ADMIN.password)
  await expect(page).toHaveURL(/\/portal\/dashboard/)
  await shot(page, '06-dashboard-after-login')
  await ctx.storageState({ path: authFile('admin') })

  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})

test('admin invites a technician and an end user; admin role cannot be granted at creation', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  const page = await ctx.newPage()
  const w = watchPage(page, '02 invite users')

  // Creating an account with an administrator role is refused, with a visible reason.
  const adminAttempt = await inviteUser(page, { first: 'Sam', last: 'Sneaky', email: 'sneaky@e2e.example.com' }, /System Admin/)
  expect(adminAttempt.status()).toBe(403)
  await expect(page.getByText(/cannot be created with an administrator role/i)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  const techRes = await inviteUser(page, TECH, /^Technician/)
  expect(techRes.status()).toBe(201)
  const techBody = await techRes.json()
  // The invite link must point at the address the admin is using (port included).
  expect(new URL(techBody.setPasswordUrl).origin).toBe(ORIGIN)
  await expect(page.getByText(techBody.setPasswordUrl)).toBeVisible()
  await shot(page, '07-invite-link')
  await page.getByRole('button', { name: 'Done' }).click()

  const endRes = await inviteUser(page, ENDUSER, /^End User/)
  expect(endRes.status()).toBe(201)
  const endBody = await endRes.json()
  await page.getByRole('button', { name: 'Done' }).click()

  saveState({ techUserId: techBody.user.id, endUserId: endBody.user.id })
  const tech = await setPasswordAndSignIn(browser, techBody.setPasswordUrl, TECH.email, TECH.password, 'tech')
  await tech.ctx.close()
  const end = await setPasswordAndSignIn(browser, endBody.setPasswordUrl, ENDUSER.email, ENDUSER.password, 'enduser')
  await end.ctx.close()

  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})

test('a technician cannot grant themselves admin (UI and API)', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('tech') })
  const page = await ctx.newPage()
  const w = watchPage(page, '02 tech escalation')
  const r = page.request
  const hdr = { origin: ORIGIN }

  const perms = await (await r.get('/api/portal/permissions')).json()
  expect(perms.adminAccess).toBe(false)

  const admin = await (await ctx.request.get('/api/settings/roles')).json()
  const roles: Array<{ id: string; name: string }> = admin.roles || admin
  const adminRole = roles.find((x) => x.name === 'System Admin')!
  const techRole = roles.find((x) => x.name === 'Technician')!
  expect(adminRole && techRole).toBeTruthy()

  const users = (await (await r.get('/api/portal/users')).json()).users as Array<{ id: string; email: string }>
  const me = users.find((u) => u.email === TECH.email)!

  // API: every path to admin is refused.
  expect((await r.patch(`/api/portal/users/${me.id}`, { headers: hdr, data: { role_id: adminRole.id } })).status()).toBe(403)
  expect((await r.post('/api/portal/users', {
    headers: hdr, data: { email: 'x-admin@e2e.example.com', first_name: 'X', last_name: 'Admin', role_id: adminRole.id },
  })).status()).toBe(403)
  expect((await r.patch(`/api/settings/roles/${techRole.id}`, {
    headers: hdr, data: { permissions: { capabilities: [], ticket_access: 'all', admin_access: true } },
  })).status()).toBe(403)
  const session = await (await r.get('/api/auth/get-session')).json()
  expect((await r.post('/api/auth/admin/set-role', { headers: hdr, data: { userId: session.user.id, role: 'admin' } })).status()).toBe(403)
  expect((await r.post('/api/auth/update-user', { headers: hdr, data: { role: 'admin' } })).status()).toBeGreaterThanOrEqual(400)

  // UI: user management is not reachable; the settings page refuses server-side.
  await page.goto('/portal/settings/users')
  await expect(page).toHaveURL(/\/portal\/dashboard\?denied=/)
  await expectPortalRendered(page)
  await expect(page.getByRole('button', { name: 'Invite User' })).toHaveCount(0)
  await shot(page, '08-tech-refused-user-settings')

  // Nothing changed.
  const permsAfter = await (await r.get('/api/portal/permissions')).json()
  expect(permsAfter.adminAccess).toBe(false)
  const after = await (await r.get('/api/auth/get-session?disableCookieCache=true')).json()
  expect(after.user.role).not.toBe('admin')

  w.flush()
  await ctx.close()
})
