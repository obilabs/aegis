# Audit log: append-only, enforced by the database (D-058)

## Summary

Make `audit_log` append-only and tamper-evident **in the database**: triggers
that reject `UPDATE` / `DELETE` / `TRUNCATE` with a clear error, a `REVOKE` of
those privileges at the table ACL, a SHA-256 hash chain over every column, and
a verification function that walks the chain and names the first broken row.

Ships as `database/migrations/098_audit_log_append_only.sql` plus a SQL
integration test, a CI job that runs it against a real Postgres 16, a thin
`lib/audit-chain.ts`, an admin route, and `docs/AUDIT_LOG_INTEGRITY.md`.

## Problem statement

The access-control stack (#35–#39) made `audit_log` load-bearing: role grants,
admin decisions and ticket-access decisions all write a trail the compliance
argument rests on. That trail was append-only **by convention only** — a review
found no rule, no trigger, no `REVOKE` and no hash chain on `audit_log`. Three
consequences:

1. Anything holding the application's database credentials could rewrite or
   delete history. That includes a bug, a stray ORM call, and a hand-run
   `UPDATE` during an incident.
2. A deletion left no trace at all: rows are not numbered and nothing links a
   row to its predecessor, so a gap is invisible.
3. "Your audit trail is immutable" was a claim with nothing behind it. Aegis is
   sold on data sovereignty and accountability; that is the wrong sentence to
   be unable to demonstrate.

D-058 says every product must have what Helios already has.

## Chosen direction

Follow Helios rather than invent a second design — D-058 exists partly to stop
a second pattern appearing. Helios has two relevant precedents:

- `backend/database/migrations/075_phishing_event_stream.sql` — `phish_event`
  is append-only; a `BEFORE UPDATE OR DELETE` trigger `RAISE`s with
  `ERRCODE = 'integrity_constraint_violation'` and names the row. **The
  immutability guard here copies that shape.**
- `backend/database/migrations/066_create_security_audit_logs.sql` —
  `security_audit_logs` carries `previous_hash` / `record_hash` filled by a
  `BEFORE INSERT` trigger from a SQL hash function. **The chain here copies
  that shape.**

Four deliberate divergences, each with a reason (restated at length in 098's
header):

1. **Raise, do not swallow.** Helios 066 uses `DO INSTEAD NOTHING` rules, which
   are silent: `UPDATE audit_log …` reports `UPDATE 0` and an ORM that ignores
   row counts believes it worked. A guard whose failure is indistinguishable
   from success is the failure mode we keep paying for.
2. **Hash every column, not seven.** Helios 066 hashes
   `(id, timestamp, actor_type, action, outcome, organization_id,
   previous_hash)`, so editing the changed-values payload or the actor's email
   is undetectable there.
3. **Timezone-independent timestamps.** Helios casts `timestamptz::TEXT`, whose
   output depends on the session's `TimeZone` and `DateStyle`.
4. **Order by a sequence, under a lock.** Helios picks the predecessor with
   `ORDER BY timestamp DESC` and takes no lock; `now()` is transaction-start
   time, so concurrent appenders can fork the chain, and a fork looks exactly
   like tampering.

Also: the hash exists **only** in SQL. Helios has a second, dead TypeScript
implementation (`backend/src/lib/audit-hash.ts`) whose value the insert trigger
immediately overwrites. One hash, one place.

## Decisions

- **Pre-existing rows are not back-filled.** They are marked
  `hash_version = 0` / `record_hash IS NULL`, counted separately by the
  verifier, and bounded by one `audit.chain.initialised` row recording the
  boundary. Hashing them now would manufacture evidence: a chain that looks
  verified back to the first install while certifying nothing.
- **Two enforcement layers, neither trusted alone.** A superuser bypasses the
  ACL; the table owner can disable the triggers. Both are shipped, and the
  chain keeps tampering detectable either way. The default compose file runs
  the app as the container superuser, so `docs/AUDIT_LOG_INTEGRITY.md`
  documents the non-superuser role setup that makes the ACL bite.
- **No repair path.** The verifier reports; it cannot fix. A repairable audit
  trail is not evidence.
- **Serialised appends are an accepted cost** (~+0.15–0.25 ms per row,
  measured). Nothing in Aegis writes audit rows in a tight loop today.

## Non-goals

- Scheduling verification or alerting on failure.
- An external anchor for the chain head (without one, deleting the newest rows
  stays undetectable).
- Any change to audit *callers*. `logAudit` / `logAuthEvent` and the three
  other insert sites are untouched; they only ever `INSERT`.
- Detecting a restore from an older backup.
