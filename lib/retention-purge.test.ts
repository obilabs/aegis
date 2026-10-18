/**
 * Retention purge worker tests.
 *
 * What this file proves, and what it does not:
 *
 * The load-bearing proof that a purge whose audit write fails destroys nothing
 * lives in `database/tests/retention-purge-audit.integration.test.sql`, which
 * induces a REAL audit-write failure in a REAL Postgres (a trigger that raises
 * on the actual INSERT) and then checks the rows are still there. No mock can
 * establish that, because the guarantee is a transaction boundary in the
 * database.
 *
 * What a vitest CAN establish is the part that lives in this module: that the
 * worker puts the audit INSERT on the SAME client between BEGIN and COMMIT
 * rather than in a later statement of its own, that it ROLLBACKs and rethrows
 * instead of continuing, and that a run with a failed policy ends by THROWING
 * — which is what fails the pg-boss job and makes the failure something other
 * than a line in a console log. Those are assertions about this file's
 * structure and control flow, and that is what the mocks below are for.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { query, connect } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ pool: { query, connect } }))
vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(),
  QUEUES: { RETENTION_PURGE: 'retention-purge' },
}))

import { runRetentionPurge } from './retention-purge'

const POLICY = {
  organization_id: 'org-1',
  entity_type: 'contacts',
  retention_days: 365,
  exempt_if_closed: true,
}

type Call = { sql: string; params: unknown[] }

/**
 * A pool client that records every statement. `failAuditInsert` makes the
 * audit INSERT reject the way Postgres rejects it (an error from
 * `client.query`), which is the only way this layer ever learns about it.
 */
function mockClient(opts: { deleted?: number; failAuditInsert?: boolean; auditRowCount?: number } = {}) {
  const calls: Call[] = []
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      if (sql.startsWith('INSERT INTO audit_log')) {
        if (opts.failAuditInsert) {
          throw Object.assign(new Error('null value in column "actor_type" violates not-null constraint'), {
            code: '23502',
          })
        }
        return { rows: [], rowCount: opts.auditRowCount ?? 1 }
      }
      if (sql.startsWith('DELETE FROM contacts')) {
        return { rows: [], rowCount: opts.deleted ?? 2 }
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }
  return { client, calls }
}

/** pool.query: the policy list, then the id selection. */
function mockPoolQueries(ids: string[], policies = [POLICY]) {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM data_retention_policies')) return { rows: policies, rowCount: policies.length }
    if (sql.includes('FROM contacts')) return { rows: ids.map(id => ({ id })), rowCount: ids.length }
    if (sql.startsWith('INSERT INTO audit_log')) return { rows: [], rowCount: 1 }
    return { rows: [], rowCount: 0 }
  })
}

const sqlOf = (calls: Call[]) => calls.map(c => c.sql.trim().split('\n')[0].trim())

describe('runRetentionPurge', () => {
  beforeEach(() => {
    query.mockReset()
    connect.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when no policy is set to auto_purge', async () => {
    mockPoolQueries([], [])
    await expect(runRetentionPurge()).resolves.toBeUndefined()
    expect(connect).not.toHaveBeenCalled()
  })

  it('writes the audit row on the same client, inside the delete transaction', async () => {
    const { client, calls } = mockClient({ deleted: 2 })
    connect.mockResolvedValue(client)
    mockPoolQueries(['c-1', 'c-2'])

    await runRetentionPurge()

    const order = sqlOf(calls)
    const begin = order.indexOf('BEGIN')
    const del = order.findIndex(s => s.startsWith('DELETE FROM contacts'))
    const audit = order.findIndex(s => s.startsWith('INSERT INTO audit_log'))
    const commit = order.indexOf('COMMIT')

    expect(begin).toBe(0)
    expect(del).toBeGreaterThan(begin)
    // The audit row is written after the DELETE (so it records the real row
    // count) and before the COMMIT (so it cannot be lost once the rows are).
    expect(audit).toBeGreaterThan(del)
    expect(commit).toBeGreaterThan(audit)
    expect(order).not.toContain('ROLLBACK')

    // And NOT as a separate statement on the pool, which is what made the old
    // version's failure survivable.
    const poolAudits = query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT INTO audit_log'))
    expect(poolAudits).toHaveLength(0)
  })

  it('records the purge as a system actor with the payload in new_values', async () => {
    const { client, calls } = mockClient({ deleted: 2 })
    connect.mockResolvedValue(client)
    mockPoolQueries(['c-1', 'c-2'])

    await runRetentionPurge()

    const audit = calls.find(c => c.sql.trim().startsWith('INSERT INTO audit_log'))!

    // The shape lib/audit.ts, lib/cascade-revoke.ts and the AI-config route all
    // use. `details` is not a column of audit_log; `actor_type` is NOT NULL.
    expect(audit.sql).toContain('actor_type')
    expect(audit.sql).toContain('new_values')
    expect(audit.sql).toContain("'system'")
    expect(audit.sql).not.toContain('details')

    // The chain columns belong to migration 099's trigger, not to this caller.
    for (const col of ['chain_seq', 'hash_version', 'previous_hash', 'record_hash']) {
      expect(audit.sql).not.toContain(col)
    }

    const payload = JSON.parse(audit.params[2] as string)
    expect(payload).toMatchObject({
      count: 2,              // what was actually deleted, not what was intended
      requested: 2,
      retention_days: 365,
      batch_offset: 0,
    })
    expect(payload.entity_ids).toEqual(['c-1', 'c-2'])
  })

  it('rolls back and does not swallow when the audit write is rejected', async () => {
    const { client, calls } = mockClient({ deleted: 2, failAuditInsert: true })
    connect.mockResolvedValue(client)
    mockPoolQueries(['c-1', 'c-2'])

    // The run FAILS. Before the fix this resolved normally, having deleted the
    // rows and logged the rejection to the console.
    await expect(runRetentionPurge()).rejects.toThrow(/failed; data was NOT purged/)

    const order = sqlOf(calls)
    expect(order).toContain('ROLLBACK')
    expect(order).not.toContain('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })

  it('treats an audit INSERT that affects no rows as a failure', async () => {
    // The silent shape migration 099 was written to avoid: a rule or trigger
    // that drops the write and reports success.
    const { client, calls } = mockClient({ deleted: 2, auditRowCount: 0 })
    connect.mockResolvedValue(client)
    mockPoolQueries(['c-1', 'c-2'])

    await expect(runRetentionPurge()).rejects.toThrow(/failed; data was NOT purged/)
    expect(sqlOf(calls)).toContain('ROLLBACK')
    expect(sqlOf(calls)).not.toContain('COMMIT')
  })

  it('aborts the remaining batches rather than purging on unrecorded', async () => {
    const { client, calls } = mockClient({ deleted: 100, failAuditInsert: true })
    connect.mockResolvedValue(client)
    // 250 ids => 3 batches of 100/100/50 if it kept going.
    mockPoolQueries(Array.from({ length: 250 }, (_, i) => `c-${i}`))

    await expect(runRetentionPurge()).rejects.toThrow()

    const deletes = sqlOf(calls).filter(s => s.startsWith('DELETE FROM contacts'))
    expect(deletes).toHaveLength(1)
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('appends a retention_purge_failed row, and still throws if it cannot', async () => {
    const { client } = mockClient({ deleted: 2, failAuditInsert: true })
    connect.mockResolvedValue(client)
    mockPoolQueries(['c-1'])

    await expect(runRetentionPurge()).rejects.toThrow()

    const failureRows = query.mock.calls.filter(([sql]) =>
      String(sql).includes('retention_purge_failed'))
    expect(failureRows).toHaveLength(1)
    expect(String(failureRows[0][0])).toContain("'system'")
    expect(String(failureRows[0][0])).toContain('false')
    // The reason the purge failed is carried, not just the fact of it.
    expect(failureRows[0][1]).toContainEqual(
      expect.stringContaining('null value in column "actor_type"'))

    // Now make that write fail too — the most likely real case, since the
    // reason a purge failed may be that audit_log is unwritable. The run must
    // still fail: visibility cannot depend on the subsystem that broke.
    query.mockReset()
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM data_retention_policies')) return { rows: [POLICY], rowCount: 1 }
      if (sql.includes('FROM contacts')) return { rows: [{ id: 'c-1' }], rowCount: 1 }
      throw new Error('audit_log is unreachable')
    })
    connect.mockResolvedValue(mockClient({ deleted: 1, failAuditInsert: true }).client)

    await expect(runRetentionPurge()).rejects.toThrow(/failed; data was NOT purged/)
  })

  it('keeps going to the next policy, but fails the run as a whole', async () => {
    const good = mockClient({ deleted: 1 })
    const bad = mockClient({ deleted: 1, failAuditInsert: true })
    connect.mockResolvedValueOnce(bad.client).mockResolvedValueOnce(good.client)

    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM data_retention_policies')) {
        return {
          rows: [POLICY, { ...POLICY, entity_type: 'assets' }],
          rowCount: 2,
        }
      }
      if (sql.includes('FROM contacts') || sql.includes('FROM assets')) {
        return { rows: [{ id: 'x-1' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 1 }
    })

    // `assets` is independent of `contacts` and still gets purged...
    await expect(runRetentionPurge()).rejects.toThrow(/1 of 2 retention policies failed/)
    expect(sqlOf(good.calls)).toContain('COMMIT')
    // ...but the run does not report success.
  })

  it('refuses to purge an entity type outside the allow-list', async () => {
    const { client, calls } = mockClient()
    connect.mockResolvedValue(client)
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM data_retention_policies')) {
        return { rows: [{ ...POLICY, entity_type: 'organizations' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    // Unknown types are dropped by the selection switch before any client is
    // taken, so nothing is deleted and nothing is interpolated.
    await expect(runRetentionPurge()).resolves.toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
