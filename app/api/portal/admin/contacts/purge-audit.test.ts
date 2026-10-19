/**
 * Contact purge routes: the audit row is part of the purge, not a notification.
 *
 * What this file proves, and what it does not:
 *
 * The load-bearing proof that a purge whose audit write fails destroys nothing
 * lives in `database/tests/contact-purge-audit.integration.test.sql`, which
 * induces a REAL audit-write failure in a REAL Postgres (a trigger that raises
 * on the actual INSERT) and then checks the contacts are still there. No mock
 * can establish that, because the guarantee is a transaction boundary in the
 * database.
 *
 * What a vitest CAN establish is the part that lives in these routes: that the
 * audit INSERT goes on the SAME client between BEGIN and COMMIT rather than
 * fire-and-forget on the pool, that the statement leaves the hash-chain
 * columns to migration 099's trigger, that a failed or zero-rowCount audit
 * write ROLLBACKs with no COMMIT, and — the part that only exists because
 * these routes have a human in front of them — that the caller then gets a 500
 * saying nothing was deleted, never a 204 or a `{ purged: n }`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { query, connect } = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }))

vi.mock('@/lib/db', () => ({ pool: { query, connect } }))
vi.mock('@/lib/org', () => ({ getAuthContext: vi.fn() }))
vi.mock('@/lib/access', () => ({ isAdminRequest: vi.fn() }))

import { getAuthContext } from '@/lib/org'
import { isAdminRequest } from '@/lib/access'
import { DELETE as purgeOne } from './[id]/purge/route'
import { POST as purgeBulk } from './bulk/purge/route'

const CTX = {
  session: { user: { email: 'admin@aegis.example', name: 'Pat Admin' } },
  userId: '11111111-1111-4111-8111-111111111111',
  orgId: 'org-1',
}

const CONTACT = {
  id: '22222222-2222-4222-8222-222222222222',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@aegis.example',
  contact_type: 'employee',
  is_deleted: true,
  legal_hold: false,
}

type Call = { sql: string; params: unknown[] }

/**
 * A pool client that records every statement. `failAudit` rejects the audit
 * INSERT the way Postgres rejects it (an error out of `client.query`), which is
 * the only way this layer ever learns about it; `auditRowCount` covers the
 * silent shape where the write is swallowed and a success is reported.
 */
function mockClient(opts: {
  deleted?: number
  failAudit?: boolean | number
  auditRowCount?: number
} = {}) {
  const calls: Call[] = []
  let audits = 0
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      if (sql.includes('INSERT INTO audit_log')) {
        audits += 1
        if (opts.failAudit === true || opts.failAudit === audits) {
          throw Object.assign(
            new Error('null value in column "actor_type" violates not-null constraint'),
            { code: '23502' },
          )
        }
        return { rows: [], rowCount: opts.auditRowCount ?? 1 }
      }
      if (sql.startsWith('DELETE FROM contacts')) {
        return { rows: [], rowCount: opts.deleted ?? 1 }
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }
  return { client, calls }
}

const sqlOf = (calls: Call[]) => calls.map(c => c.sql.trim().split('\n')[0].trim())
const auditCalls = (calls: Call[]) => calls.filter(c => c.sql.includes('INSERT INTO audit_log'))

const oneReq = () =>
  new Request('https://aegis.example/api/portal/admin/contacts/x/purge', {
    method: 'DELETE',
    headers: { 'x-real-ip': '203.0.113.7' },
  }) as any
const params = { params: Promise.resolve({ id: CONTACT.id }) }

const bulkReq = (ids: string[]) =>
  new Request('https://aegis.example/api/portal/admin/contacts/bulk/purge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' },
    body: JSON.stringify({ ids }),
  }) as any

beforeEach(() => {
  query.mockReset()
  connect.mockReset()
  vi.mocked(getAuthContext).mockReset()
  vi.mocked(getAuthContext).mockResolvedValue(CTX as any)
  vi.mocked(isAdminRequest).mockReset()
  vi.mocked(isAdminRequest).mockResolvedValue(true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('DELETE /api/portal/admin/contacts/[id]/purge', () => {
  beforeEach(() => {
    query.mockResolvedValue({ rows: [CONTACT], rowCount: 1 })
  })

  it('writes the audit row on the same client, inside the delete transaction', async () => {
    const { client, calls } = mockClient()
    connect.mockResolvedValue(client)

    const res = await purgeOne(oneReq(), params)
    expect(res.status).toBe(204)

    const order = sqlOf(calls)
    const begin = order.indexOf('BEGIN')
    const del = order.findIndex(s => s.startsWith('DELETE FROM contacts'))
    const audit = order.findIndex(s => s.includes('INSERT INTO audit_log'))
    const commit = order.indexOf('COMMIT')

    expect(begin).toBe(0)
    expect(del).toBeGreaterThan(begin)
    // After the DELETE, so the row records what actually happened.
    expect(audit).toBeGreaterThan(del)
    expect(commit).toBeGreaterThan(audit)
    expect(order).not.toContain('ROLLBACK')

    // And NOT fire-and-forget on the pool, which is what it used to be.
    const poolAudits = query.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO audit_log'))
    expect(poolAudits).toHaveLength(0)
  })

  it('records the actor, the contact and the payload in new_values', async () => {
    const { client, calls } = mockClient()
    connect.mockResolvedValue(client)

    await purgeOne(oneReq(), params)

    const audit = auditCalls(calls)[0]
    expect(audit).toBeDefined()
    expect(audit.sql).toContain("'user'")
    expect(audit.params).toContain('contact_purged')
    expect(audit.params).toContain(CTX.userId)
    expect(audit.params).toContain('admin@aegis.example')
    expect(audit.params).toContain('203.0.113.7')
    expect(audit.params).toContain(CONTACT.id)
    expect(audit.params).toContain('Ada Lovelace')

    const payload = JSON.parse(
      audit.params.find(p => typeof p === 'string' && p.startsWith('{')) as string,
    )
    expect(payload.email).toBe('ada@aegis.example')
    expect(payload.contact_type).toBe('employee')

    // The chain framing is the database's — migration 099's trigger fills it.
    for (const col of ['chain_seq', 'hash_version', 'previous_hash', 'record_hash']) {
      expect(audit.sql).not.toContain(col)
    }
  })

  it('rolls back and answers 500 — never 204 — when the audit write fails', async () => {
    const { client, calls } = mockClient({ failAudit: true })
    connect.mockResolvedValue(client)

    const res = await purgeOne(oneReq(), params)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toMatch(/Nothing was deleted/i)

    const order = sqlOf(calls)
    expect(order).toContain('ROLLBACK')
    expect(order).not.toContain('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })

  it('treats a zero-rowCount audit INSERT as a failure', async () => {
    const { client, calls } = mockClient({ auditRowCount: 0 })
    connect.mockResolvedValue(client)

    const res = await purgeOne(oneReq(), params)

    expect(res.status).toBe(500)
    expect(sqlOf(calls)).toContain('ROLLBACK')
    expect(sqlOf(calls)).not.toContain('COMMIT')
  })

  it('writes no audit row when the contact was already gone (404)', async () => {
    const { client, calls } = mockClient({ deleted: 0 })
    connect.mockResolvedValue(client)

    const res = await purgeOne(oneReq(), params)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Contact not found')
    expect(auditCalls(calls)).toHaveLength(0)
    expect(sqlOf(calls)).toContain('ROLLBACK')
  })

  it('refuses a contact under legal hold without opening a transaction', async () => {
    query.mockResolvedValue({ rows: [{ ...CONTACT, legal_hold: true }], rowCount: 1 })
    const res = await purgeOne(oneReq(), params)
    expect(res.status).toBe(403)
    expect(connect).not.toHaveBeenCalled()
  })
})

describe('POST /api/portal/admin/contacts/bulk/purge', () => {
  const ids = [
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
  ]
  const rows = ids.map((id, i) => ({ ...CONTACT, id, last_name: `Bulk${i}` }))

  beforeEach(() => {
    query.mockResolvedValue({ rows, rowCount: rows.length })
  })

  it('writes one audit row per contact, all inside the one transaction', async () => {
    const { client, calls } = mockClient({ deleted: 2 })
    connect.mockResolvedValue(client)

    const res = await purgeBulk(bulkReq(ids))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ purged: 2 })

    const order = sqlOf(calls)
    const begin = order.indexOf('BEGIN')
    const del = order.findIndex(s => s.startsWith('DELETE FROM contacts'))
    const commit = order.indexOf('COMMIT')
    const audits = auditCalls(calls)

    expect(audits).toHaveLength(2)
    expect(order.findIndex(s => s.includes('INSERT INTO audit_log'))).toBeGreaterThan(del)
    expect(commit).toBeGreaterThan(order.lastIndexOf(order.find(s => s.includes('INSERT INTO audit_log'))!))
    expect(begin).toBe(0)
    expect(order).not.toContain('ROLLBACK')

    // Each row names its own contact, so the trail stays queryable by entity_id.
    expect(audits[0].params).toContain(ids[0])
    expect(audits[1].params).toContain(ids[1])

    const poolAudits = query.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO audit_log'))
    expect(poolAudits).toHaveLength(0)
  })

  it('aborts the whole batch when one audit row cannot be written', async () => {
    // The second row fails: the first contact must not be purged either.
    const { client, calls } = mockClient({ deleted: 2, failAudit: 2 })
    connect.mockResolvedValue(client)

    const res = await purgeBulk(bulkReq(ids))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.purged).toBeUndefined()
    expect(body.error).toMatch(/Nothing was deleted/i)

    const order = sqlOf(calls)
    expect(order).toContain('ROLLBACK')
    expect(order).not.toContain('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })

  it('refuses the batch when any contact is blocked, before any delete', async () => {
    query.mockResolvedValue({
      rows: [rows[0], { ...rows[1], legal_hold: true }],
      rowCount: 2,
    })

    const res = await purgeBulk(bulkReq(ids))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.blocked).toEqual([{ id: ids[1], reason: 'legal hold' }])
    expect(connect).not.toHaveBeenCalled()
  })
})
