/**
 * The definition of "purge a contact", checked from the TypeScript side.
 *
 * The classification exists in two places by necessity — the application needs
 * it as code, and only Postgres can check it against `pg_constraint` — so the
 * two must not be allowed to drift. The database test owns the catalog
 * comparison (T08 fails when a new foreign key to `contacts` is unclassified);
 * this file reads THAT list out of the SQL file and asserts the TypeScript
 * agrees with it, row for row. Neither side can be edited alone.
 */

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONTACT_LINK_COLUMNS,
  CONTACT_PURGE_DELETE_TABLES,
  purgeContactLinkRows,
} from './contact-purge'

const SQL_TEST = join(
  __dirname, '..', 'database', 'tests', 'contact-purge-audit.integration.test.sql',
)

/** The rows of T00's `INSERT INTO cp_classification ... VALUES (...)`. */
function classificationFromSql(): { table: string; column: string; disposition: string }[] {
  const sql = readFileSync(SQL_TEST, 'utf8')
  const start = sql.indexOf('INSERT INTO cp_classification')
  expect(start, 'the SQL test no longer populates cp_classification').toBeGreaterThan(-1)
  const block = sql.slice(start, sql.indexOf(';', start))
  return [...block.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*,\s*'(delete|detach|blocks)'\s*\)/g)]
    .map(m => ({ table: m[1], column: m[2], disposition: m[3] }))
}

const key = (c: { table: string; column: string; disposition: string }) =>
  `${c.table}.${c.column}=${c.disposition}`

describe('contact link classification', () => {
  it('matches the list the database test checks against pg_constraint', () => {
    const fromSql = classificationFromSql()
    expect(fromSql.length).toBeGreaterThan(20) // sanity: the parse found rows

    expect([...CONTACT_LINK_COLUMNS].map(key).sort())
      .toEqual(fromSql.map(key).sort())
  })

  it('gives every column a reason, because the next person has to decide too', () => {
    for (const c of CONTACT_LINK_COLUMNS) {
      expect(c.why, `${c.table}.${c.column} has no reason`).toBeTruthy()
      expect(c.why.length).toBeGreaterThan(10)
    }
  })

  it('derives the delete list rather than letting it be hand-written', () => {
    expect(CONTACT_PURGE_DELETE_TABLES).toEqual(
      CONTACT_LINK_COLUMNS.filter(c => c.disposition === 'delete').map(c => c.table),
    )
    // No table may be in two minds about itself.
    const byTable = new Map<string, Set<string>>()
    for (const c of CONTACT_LINK_COLUMNS) {
      if (!byTable.has(c.table)) byTable.set(c.table, new Set())
      byTable.get(c.table)!.add(c.disposition)
    }
    for (const [table, dispositions] of byTable) {
      expect([...dispositions], `${table} has mixed dispositions`).toHaveLength(1)
    }
  })
})

describe('purgeContactLinkRows', () => {
  it('deletes from every delete-table on the caller client, and nothing else', async () => {
    const calls: string[] = []
    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql)
        return { rowCount: 1 }
      }),
    }

    const rows = await purgeContactLinkRows(client, ['c-1', 'c-2'])

    expect(rows).toBe(CONTACT_PURGE_DELETE_TABLES.length)
    expect(calls).toEqual(
      CONTACT_PURGE_DELETE_TABLES.map(t => `DELETE FROM ${t} WHERE contact_id = ANY($1)`),
    )
    // It must NOT delete the contacts: the caller does that, in the same
    // transaction, after this.
    expect(calls.some(s => /DELETE FROM contacts\b/.test(s))).toBe(false)
  })

  it('passes the ids as one array parameter, never interpolated', async () => {
    const params: unknown[][] = []
    const client = {
      query: vi.fn(async (_sql: string, p: unknown[] = []) => {
        params.push(p)
        return { rowCount: 0 }
      }),
    }

    await purgeContactLinkRows(client, ['c-1'])

    for (const p of params) expect(p).toEqual([['c-1']])
  })

  it('sums the rows actually removed, and treats a null rowCount as zero', async () => {
    let n = 0
    const client = {
      query: vi.fn(async () => ({ rowCount: n++ % 2 === 0 ? 2 : null })),
    }

    const rows = await purgeContactLinkRows(client, ['c-1'])
    expect(rows).toBe(2 * Math.ceil(CONTACT_PURGE_DELETE_TABLES.length / 2))
  })

  it('propagates a failure instead of continuing through the list', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('contact_credentials')) throw new Error('permission denied')
        return { rowCount: 1 }
      }),
    }

    await expect(purgeContactLinkRows(client, ['c-1'])).rejects.toThrow('permission denied')
    // Stopped at the failure: the caller's transaction is about to roll back.
    expect(client.query.mock.calls.length).toBeLessThan(CONTACT_PURGE_DELETE_TABLES.length)
  })
})
