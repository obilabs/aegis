/**
 * Access by role: what an end user, a technician and an admin can reach,
 * through the API and in the browser. Runs after the earlier specs, which
 * created the three accounts and some records.
 */
import { test } from '@playwright/test'
import { ORIGIN, authFile, expect, mustState, saveState, uniq } from './helpers'

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

/**
 * A restricted folder, a document inside it, and an attachment on that
 * document. Created by the admin so the end-user test below can prove none of
 * it is reachable: not the folder, not its access-control rows, not the
 * attachment list of a document it holds.
 */
test('admin: a restricted folder with a document and an attachment', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authFile('admin') })
  const r = ctx.request
  const hdr = { origin: ORIGIN }

  const folderRes = await r.post('/api/portal/documents/folders', {
    headers: hdr,
    data: { name: `Restricted ${uniq()}`, description: 'Admins only' },
  })
  expect(folderRes.status()).toBe(201)
  const folderId = (await folderRes.json()).folder.id

  const permRes = await r.put(`/api/portal/documents/folders/${folderId}/permissions`, {
    headers: hdr,
    data: { isRestricted: true, permissions: [{ role: 'admin', permission: 'manage' }] },
  })
  expect(permRes.status()).toBe(200)

  const docRes = await r.post('/api/portal/documents', {
    headers: hdr,
    data: { title: `Restricted doc ${uniq()}`, content: 'secret', folderId },
  })
  expect(docRes.status()).toBe(201)
  const docId = (await docRes.json()).document.id

  const attachRes = await r.post(`/api/portal/documents/${docId}/attachments`, {
    headers: hdr,
    multipart: { file: { name: 'payroll.txt', mimeType: 'text/plain', buffer: Buffer.from('secret') } },
  })
  expect(attachRes.status()).toBe(201)

  // The admin does see all of it.
  expect((await r.get(`/api/portal/documents/folders/${folderId}`)).status()).toBe(200)
  expect((await r.get(`/api/portal/documents/${docId}/attachments`)).status()).toBe(200)

  saveState({ restrictedFolderId: folderId, restrictedDocId: docId })
  await ctx.close()
})

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

  // A restricted folder, its access-control rows and the attachment list of a
  // document inside it are all metadata an end user must not see.
  const folderId = mustState('restrictedFolderId')
  const docId = mustState('restrictedDocId')

  const folders = await r.get('/api/portal/documents/folders')
  expect(folders.status()).toBe(200)
  const listed = (await folders.json()).folders as Array<{ id: string; name: string }>
  expect(listed.map((f) => f.id), 'restricted folder listed to an end user').not.toContain(folderId)

  // The folder detail (which carries folder_permissions) is staff-only.
  expect((await r.get(`/api/portal/documents/folders/${folderId}`)).status()).toBe(403)

  // The document and its attachment metadata read as not found.
  expect((await r.get(`/api/portal/documents/${docId}`)).status()).toBe(404)
  expect((await r.get(`/api/portal/documents/${docId}/attachments`)).status()).toBe(404)

  // And it is absent from the document list the portal page renders.
  const docs = await r.get('/api/portal/documents')
  expect(docs.status()).toBe(200)
  const body = await docs.json()
  expect((body.documents as Array<{ id: string }>).map((d) => d.id)).not.toContain(docId)
  expect((body.folders as Array<{ id: string }>).map((f) => f.id)).not.toContain(folderId)

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
