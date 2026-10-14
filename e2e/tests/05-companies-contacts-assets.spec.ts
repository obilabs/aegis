/**
 * Step 8: create a company, a contact at it and an asset assigned to them, then
 * raise a ticket for that contact and link the asset to it.
 */
import { test } from '@playwright/test'
import { authFile, expect, expectPortalRendered, saveState, shot, sql, uniq, watchPage } from './helpers'

test.describe.configure({ mode: 'serial' })

test('company, contact and asset are created in the UI and linked to a ticket', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  const page = await ctx.newPage()
  const w = watchPage(page, '05 records')
  const tag = uniq()

  // Company, from the Companies list's "Add Company".
  const companyName = `Globex ${tag}`
  await page.goto('/portal/companies')
  await expectPortalRendered(page)
  await page.getByRole('link', { name: 'Add Company' }).click()
  await page.waitForURL(/\/portal\/companies\/new$/)
  await page.getByLabel('Name *').fill(companyName)
  await page.getByLabel('Type').selectOption('customer')
  await page.getByLabel('Email').fill(`it@globex-${tag}.example.com`)
  await page.getByRole('button', { name: 'Create Company' }).click()
  await page.waitForURL(/\/portal\/companies\/[0-9a-f-]{36}$/)
  const companyId = page.url().split('/').pop()!
  await expect(page.getByText(companyName).first()).toBeVisible()
  await expect(page.getByText(/Failed to load/i)).toHaveCount(0)

  // Contact at that company.
  const contactEmail = `hank.${tag}@globex.example.com`
  await page.goto('/portal/contacts/new')
  await page.getByRole('button', { name: /^Customer/ }).click()
  await page.getByPlaceholder('First name').fill('Hank')
  await page.getByPlaceholder('Last name').fill('Scorpio')
  await page.getByPlaceholder('email@company.com').fill(contactEmail)
  await page.getByRole('button', { name: 'Select company...' }).click()
  await page.getByRole('button', { name: companyName, exact: true }).click()
  await page.getByRole('button', { name: 'Create Contact' }).click()
  await page.waitForURL(/\/portal\/contacts\/[0-9a-f-]{36}$/)
  const contactId = page.url().split('/').pop()!
  expect(sql(`SELECT company_id FROM contacts WHERE id = '${contactId}'`)).toBe(companyId)

  // Asset assigned to the contact, from the Assets list's "Add Asset".
  const assetName = `LAPTOP-${tag.toUpperCase()}`
  await page.goto('/portal/assets')
  await page.getByRole('link', { name: 'Add Asset' }).click()
  await page.waitForURL(/\/portal\/assets\/new$/)
  await page.getByLabel('Name *').fill(assetName)
  await page.getByLabel('Asset tag').fill(`AT-${tag}`)
  await page.getByLabel('Serial number').fill(`SN-${tag}`)
  await page.getByLabel('Status').selectOption('deployed')
  await page.getByLabel('Company').selectOption({ label: companyName })
  await expect(page.getByLabel('Assigned to').locator('option', { hasText: contactEmail })).toHaveCount(1)
  await page.getByLabel('Assigned to').selectOption({ label: `Hank Scorpio (${contactEmail})` })
  await page.getByRole('button', { name: 'Create Asset' }).click()
  await page.waitForURL(/\/portal\/assets\/[0-9a-f-]{36}$/)
  const assetId = page.url().split('/').pop()!
  await expect(page.getByText(assetName).first()).toBeVisible()
  await expect(page.getByText('Failed to load asset')).toHaveCount(0)
  expect(sql(`SELECT contact_id || '/' || company_id || '/' || status FROM assets WHERE id = '${assetId}'`)).toBe(`${contactId}/${companyId}/deployed`)
  await page.goto('/portal/assets')
  await expect(page.getByText(assetName)).toBeVisible()

  // A ticket for the contact...
  const subject = `Globex laptop battery swelling ${tag}`
  await page.goto('/portal/tickets/new')
  await page.getByRole('button', { name: /Hardware$/ }).click()
  await page.getByPlaceholder('Brief description of the issue').fill(subject)
  await page.locator('textarea').first().fill('The battery is bulging.')
  await page.getByPlaceholder('your@email.com').fill(contactEmail)
  await page.getByRole('button', { name: /Submit Ticket/ }).click()
  await page.waitForURL(/\/portal\/tickets\/[0-9a-f-]{36}$/)
  const ticketId = page.url().split('/').pop()!
  await expect(page.getByRole('link', { name: /Hank Scorpio/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: companyName })).toBeVisible()

  // ...with the asset linked.
  await page.getByRole('button', { name: 'Link item' }).click()
  await page.getByRole('button', { name: 'Assets', exact: true }).click()
  await page.getByPlaceholder('Search assets...').fill(assetName)
  const linked = page.waitForResponse((r) => r.url().endsWith(`/api/portal/tickets/${ticketId}/links`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: new RegExp(assetName) }).first().click()
  expect((await linked).status()).toBeLessThan(300)
  const links = await (await page.request.get(`/api/portal/tickets/${ticketId}/links`)).json()
  expect(JSON.stringify(links)).toContain(assetId)
  await page.reload()
  await expect(page.getByText(assetName).first()).toBeVisible()
  await shot(page, '14-ticket-with-contact-company-asset')

  saveState({ companyId, contactId, assetId, linkedTicketId: ticketId })
  expect(w.serverErrors()).toEqual([])
  w.flush()
  await ctx.close()
})
