/**
 * What "purge a contact" means, in one place.
 *
 * ## Why this file exists
 *
 * Twenty-eight foreign-key columns reference `contacts`, and every one of them
 * is `ON DELETE SET NULL`. That one DDL choice is doing two completely
 * different jobs:
 *
 *   * For a ticket, an asset assignment or a chat session, nulling the link is
 *     right. The record is about work that really happened and it outlives the
 *     person; "raised by a contact who no longer exists" is the truth.
 *   * For a group membership, a tag, a credential link, a file link or an email
 *     preference, nulling the link is NOT right. Those rows have no meaning
 *     without the person — a membership of nobody, a preference belonging to
 *     nobody. Left behind they are exactly the residue an erasure request is
 *     supposed to remove, and they are invisible: no error, no count, nothing
 *     in the audit row.
 *
 * Postgres cannot express that difference, so the application has to, and until
 * this file it did so as a hand-written list of fourteen table names copied
 * into three files (`app/api/portal/admin/contacts/[id]/purge`,
 * `app/api/portal/admin/contacts/bulk/purge` and `lib/retention-purge.ts`).
 * Three copies of a list is three chances for a table added next year to be
 * cleaned up on one path and orphaned on another, and nothing would say so.
 *
 * So: one classification, as data, with the reason on each row — and a
 * database test (`database/tests/contact-purge-audit.integration.test.sql`,
 * T08) that compares this list against `pg_constraint`, so a new column
 * referencing `contacts` FAILS until someone classifies it. A decision by
 * omission is the thing this file is designed to prevent.
 */

/**
 * `delete` — the row is meaningless without the contact, so the purge removes
 *            it. These are the tables the purge paths clean up.
 * `detach`  — the row is about something that happened and survives the
 *            person; the FK's `ON DELETE SET NULL` nulls the link and the row
 *            stays. Nothing to do at purge time.
 *
 * There is no third disposition. There used to be a `blocks` one, for the five
 * columns that were `NOT NULL` with an `ON DELETE SET NULL` foreign key and no
 * purge path cleaning them up: Postgres cannot null such a column, so it
 * refused the parent delete and the contact could not be purged at all —
 * anyone ever named on an access request, an asset request or an offboarding
 * request was undeletable, and the admin got a 500. That was a DDL
 * contradiction rather than a decision, and "we cannot delete this person" is
 * not an answer a product should give by accident.
 *
 * Migration 100 settled it as an anonymisation: those columns are nullable now,
 * so the link goes with the person and the record stays — the disposition
 * nine other foreign keys to `contacts` already take, and the thing their
 * `ON DELETE SET NULL` always claimed to do. The full reasoning, including why
 * deleting the rows and why refusing the purge were both rejected, is in the
 * migration's header.
 *
 * Because an unexplained null would then be indistinguishable from an erased
 * one, each of those five columns has a companion `*_erased_at` stamp
 * (`erasedAtColumn` below), a CHECK that the link may be absent only when
 * stamped, and a trigger that stamps it as the FK nulls the link. So the shape
 * of the old bug — a `NOT NULL` column with an `ON DELETE SET NULL` foreign key
 * that the purge does not delete — is now checked against the live schema by
 * T08 rather than recorded in a list here.
 */
export type ContactLinkDisposition = 'delete' | 'detach'

export interface ContactLinkColumn {
  table: string
  column: string
  disposition: ContactLinkDisposition
  /** Why this disposition and not another. Read before changing one. */
  why: string
  /**
   * For a `detach` column that was `NOT NULL` until migration 100: the
   * timestamp column the database stamps as the link is nulled, so an erased
   * link is never mistaken for one that was never filled in. Only these
   * columns carry one — the other `detach` columns have been nullable since
   * they were created and have nothing to disambiguate.
   */
  erasedAtColumn?: string
}

/**
 * Every foreign-key column referencing `contacts`, with what a purge does
 * about it. Verified against `pg_constraint` by T08 — if you add a reference to
 * `contacts`, that test fails until you add it here.
 */
export const CONTACT_LINK_COLUMNS: readonly ContactLinkColumn[] = [
  // ---- delete: meaningless without the person --------------------------------
  { table: 'contact_tags', column: 'contact_id', disposition: 'delete', why: 'a tag applied to nobody' },
  { table: 'contact_group_members', column: 'contact_id', disposition: 'delete', why: 'membership of nobody' },
  { table: 'dynamic_group_members', column: 'contact_id', disposition: 'delete', why: 'membership of nobody; recomputed anyway' },
  { table: 'contact_credentials', column: 'contact_id', disposition: 'delete', why: 'credential issued to the person; must not outlive them' },
  { table: 'contact_files', column: 'contact_id', disposition: 'delete', why: 'files attached to the person' },
  { table: 'email_preferences', column: 'contact_id', disposition: 'delete', why: "a preference belonging to nobody" },
  { table: 'asset_contacts', column: 'contact_id', disposition: 'delete', why: 'asset-to-person link; the asset record itself survives separately' },
  { table: 'kb_contributors', column: 'contact_id', disposition: 'delete', why: 'contribution credit for a person who is gone' },
  { table: 'kb_permissions', column: 'contact_id', disposition: 'delete', why: 'a grant to nobody is a grant nobody can audit' },
  { table: 'service_owners', column: 'contact_id', disposition: 'delete', why: 'ownership by nobody' },
  { table: 'software_contacts', column: 'contact_id', disposition: 'delete', why: 'software-to-person link' },
  { table: 'team_members', column: 'contact_id', disposition: 'delete', why: 'membership of nobody' },
  { table: 'user_service_access', column: 'contact_id', disposition: 'delete', why: 'access grant to nobody' },
  { table: 'workspace_members', column: 'contact_id', disposition: 'delete', why: 'membership of nobody' },

  // ---- detach: the record outlives the person --------------------------------
  { table: 'tickets', column: 'contact_id', disposition: 'detach', why: 'the ticket and its history are a record of work done' },
  { table: 'assets', column: 'contact_id', disposition: 'detach', why: 'the asset exists and must stay inventoried' },
  { table: 'projects', column: 'contact_id', disposition: 'detach', why: 'the project outlives its contact' },
  { table: 'ai_chat_sessions', column: 'contact_id', disposition: 'detach', why: 'transcript of a conversation that happened' },
  { table: 'onboarding_requests', column: 'contact_id', disposition: 'detach', why: 'record of a request that was processed' },
  { table: 'bulk_access_operations', column: 'target_contact_id', disposition: 'detach', why: 'record of an access change that was made' },
  { table: 'departments', column: 'head_contact_id', disposition: 'detach', why: 'the department survives its head leaving' },
  { table: 'contacts', column: 'reports_to_id', disposition: 'detach', why: 'other people keep their rows; they just report to nobody' },
  { table: 'users', column: 'contact_id', disposition: 'detach', why: 'the login account is handled by user offboarding, not by this purge' },

  // ---- detach, by the decision in migration 100 ------------------------------
  // These five were the `blocks` cases: NOT NULL against an ON DELETE SET NULL
  // foreign key, so the purge was refused outright. They hold approval
  // decisions, fulfilments and termination dates — records of what was decided,
  // which outlive the person exactly as a ticket does — and `legal_hold` already
  // exists for the case where a person's records really must be kept. So the
  // identity goes and the record stays, stamped with when that happened.
  { table: 'access_requests', column: 'requester_id', disposition: 'detach',
    erasedAtColumn: 'requester_erased_at',
    why: 'the request and its approval decision are a record of work done; who asked is erased with them' },
  { table: 'access_requests', column: 'for_contact_id', disposition: 'detach',
    erasedAtColumn: 'for_contact_erased_at',
    why: 'what access was granted, and by whom, must stay auditable; who it was for is erased' },
  { table: 'asset_requests', column: 'requester_id', disposition: 'detach',
    erasedAtColumn: 'requester_erased_at',
    why: 'the approval chain and fulfilment are the provenance of the asset; who asked is erased' },
  { table: 'asset_requests', column: 'for_contact_id', disposition: 'detach',
    erasedAtColumn: 'for_contact_erased_at',
    why: 'as above — the asset record needs the request, not the person' },
  { table: 'offboarding_requests', column: 'contact_id', disposition: 'detach',
    erasedAtColumn: 'contact_erased_at',
    why: 'termination dates and the retrieval tasks hanging off this row are what was actually done; the person is erased' },
]

/**
 * The tables a purge empties, in the order the statements run. Derived from the
 * classification above — never hand-maintained, never copied into a route.
 */
export const CONTACT_PURGE_DELETE_TABLES: readonly string[] =
  CONTACT_LINK_COLUMNS.filter(c => c.disposition === 'delete').map(c => c.table)

/**
 * Delete every `delete`-disposition row belonging to these contacts, on the
 * caller's client and therefore inside the caller's transaction.
 *
 * Returns the number of rows removed, which the purge's audit payload records:
 * "what else went with the person" is part of what was destroyed, and a count
 * of zero where one was expected is a visible signal rather than a silent one.
 *
 * Does NOT delete the contacts themselves — the caller does that, after this,
 * in the same transaction, so a failure anywhere unwinds the whole purge.
 */
export async function purgeContactLinkRows(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }> },
  contactIds: string[],
): Promise<number> {
  let rows = 0
  for (const table of CONTACT_PURGE_DELETE_TABLES) {
    const res = await client.query(
      `DELETE FROM ${table} WHERE contact_id = ANY($1)`,
      [contactIds],
    )
    rows += res.rowCount ?? 0
  }
  return rows
}

/**
 * The `detach` columns that carry an `*_erased_at` stamp — the five that used
 * to make a contact undeletable. Derived, never hand-maintained.
 */
export const CONTACT_ERASURE_STAMPED_COLUMNS: readonly ContactLinkColumn[] =
  CONTACT_LINK_COLUMNS.filter(c => c.erasedAtColumn !== undefined)

export interface ContactAnonymisationCounts {
  /** Total rows that will keep their record and lose their link to these contacts. */
  total: number
  /** `table.column` → row count, for the columns that have any. */
  byColumn: Record<string, number>
}

/**
 * Count the request rows whose link to these contacts the purge is about to
 * null, BEFORE it happens — afterwards the links are gone and the question is
 * unanswerable.
 *
 * This exists because "what happened to the person's data" has two halves and
 * the purge's audit row only recorded one. `junction_rows` says what was
 * destroyed; without this, the records that were anonymised instead — the ones
 * that used to make the purge impossible — were the silent half. An erasure
 * request answered with "and three request records were anonymised, here is
 * when" is a different quality of answer from one answered with a count of
 * deleted junction rows.
 *
 * One round trip: a UNION ALL built from the classification, so a column added
 * there is counted here without anyone remembering to.
 */
export async function countContactAnonymisations(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { col: string; n: string | number }[] }> },
  contactIds: string[],
): Promise<ContactAnonymisationCounts> {
  if (CONTACT_ERASURE_STAMPED_COLUMNS.length === 0 || contactIds.length === 0) {
    return { total: 0, byColumn: {} }
  }

  const sql = CONTACT_ERASURE_STAMPED_COLUMNS.map(c =>
    `SELECT '${c.table}.${c.column}' AS col, COUNT(*) AS n ` +
    `FROM ${c.table} WHERE ${c.column} = ANY($1)`,
  ).join(' UNION ALL ')

  const res = await client.query(sql, [contactIds])

  const byColumn: Record<string, number> = {}
  let total = 0
  for (const row of res.rows) {
    const n = Number(row.n)
    if (n > 0) byColumn[row.col] = n
    total += n
  }
  return { total, byColumn }
}
