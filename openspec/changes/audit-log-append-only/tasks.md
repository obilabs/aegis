# Tasks — Audit log append-only (D-058)

## Database enforcement — DONE
- [x] `database/migrations/098_audit_log_append_only.sql`: adds `chain_seq`,
      `hash_version`, `previous_hash`, `record_hash` + the sequence, the unique
      index and the `hash_version`/`record_hash` consistency CHECK.
- [x] `trg_audit_log_no_update` / `trg_audit_log_no_delete` /
      `trg_audit_log_no_truncate` — `RAISE` with SQLSTATE 23000, naming the row
      and the operation (Helios 075 shape, not Helios 066's silent rules).
- [x] `REVOKE UPDATE, DELETE, TRUNCATE` from PUBLIC, from every role holding an
      explicit grant, and from the owner; `RAISE WARNING` when the current role
      is a superuser, since ACLs do not apply to superusers.
- [x] Migration is idempotent (verified by applying it twice).

## Hash chain — DONE
- [x] `audit_log_hash_field()` — length-prefixed field encoding, so free text
      cannot shift bytes across a field boundary.
- [x] `audit_log_canonical_payload_v1()` — all 21 columns + `previous_hash`;
      jsonb via its canonical text form, `created_at` formatted at UTC,
      NULL (`-1:`) distinct from empty string (`0:`).
- [x] `audit_log_chain_before_insert()` — `pg_advisory_xact_lock(7741098)`,
      then head read by `chain_seq DESC`, then `chain_seq` / `hash_version` /
      `previous_hash` / `record_hash` set by the database, never the caller.
- [x] Field list, serialisation and NULL handling documented in the migration
      header and `docs/AUDIT_LOG_INTEGRITY.md`.

## Pre-existing rows — DONE
- [x] Legacy rows marked `hash_version = 0`, `record_hash IS NULL`, given a
      `chain_seq` for ordering only. Not back-filled.
- [x] One `audit.chain.initialised` row records the boundary (legacy count +
      newest legacy timestamp) where an organisation exists.
- [x] `verify_audit_log_chain()` reports `unchained_legacy_rows` separately.

## Verification path — DONE
- [x] `verify_audit_log_chain(p_from_seq)` — walks the chain in `chain_seq`
      order, returns the first break with id / seq / created_at / reason
      (`record_hash_mismatch`, `chain_link_mismatch`,
      `unsupported_hash_version`).
- [x] `lib/audit-chain.ts` — `verifyAuditChain()`. No TS hash implementation,
      deliberately.
- [x] `GET /api/settings/audit-log/verify` — admin-only, read-only, returns 200
      with `ok: false` on a broken chain.
- [x] `docs/AUDIT_LOG_INTEGRITY.md` — operator view, the psql one-liner, the
      non-superuser role setup, and the honest limits.

## Tests that prove it — DONE
- [x] `database/tests/audit-immutability.integration.test.sql`, 11 cases:
      T01 append works and the chain framing is filled;
      T02 a second append links to the first and the verifier walks clean;
      T03 `UPDATE` refused with a clear error and the row unchanged;
      T04 `DELETE` refused;
      T05 `TRUNCATE CASCADE` refused;
      T06 no role holds UPDATE/DELETE/TRUNCATE in the table ACL;
      T07 **elevated-role edit** (guard trigger disabled) → verifier reports
          `record_hash_mismatch` and names that row;
      T08 **elevated-role delete** → verifier reports `chain_link_mismatch` at
          the successor row;
      T09 the field encoding is unambiguous, NULL ≠ empty string;
      T10 a legacy row cannot be forged into a chained one (CHECK);
      T11 every one of the 22 fields in canonical payload v1 changes the hash
          (each field mutated via a jsonb round-trip, no guard disabled) — so
          "the hash covers all columns" is checked, not just asserted.
- [x] Negative controls run by hand: with migration 098 absent the file fails;
      with only `trg_audit_log_no_update` dropped T03 fails with
      "UPDATE SUCCEEDED (BAD)"; with the chain trigger dropped the insert
      fails; with two fields removed from the payload function the suite fails
      at T07. The tests are not vacuous.
- [x] CI `database` job (`.github/workflows/ci.yml`): pgvector/pg16 service,
      builds the schema the way `docker-entrypoint.sh` does (init.sql then
      unapplied migrations), runs the test file.

## Follow-ups (not in this change)
- [ ] Schedule verification and alert on `ok: false`.
- [ ] External anchor for the chain head, so deleting the newest rows is also
      detectable.
- [ ] `lib/retention-purge.ts` writes its audit row with an `audit_log.details`
      column that does not exist and no `actor_type`; the insert fails inside a
      `try/catch`, so every retention purge is currently unaudited and silent.
      Pre-existing, unrelated to this change, needs its own fix.
- [ ] Fold 098 into `database/init.sql` at the next consolidation (not needed
      now: init.sql pre-populates `schema_migrations` only through 097, so a
      fresh install applies 098 from the migration loop — verified).
