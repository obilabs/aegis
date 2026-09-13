/**
 * Navigation and page access by role: end users see only end-user sections,
 * and restricted pages refuse when the URL is typed directly.
 */
import { test } from '@playwright/test'
import { authFile, expect, expectPortalRendered, shot } from './helpers'

test.describe.configure({ mode: 'serial' })

const STAFF_LINKS = ['Assets', 'Companies', 'Contacts', 'Documents', 'Reports']

test('end user sees end-user navigation and is refused staff and settings pages', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('enduser') })
  const page = await ctx.newPage()
  await page.goto('/portal/dashboard')
  await expectPortalRendered(page)
  const nav = page.locator('aside').first()
  await expect(nav.getByRole('link', { name: 'My Tickets' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Knowledge Base' })).toBeVisible()
  for (const name of [...STAFF_LINKS, 'Settings', 'Activity Log']) {
    await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0)
  }
  await shot(page, '16-enduser-navigation')

  for (const path of ['/portal/settings', '/portal/settings/users', '/portal/assets', '/portal/companies', '/portal/contacts', '/portal/reports', '/portal/activity']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/portal\/dashboard\?denied=/)
  }
  await ctx.close()
})

test('technician sees staff navigation but is refused settings pages', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('tech') })
  const page = await ctx.newPage()
  await page.goto('/portal/dashboard')
  await expectPortalRendered(page)
  const nav = page.locator('aside').first()
  for (const name of STAFF_LINKS) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)

  await page.goto('/portal/assets')
  await expect(page).toHaveURL(/\/portal\/assets$/)
  for (const path of ['/portal/settings', '/portal/settings/users', '/portal/settings/roles']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/portal\/dashboard\?denied=/)
  }
  await ctx.close()
})

test('admin reaches settings', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  const page = await ctx.newPage()
  await page.goto('/portal/settings/users')
  await expect(page).toHaveURL(/\/portal\/settings\/users$/)
  await expect(page.getByRole('button', { name: 'Invite User' })).toBeVisible()
  await ctx.close()
})
