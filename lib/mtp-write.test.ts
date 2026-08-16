/**
 * MSP write-back transaction tests.
 *
 * The load-bearing assertions here are about two things that fail SILENTLY if
 * they regress:
 *
 *   1. `is_internal` is written EXACTLY as the caller specified. The column
 *      defaults to FALSE — customer-visible — so any path that loses the flag
 *      publishes a staff-only note to the customer. Nothing throws when that
 *      happens; the note simply appears where it should not.
 *   2. Every failure path ROLLS BACK. A comment that commits without its audit
 *      row, or a status change that lands without its field-change row, reads
 *      as success at the call site and is only discovered during an incident.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

const { query, connect } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ pool: { query, connect } }))

import { writeTicketUpdate, type MtpWriteContext } from './mtp-write'

const CTX: MtpWriteContext = {
  orgId: 'org-1',
  pairingKeyId: 'key-1',
  actorEmail: 'dana@msp.test',
  actorTicketRef: 'MTP-12345678',
  actorIp: '203.0.113.9',
}

const TICKET = { id: 't-1', status_id: 's-old', assigned_to: 'u-old' }

/** Records every SQL statement so ordering and payloads can be asserted. */
function mockClient(opts: { ticket?: typeof TICKET | null; statusOk?: boolean; userOk?: boolean } = {}) {
  const calls: { sql: string; params: unknown[] }[] = []
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      if (sql.includes('FROM tickets') && sql.includes('FOR UPDATE')) {
        const t = opts.ticket === undefined ? TICKET : opts.ticket
        return { rows: t ? [t] : [] }
      }
      if (sql.includes('FROM users') && sql.includes('LOWER(email)')) {
        return { rows: [{ id: 'local-user-1' }] }
      }
      if (sql.includes('FROM ticket_statuses')) {
        return { rows: opts.statusOk === false ? [] : [{ id: 's-new' }] }
      }
      if (sql.includes('FROM users WHERE id')) {
        return { rows: opts.userOk === false ? [] : [{ id: 'u-new' }] }
      }
      if (sql.includes('INSERT INTO ticket_replies')) {
        return { rows: [{ id: 'reply-1' }] }
      }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
  connect.mockResolvedValue(client)
  return { client, calls }
}

const sqlOf = (calls: { sql: string }[]) => calls.map((c) => c.sql).join('\n---\n')
const find = (calls: { sql: string; params: unknown[] }[], needle: string) =>
  calls.find((c) => c.sql.includes(needle))

beforeEach(() => vi.clearAllMocks())

describe('is_internal is never defaulted', () => {
  it('writes TRUE through to the insert for an internal note', async () => {
    const { calls } = mockClient()

    await writeTicketUpdate('t-1', CTX, {
      comment: { body: 'staff only', isInternal: true },
    })

    const insert = find(calls, 'INSERT INTO ticket_replies')
    expect(insert).toBeDefined()
    // 4th positional param is is_internal.
    expect(insert!.params[3]).toBe(true)
  })

  it('writes FALSE through to the insert for a public reply', async () => {
    const { calls } = mockClient()

    await writeTicketUpdate('t-1', CTX, {
      comment: { body: 'hello customer', isInternal: false },
    })

    expect(find(calls, 'INSERT INTO ticket_replies')!.params[3]).toBe(false)
  })

  it('stamps MSP provenance so authorship and the D8 filter work', async () => {
    const { calls } = mockClient()

    await writeTicketUpdate('t-1', CTX, {
      comment: { body: 'x', isInternal: true },
    })

    const insert = find(calls, 'INSERT INTO ticket_replies')!
    expect(insert.params).toContain('key-1')          // via_pairing_key_id
    expect(insert.params).toContain('dana@msp.test')  // msp_actor_email
  })
})

describe('SLA response clock', () => {
  it('a PUBLIC reply starts the first-response clock', async () => {
    const { calls } = mockClient()
    await writeTicketUpdate('t-1', CTX, { comment: { body: 'hi', isInternal: false } })
    expect(sqlOf(calls)).toContain('first_response_at')
  })

  it('an INTERNAL note does NOT — it is not a response to the customer', async () => {
    const { calls } = mockClient()
    await writeTicketUpdate('t-1', CTX, { comment: { body: 'hi', isInternal: true } })
    expect(sqlOf(calls)).not.toContain('first_response_at')
  })
})

describe('atomicity', () => {
  it('commits comment, field history and audit in ONE transaction', async () => {
    const { calls } = mockClient()

    await writeTicketUpdate('t-1', CTX, {
      comment: { body: 'done', isInternal: false },
      statusId: 's-new',
    })

    const sql = calls.map((c) => c.sql)
    const begin = sql.findIndex((s) => s.includes('BEGIN'))
    const audit = sql.findIndex((s) => s.includes('INSERT INTO audit_log'))
    const commit = sql.findIndex((s) => s.includes('COMMIT'))

    expect(begin).toBeGreaterThanOrEqual(0)
    expect(audit).toBeGreaterThan(begin)
    // The audit row is INSERTed BEFORE commit — not fire-and-forget after it.
    expect(commit).toBeGreaterThan(audit)
    expect(sqlOf(calls)).toContain('INSERT INTO ticket_field_changes')
  })

  it('locks the ticket row so concurrent writers record real transitions', async () => {
    const { calls } = mockClient()
    await writeTicketUpdate('t-1', CTX, { statusId: 's-new' })
    expect(sqlOf(calls)).toContain('FOR UPDATE')
  })

  it('an unknown ticket rolls back and reports not_found', async () => {
    const { calls } = mockClient({ ticket: null })

    const r = await writeTicketUpdate('t-1', CTX, {
      comment: { body: 'x', isInternal: false },
    })

    expect(r).toEqual({ ok: false, reason: 'not_found' })
    expect(sqlOf(calls)).toContain('ROLLBACK')
    expect(sqlOf(calls)).not.toContain('INSERT INTO ticket_replies')
  })

  it('an out-of-org status rolls back the ALREADY-INSERTED comment', async () => {
    const { calls } = mockClient({ statusOk: false })

    const r = await writeTicketUpdate('t-1', CTX, {
      comment: { body: 'x', isInternal: false },
      statusId: 'bad',
    })

    // The comment insert happened first; the rollback is what makes the
    // combined write atomic rather than partially applied.
    expect(r).toEqual({ ok: false, reason: 'invalid_status' })
    expect(sqlOf(calls)).toContain('INSERT INTO ticket_replies')
    expect(sqlOf(calls)).toContain('ROLLBACK')
    expect(sqlOf(calls)).not.toContain('COMMIT')
  })

  it('an out-of-org assignee rolls back', async () => {
    const { calls } = mockClient({ userOk: false })

    const r = await writeTicketUpdate('t-1', CTX, { assigneeUserId: 'someone-else' })

    expect(r).toEqual({ ok: false, reason: 'invalid_assignee' })
    expect(sqlOf(calls)).toContain('ROLLBACK')
  })

  it('releases the client even when the transaction throws', async () => {
    const { client } = mockClient()
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('BEGIN')) return { rows: [] }
      throw new Error('db exploded')
    })

    await expect(
      writeTicketUpdate('t-1', CTX, { comment: { body: 'x', isInternal: false } }),
    ).rejects.toThrow('db exploded')
    expect(client.release).toHaveBeenCalled()
  })
})

describe('guards', () => {
  it('a write with nothing in it is refused before opening a transaction', async () => {
    mockClient()
    const r = await writeTicketUpdate('t-1', CTX, {})
    expect(r).toEqual({ ok: false, reason: 'empty_write' })
    expect(connect).not.toHaveBeenCalled()
  })

  it('unassigning (null) is distinct from not touching the assignee', async () => {
    const { calls } = mockClient()
    await writeTicketUpdate('t-1', CTX, { assigneeUserId: null })
    // null must reach the UPDATE — it is an intentional unassign.
    const upd = find(calls, 'UPDATE tickets SET assigned_to')
    expect(upd).toBeDefined()
    expect(upd!.params[0]).toBeNull()
  })

  it('a no-op status (same value) records no field-change row', async () => {
    const { calls } = mockClient()
    await writeTicketUpdate('t-1', CTX, { statusId: 's-old' })
    expect(sqlOf(calls)).not.toContain('INSERT INTO ticket_field_changes')
  })
})
