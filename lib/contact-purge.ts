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
 * `blocks`  — `NOT NULL` column with an `ON DELETE SET NULL` foreign key, and
 *            not cleaned up: Postgres cannot null it, so it REFUSES the parent
 *            delete and the contact cannot be purged at all. This is a bug, not
 *            a policy — recorded here because the shape of the bug is "nobody
 *            decided", and left to its own change because whether such a row
 *            should be deleted, anonymised, or block the purge with a clear
 *            explanation is a retention decision rather than a typo.
 */
export type ContactLinkDisposition = 'delete' | 'detach' | 'blocks'

export interface ContactLinkColumn {
  table: string
  column: string
  disposition: ContactLinkDisposition
  /** Why this disposition and not another. Read before changing one. */
  why: string
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

  // ---- blocks: NOT NULL + SET NULL, so the delete is refused ------------------
  { table: 'access_requests', column: 'requester_id', disposition: 'blocks', why: 'NOT NULL; the purge is refused by Postgres. Pending decision — see the type doc' },
  { table: 'access_requests', column: 'for_contact_id', disposition: 'blocks', why: 'NOT NULL; as above' },
  { table: 'asset_requests', column: 'requester_id', disposition: 'blocks', why: 'NOT NULL; as above' },
  { table: 'asset_requests', column: 'for_contact_id', disposition: 'blocks', why: 'NOT NULL; as above' },
  { table: 'offboarding_requests', column: 'contact_id', disposition: 'blocks', why: 'NOT NULL; as above' },
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
