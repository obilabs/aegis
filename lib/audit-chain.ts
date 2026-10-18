/**
 * Audit-log chain verification (D-058).
 *
 * The hash itself is computed ONLY in the database (migration 098:
 * `audit_log_canonical_payload_v1` + the BEFORE INSERT trigger). There is
 * deliberately no TypeScript hash implementation here.
 *
 * Helios has two — `backend/src/lib/audit-hash.ts` computes a
 * `JSON.stringify`-based record hash that migration 066's BEFORE INSERT
 * trigger then overwrites with a different one. Two implementations of the
 * same hash, one of them dead, is exactly the second-pattern problem D-058
 * exists to stop. Here the database is the single source of truth and this
 * module only asks it the question.
 */

import { pool } from '@/lib/db'

export interface AuditChainVerification {
  /** True when every chained row verified. */
  ok: boolean
  /** Rows covered by the chain and checked by this run. */
  checkedRows: number
  /**
   * Rows written before migration 098. Never hash-protected, so never
   * verified — reported separately so "ok" is not read as "all history is
   * proven".
   */
  unchainedLegacyRows: number
  /** chain_seq of the first and last row inspected (null when none). */
  chainStartSeq: number | null
  chainEndSeq: number | null
  /** The first break, when there is one. */
  firstBreak: {
    id: string
    chainSeq: number
    createdAt: string | null
    reason: string
  } | null
}

/**
 * Walk the audit_log hash chain and report the first break.
 *
 * @param fromSeq Optional chain_seq to start from, for verifying a suffix
 *                from a known-good point instead of the whole chain.
 */
export async function verifyAuditChain(fromSeq?: number): Promise<AuditChainVerification> {
  const result = await pool.query(
    'SELECT * FROM verify_audit_log_chain($1)',
    [fromSeq ?? null]
  )
  const row = result.rows[0]

  // The function always returns exactly one row; treat its absence as a
  // failure rather than reporting a clean chain we never checked.
  if (!row) {
    throw new Error('verify_audit_log_chain() returned no row')
  }

  const toNum = (v: unknown): number => Number(v ?? 0)

  return {
    ok: row.ok === true,
    checkedRows: toNum(row.checked_rows),
    unchainedLegacyRows: toNum(row.unchained_legacy_rows),
    chainStartSeq: row.chain_start_seq === null ? null : Number(row.chain_start_seq),
    chainEndSeq: row.chain_end_seq === null ? null : Number(row.chain_end_seq),
    firstBreak: row.first_break_id
      ? {
          id: row.first_break_id,
          chainSeq: Number(row.first_break_seq),
          createdAt: row.first_break_created_at
            ? new Date(row.first_break_created_at).toISOString()
            : null,
          reason: row.first_break_reason,
        }
      : null,
  }
}
