# Audit log integrity

`audit_log` is **append-only and tamper-evident, enforced by the database** —
not by convention, and not by application discipline. Migration
`database/migrations/098_audit_log_append_only.sql` is the whole mechanism and
its file header is the authoritative reference; this page is the operator view.

Follows Helios deliberately: the immutability guard copies
`helios/backend/database/migrations/075_phishing_event_stream.sql`
(`phish_event_immutable()`), the hash chain copies
`helios/backend/database/migrations/066_create_security_audit_logs.sql`.
Divergences, and why, are listed in 098's header.

## What is enforced

| Operation | What happens |
|---|---|
| `INSERT` | Allowed. A `BEFORE INSERT` trigger assigns `chain_seq`, sets `hash_version = 1`, links `previous_hash` to the preceding row and computes `record_hash`. Callers cannot set any of these. |
| `UPDATE` | **Rejected** by `trg_audit_log_no_update` with SQLSTATE 23000 and a message naming the row. Also revoked at the table ACL. |
| `DELETE` | **Rejected** by `trg_audit_log_no_delete`, same. |
| `TRUNCATE` | **Rejected** by `trg_audit_log_no_truncate`. (A plain `TRUNCATE` is additionally refused because `audit_log` is referenced by a foreign key.) |

Two layers on purpose: a privileged role can bypass either one alone. Table
ACLs do not apply to superusers; triggers can be disabled by the table's owner.
Neither is relied on by itself, and the hash chain means that even tampering
that gets past both is **detectable afterwards**.

## Run the application as a non-superuser role

The default `docker-compose.yml` connects as `aegis`, which is the Postgres
container's **superuser**. On such an install the `REVOKE` is documentation and
the triggers are the enforcing control. To make the ACL bite as well, give the
app its own non-superuser role:

```sql
-- as the database owner
CREATE ROLE aegis_app LOGIN PASSWORD '<secret>';
GRANT CONNECT ON DATABASE aegis TO aegis_app;
GRANT USAGE ON SCHEMA public TO aegis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aegis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aegis_app;

-- then take back what nothing may do to history
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM aegis_app;
```

Then point `DATABASE_URL` at `aegis_app`. Migrations still run as the owner.

## Verifying the chain

Three ways into the same database function.

**SQL** (works on any deployed install, no app needed):

```bash
docker exec aegis-db psql -U aegis -d aegis -c "SELECT * FROM verify_audit_log_chain();"
```

**HTTP**, admin session required:

```
GET /api/settings/audit-log/verify
GET /api/settings/audit-log/verify?fromSeq=12345
```

**TypeScript**: `verifyAuditChain()` in `lib/audit-chain.ts`.

The result reports the **first** break with its row id:

| Field | Meaning |
|---|---|
| `ok` | Every chained row verified. |
| `checked_rows` | Rows covered by the chain and inspected. |
| `unchained_legacy_rows` | Rows written before migration 098. Never protected, never verified — see below. |
| `chain_start_seq` / `chain_end_seq` | Range inspected. |
| `first_break_id` / `first_break_seq` / `first_break_created_at` | The row where verification stopped. |
| `first_break_reason` | `record_hash_mismatch` (the row was edited), `chain_link_mismatch` (a row before it was removed or altered), or `unsupported_hash_version`. |

`ok: true` with a non-zero `unchained_legacy_rows` means "the chain is intact,
and there is older history the chain says nothing about". Read both numbers.

## Pre-existing rows: the chain starts at migration 098

Rows written before 098 were never hash-protected. They are marked
`hash_version = 0` with `record_hash IS NULL`, given a `chain_seq` purely for
ordering, counted separately by the verifier, and **not** back-filled.
Computing hashes over them now would produce a chain that looks verified back
to the first install while certifying nothing.

Where an organisation already existed, 098 appends one
`audit.chain.initialised` row recording the boundary: how many legacy rows
there were and the newest legacy timestamp. That row is the genesis of the
chain (`previous_hash IS NULL`).

## What the hash covers

`record_hash` is the SHA-256 of a **length-prefixed** serialisation of all 21
columns plus `previous_hash` — field list, NULL handling, jsonb and timestamp
serialisation are specified in 098's header under "WHAT THE HASH COVERS". Two
properties worth knowing:

- Length prefixing (not a `'|'` join) is what makes the payload unambiguous:
  `entity_name`, `error_message` and the jsonb columns are free text and can
  contain the separator.
- `created_at` is serialised at UTC with an explicit pattern, so verification
  gives the same answer from any session timezone.

A future column needs a **v2** payload function and a v2 branch in the
verifier. Never edit v1 in place — that would silently change the meaning of
every historical hash.

## Limits (state these honestly, do not oversell)

- **A superuser can still tamper.** `ALTER TABLE audit_log DISABLE TRIGGER ...`
  or `session_replication_role = replica` gets past the guards. The chain makes
  it detectable, not impossible.
- **Deleting the newest row(s) is undetectable** by a self-contained chain:
  there is no successor left to point at the missing hash. Detecting that needs
  an external anchor (periodically recording the latest `record_hash` somewhere
  outside the database). Not implemented.
- **Nothing watches the verifier.** It answers when asked. Scheduling it and
  alerting on `ok: false` is separate work.
- **Backups are not covered.** A restore of an older dump silently rewinds
  history; the chain will verify clean because it is internally consistent.

## Cost

Appends are serialised by an advisory transaction lock, which costs roughly
**+0.15–0.25 ms per appended row** (measured numbers and method are in 098's
header under "WRITE THROUGHPUT"). Nothing in Aegis writes audit rows in a tight
loop today — the retention purge writes one row per *batch*. If something ever
needs thousands of audit rows, batch them into one multi-row `INSERT`, which
takes the lock once and still chains the rows in order.

## Tests

`database/tests/audit-immutability.integration.test.sql`, run with
`scripts/test-db.sh audit-immutability`, and in CI against a real Postgres 16
(the `database` job in `.github/workflows/ci.yml`). Eleven cases: appends work
and chain; UPDATE, DELETE and TRUNCATE are refused; no role holds those
privileges; an edited row and a deleted row are both caught by the verifier
**using the elevated role to do the tampering**; the field encoding is
unambiguous; a legacy row cannot be forged into a chained one; and every one of
the 22 payload fields demonstrably changes the hash, so the coverage claim above
is checked rather than asserted.
