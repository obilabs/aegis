/**
 * Change and Problem tickets: staff may raise them, end users may not.
 */
import { test } from '@playwright/test'
import { ORIGIN, authFile, expect, expectPortalRendered } from './helpers'

test.describe.configure({ mode: 'serial' })

test('a technician raises a Change Request and a Problem; an end user cannot', async ({ browser }) => {
  const tech = await browser.newContext({ storageState: authFile('tech') })
  const change = await tech.request.post('/api/portal/tickets', {
    headers: { origin: ORIGIN },
    data: { type: 'change', subject: 'Patch the file server', description: 'Monthly patching', change_type: 'standard' },
  })
  expect(change.status(), await change.text()).toBe(201)
  const problem = await tech.request.post('/api/portal/tickets', {
    headers: { origin: ORIGIN },
    data: { type: 'problem', subject: 'Printers keep jamming', description: 'Recurring jams on floor 2', impact: 'Floor 2' },
  })
  expect(problem.status(), await problem.text()).toBe(201)

  const page = await tech.newPage()
  await page.goto(`/portal/tickets/${(await change.json()).id}`)
  await expectPortalRendered(page)
  await expect(page.getByRole('heading', { name: 'Patch the file server' })).toBeVisible()
  await tech.close()

  const end = await browser.newContext({ storageState: authFile('enduser') })
  for (const type of ['change', 'problem']) {
    const refused = await end.request.post('/api/portal/tickets', {
      headers: { origin: ORIGIN },
      data: { type, subject: 'Not allowed', description: 'x' },
    })
    expect(refused.status(), type).toBe(403)
  }
  await end.close()
})
