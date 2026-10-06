/**
 * A staff account with the user_management capability but no admin access can
 * manage people and still cannot reach admin: it cannot grant an administrator
 * role to anyone, and it cannot change its own role at all.
 *
 * Principle 1 (lib/role-grants.ts): admin is bootstrapped once, then only
 * granted by an admin, and nobody changes their own role.
 */
import { test } from '@playwright/test'
import { ORIGIN, authFile, expect, generatedPassword, signIn } from './helpers'

test.describe.configure({ mode: 'serial' })

const MANAGER = { first: 'Mo', last: 'Manager', email: 'user-manager@e2e.example.com' }
const TARGET = { first: 'Tara', last: 'Target', email: 'grant-target@e2e.example.com' }

test('user_management without admin cannot grant admin, to others or to itself', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: authFile('admin') })
  const hdr = { origin: ORIGIN }

  // A non-admin staff role that may manage users.
  const roleRes = await admin.request.post('/api/settings/roles', {
    headers: hdr,
    data: {
      name: 'E2E User Manager',
      description: 'user_management capability, no admin access',
      permissions: { capabilities: ['user_management'], ticket_access: 'all', admin_access: false },
    },
  })
  expect(roleRes.status(), await roleRes.text()).toBe(201)
  const managerRoleId = (await roleRes.json()).role.id

  const roles = (await (await admin.request.get('/api/settings/roles')).json()).roles as Array<{
    id: string
    name: string
  }>
  const adminRoleId = roles.find((r) => r.name === 'System Admin')!.id
  const endUserRoleId = roles.find((r) => r.name.startsWith('End User'))!.id

  // The manager account, and an unrelated account for it to act on.
  const made = async (who: typeof MANAGER, roleId: string) => {
    const res = await admin.request.post('/api/portal/users', {
      headers: hdr,
      data: { email: who.email, first_name: who.first, last_name: who.last, role_id: roleId },
    })
    expect(res.status(), await res.text()).toBe(201)
    return res.json()
  }
  const manager = await made(MANAGER, managerRoleId)
  const target = await made(TARGET, endUserRoleId)
  await admin.close()

  // The manager sets a password and signs in.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const password = generatedPassword('pw.user-manager')
  await page.goto(manager.setPasswordUrl)
  const pw = page.locator('input[type=password]')
  await pw.nth(0).fill(password)
  await pw.nth(1).fill(password)
  await page.getByRole('button', { name: 'Set password' }).click()
  await page.waitForURL(/\/portal\/login/, { timeout: 30_000 })
  await signIn(page, MANAGER.email, password)
  const r = page.request

  const perms = await (await r.get('/api/portal/permissions')).json()
  expect(perms.adminAccess, 'the manager must not be an admin').toBe(false)
  expect(perms.capabilities).toContain('user_management')

  // The capability does work: a non-admin role on someone else is accepted.
  expect(
    (await r.patch(`/api/portal/users/${target.user.id}`, {
      headers: hdr,
      data: { role_id: managerRoleId },
    })).status(),
    'user_management may assign a non-admin role',
  ).toBe(200)

  // Granting an administrator role to someone else is refused.
  const grantOther = await r.patch(`/api/portal/users/${target.user.id}`, {
    headers: hdr,
    data: { role_id: adminRoleId },
  })
  expect(grantOther.status(), await grantOther.text()).toBe(403)

  // Creating an account with an administrator role is refused as well.
  expect(
    (await r.post('/api/portal/users', {
      headers: hdr,
      data: { email: 'mo-admin@e2e.example.com', first_name: 'Mo', last_name: 'Admin', role_id: adminRoleId },
    })).status(),
  ).toBe(403)

  // Changing OWN role is refused, whether or not the new role is an admin one.
  for (const roleId of [adminRoleId, endUserRoleId]) {
    const own = await r.patch(`/api/portal/users/${manager.user.id}`, { headers: hdr, data: { role_id: roleId } })
    expect(own.status(), `own role_id -> ${roleId}: ${await own.text()}`).toBe(403)
  }

  // Nothing moved: the manager is still not an admin and still holds its role.
  const permsAfter = await (await r.get('/api/portal/permissions')).json()
  expect(permsAfter.adminAccess).toBe(false)
  const session = await (await r.get('/api/auth/get-session?disableCookieCache=true')).json()
  expect(session.user.role).not.toBe('admin')

  await ctx.close()
})
