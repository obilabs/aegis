/**
 * Step 1-2: fresh install -> setup token from the log -> first admin -> wizard
 * -> setup closed.
 */
import { test } from '@playwright/test'
import {
  ADMIN, ORIGIN, authFile, generatedPassword, expect, expectPortalRendered, setupTokenFromLogs, shot, waitForHealthy, watchPage,
} from './helpers'

test.describe.configure({ mode: 'serial' })

test('fresh install is healthy, prints a setup token and sends visitors to setup', async ({ page, request }) => {
  await waitForHealthy(request)

  const status = await (await request.get('/api/setup/status')).json()
  expect(status, 'this suite needs a fresh, empty stack').toMatchObject({ setupRequired: true, wizardRequired: false })

  // README: docker compose logs aegis | grep 'setup token'
  const token = setupTokenFromLogs()
  expect(token, 'no "setup token:" line in the app log').toBeTruthy()
  expect(token!.length).toBeGreaterThanOrEqual(24)

  const w = watchPage(page, '01 setup redirect')
  await page.goto('/portal/dashboard')
  await expect(page).toHaveURL(/\/portal\/setup$/)
  await expect(page.getByRole('button', { name: 'Create Admin Account' })).toBeVisible()
  await shot(page, '01-setup-page')
  w.flush()
})

test('setup refuses a wrong token, then creates the admin and completes the wizard', async ({ page }) => {
  const token = setupTokenFromLogs()!
  const w = watchPage(page, '01 setup')

  await page.goto('/portal/setup')
  await page.getByLabel('Setup token').fill('definitely-not-the-token')
  await page.getByLabel('Full Name').fill(ADMIN.name)
  await page.getByLabel('Email address').fill(ADMIN.email)
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password)
  await page.getByLabel('Confirm Password').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Create Admin Account' }).click()

  // Refused: an error is shown, we stay on /portal/setup and no account exists.
  await expect(page.locator('.bg-red-500\\/10')).toBeVisible()
  await expect(page).toHaveURL(/\/portal\/setup$/)
  const after = await (await page.request.get('/api/setup/status')).json()
  expect(after.userCount).toBe(0)
  await shot(page, '02-setup-wrong-token')

  await page.getByLabel('Setup token').fill(token)
  await page.getByRole('button', { name: 'Create Admin Account' }).click()
  await page.waitForURL(/\/portal\/setup\/wizard/, { timeout: 45_000 })

  // With a session but the wrong token, completing setup is refused too.
  const wrongComplete = await page.request.post('/api/setup/complete', {
    headers: { 'x-aegis-setup-token': 'wrong-token', origin: ORIGIN },
    data: { company_name: 'Hijack' },
  })
  expect(wrongComplete.status()).toBe(403)

  // Step 1: organization + industry
  await page.getByPlaceholder('Acme Corporation').fill('E2E Test Co')
  await page.getByRole('button', { name: /Internal IT Department/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  // Step 2: team size
  await page.getByRole('button', { name: /6-20 people/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  // Step 3: use case
  await page.getByRole('button', { name: /All of the Above/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  // Step 4: features (defaults)
  await shot(page, '03-wizard-features')
  await page.getByRole('button', { name: /Continue/ }).click()
  // Step 5: finish. A test instance sends no telemetry.
  await page.getByRole('button', { name: /Disable all telemetry/ }).click()
  await expect(page.getByLabel('Setup token')).toHaveValue(token)
  await shot(page, '04-wizard-finish')
  await page.getByRole('button', { name: /Launch Aegis/ }).click()
  await page.waitForURL(/\/portal\/dashboard/, { timeout: 90_000 })
  await expectPortalRendered(page)
  await shot(page, '05-dashboard-first')

  const done = await (await page.request.get('/api/setup/status')).json()
  expect(done).toMatchObject({ setupRequired: false, wizardRequired: false, userCount: 1 })
  await page.context().storageState({ path: authFile('admin') })

  expect(w.serverErrors()).toEqual([])
  w.flush()
})

test('setup is closed afterwards', async ({ page, request }) => {
  await page.goto('/portal/setup')
  await expect(page).not.toHaveURL(/\/portal\/setup$/)
  await expect(page.getByRole('button', { name: 'Create Admin Account' })).toHaveCount(0)

  // The token printed at first boot no longer claims anything.
  const oldToken = setupTokenFromLogs()!
  const complete = await request.post('/api/setup/complete', {
    headers: { 'x-aegis-setup-token': oldToken, origin: ORIGIN },
    data: { company_name: 'Takeover' },
  })
  expect([401, 403, 409]).toContain(complete.status())
  const signUp = await request.post('/api/auth/sign-up/email', {
    headers: { 'x-aegis-setup-token': oldToken, origin: ORIGIN },
    data: { email: 'late@e2e.example.com', password: generatedPassword('pw.late'), name: 'Late Comer' },
  })
  expect(signUp.status()).toBeGreaterThanOrEqual(400)
})
