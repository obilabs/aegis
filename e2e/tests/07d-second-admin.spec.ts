/**
 * A second administrator (an account granted the System Admin role after
 * setup) has the same access as the first one, including the admin-only
 * settings routes.
 */
import { test } from '@playwright/test'
import { ORIGIN, authFile, expect, expectPortalRendered, generatedPassword, shot, signIn } from './helpers'

test.describe.configure({ mode: 'serial' })

const SECOND = { first: 'Sam', last: 'Second', email: 'second-admin@e2e.example.com' }

const ADMIN_ONLY_APIS = [
  '/api/settings/email',
  '/api/settings/data-retention',
  '/api/settings/domains',
  '/api/settings/ai/config',
  '/api/settings/users',
  '/api/admin/settings',
  '/api/portal/admin/contacts/trash',
]

test('an admin grants System Admin to another account, which then reaches admin settings', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: authFile('admin') })
  const hdr = { origin: ORIGIN }

  // Account creation never carries the admin role: create, then grant.
  const created = await admin.request.post('/api/portal/users', {
    headers: hdr,
    data: { email: SECOND.email, first_name: SECOND.first, last_name: SECOND.last },
  })
  expect(created.status(), await created.text()).toBe(201)
  const { user, setPasswordUrl } = await created.json()
  const roles = (await (await admin.request.get('/api/settings/roles')).json()).roles as Array<{ id: string; name: string }>
  const systemAdmin = roles.find((r) => r.name === 'System Admin')!
  const granted = await admin.request.patch(`/api/portal/users/${user.id}`, { headers: hdr, data: { role_id: systemAdmin.id } })
  expect(granted.status(), await granted.text()).toBe(200)
  await admin.close()

  // The new admin sets a password and signs in.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const password = generatedPassword('pw.second-admin')
  await page.goto(setPasswordUrl)
  const pw = page.locator('input[type=password]')
  await pw.nth(0).fill(password)
  await pw.nth(1).fill(password)
  await page.getByRole('button', { name: 'Set password' }).click()
  await page.waitForURL(/\/portal\/login/, { timeout: 30_000 })
  await signIn(page, SECOND.email, password)

  // Their Better Auth role is still 'user'; access comes from the application role.
  const session = await (await page.request.get('/api/auth/get-session')).json()
  expect(session.user.role).not.toBe('admin')

  for (const path of ADMIN_ONLY_APIS) {
    expect((await page.request.get(path)).status(), path).toBe(200)
  }

  await page.goto('/portal/settings')
  await expect(page).toHaveURL(/\/portal\/settings$/)
  await expectPortalRendered(page)
  await expect(page.locator('aside').first().getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
  await page.goto('/portal/settings/email')
  await expect(page).toHaveURL(/\/portal\/settings\/email$/)
  await expect(page.getByText(/Admin access required|Forbidden/)).toHaveCount(0)
  await shot(page, '17-second-admin-settings')
  await ctx.close()
})
