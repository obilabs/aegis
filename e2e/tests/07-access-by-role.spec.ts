/**
 * Access by role: what an end user, a technician and an admin can reach,
 * through the API and in the browser. Runs after the earlier specs, which
 * created the three accounts and some records.
 */
import { test } from '@playwright/test'
import { ORIGIN, authFile, expect, mustState } from './helpers'

test.describe.configure({ mode: 'serial' })

const ORG_LISTS = [
  '/api/portal/assets',
  '/api/portal/companies',
  '/api/portal/contacts',
  '/api/portal/people',
  '/api/portal/users',
  '/api/portal/departments',
  '/api/portal/locations',
  '/api/portal/job-titles',
  '/api/portal/reports/ticket-summary',
  '/api/portal/queue/stats',
  '/api/portal/policies',
  '/api/settings/roles',
]

test('end user: own tickets and KB only; organization records refused', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('enduser') })
  const r = ctx.request
  const hdr = { origin: ORIGIN }

  for (const path of ORG_LISTS) {
    expect((await r.get(path)).status(), path).toBe(403)
  }
  for (const [path, id] of [
    ['/api/portal/assets', mustState('assetId')],
    ['/api/portal/companies', mustState('companyId')],
    ['/api/portal/contacts', mustState('contactId')],
  ]) {
    expect((await r.get(`${path}/${id}`)).status(), `${path}/${id}`).toBe(403)
  }

  // Creating organization records is refused.
  expect((await r.post('/api/portal/companies', { headers: hdr, data: { name: 'Nope Ltd' } })).status()).toBe(403)
  expect((await r.post('/api/portal/assets', { headers: hdr, data: { name: 'Nope' } })).status()).toBe(403)
  expect((await r.post('/api/portal/contacts', { headers: hdr, data: { first_name: 'N', last_name: 'O' } })).status()).toBe(403)
  const form = { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') } }
  expect((await r.post('/api/portal/documents/00000000-0000-0000-0000-000000000000/attachments', { headers: hdr, multipart: form })).status()).toBe(403)

  // Entity search: KB articles only.
  expect((await r.get('/api/portal/search/entities?type=contact&q=a')).status()).toBe(403)
  expect((await r.get('/api/portal/search/entities?type=credential&q=a')).status()).toBe(403)
  expect((await r.get('/api/portal/search/entities?type=kb_article&q=a')).status()).toBe(200)

  // Someone else's ticket: every sub-route reads as not found.
  const other = mustState('ticketId')
  for (const sub of ['', '/sla', '/tasks', '/links', '/history', '/attachments']) {
    expect((await r.get(`/api/portal/tickets/${other}${sub}`)).status(), `ticket${sub}`).toBe(404)
  }
  // Own ticket: can read it, but not claim it or edit its tasks.
  const own = mustState('endUserTicketId')
  expect((await r.get(`/api/portal/tickets/${own}/sla`)).status()).toBe(200)
  expect((await r.post(`/api/portal/tickets/${own}/claim`, { headers: hdr })).status()).toBe(403)
  expect((await r.post(`/api/portal/tickets/${own}/tasks`, { headers: hdr, data: { title: 'x' } })).status()).toBe(403)

  // Settings APIs refuse.
  expect((await r.get('/api/settings/users')).status()).toBe(403)
  expect((await r.get('/api/portal/settings/categories')).status()).toBe(403)

  await ctx.close()
})

test('technician: works tickets and records; no settings', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('tech') })
  const r = ctx.request
  for (const path of ['/api/portal/assets', '/api/portal/companies', '/api/portal/contacts', '/api/portal/users']) {
    expect((await r.get(path)).status(), path).toBe(200)
  }
  expect((await r.get('/api/portal/search/entities?type=contact&q=a')).status()).toBe(200)
  // Settings stay admin.
  expect((await r.get('/api/settings/users')).status()).toBe(403)
  expect((await r.get('/api/portal/providers')).status()).toBe(403)
  expect((await r.get('/api/portal/delegations')).status()).toBe(403)
  await ctx.close()
})

test('admin: settings and organization records available', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  for (const path of [...ORG_LISTS, '/api/settings/users', '/api/portal/providers']) {
    expect((await ctx.request.get(path)).status(), path).toBe(200)
  }
  await ctx.close()
})
