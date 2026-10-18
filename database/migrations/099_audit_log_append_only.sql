-- 098_audit_log_append_only.sql
--
-- Makes `audit_log` append-only and tamper-evident, ENFORCED BY THE DATABASE.
--
-- Why now: the access-control stack (#35-#39) made audit_log load-bearing —
-- role grants, admin decisions and ticket-access decisions all write a trail
-- that the product's compliance argument rests on. Until this migration that
-- trail was append-only by CONVENTION only: there was no rule, no trigger, no
-- REVOKE and no hash chain, so anything holding the application's database
-- credentials (a bug, a stray ORM call, a hand-run UPDATE) could rewrite or
-- delete history and leave no trace.
--
-- Follows Helios, deliberately, rather than inventing a second design:
--   * the immutability guard copies the shape of helios
--     `backend/database/migrations/075_phishing_event_stream.sql`
--     (`phish_event_immutable()`): a BEFORE trigger that RAISEs with
--     ERRCODE 'integrity_constraint_violation' and names the row.
--   * the hash chain copies the shape of helios
--     `backend/database/migrations/066_create_security_audit_logs.sql`
--     (`calculate_audit_hash()` + a BEFORE INSERT trigger that fills
--     `previous_hash` / `record_hash`).
--
-- Four deliberate divergences from Helios 066, each for a reason:
--
--   1. TRIGGER THAT RAISES, NOT A RULE THAT SWALLOWS. Helios 066 uses
--      `ON UPDATE DO INSTEAD NOTHING` / `ON DELETE DO INSTEAD NOTHING`. Those
--      make history immutable but they are SILENT: `UPDATE audit_log SET ...`
--      reports "UPDATE 0" and an ORM that ignores row counts believes it
--      succeeded. A guard whose failure is indistinguishable from success is
--      the failure mode we keep paying for, so here UPDATE/DELETE/TRUNCATE
--      raise a named exception instead.
--
--   2. THE HASH COVERS EVERY COLUMN, not seven. Helios 066 hashes only
--      (id, timestamp, actor_type, action, outcome, organization_id,
--      previous_hash) — so editing `changes_after`, the actor's email or the
--      outcome detail of a Helios row is undetectable. The whole point of
--      D-058 is that a silent edit is impossible, so v1 here covers all 21
--      pre-existing columns plus the chain link.
--
--   3. TIMEZONE-INDEPENDENT TIMESTAMP SERIALISATION. Helios casts
--      `timestamptz::TEXT`, whose output depends on the session's `TimeZone`
--      and `DateStyle`. Verification from a session with a different TimeZone
--      would report every row as broken. v1 formats at UTC with an explicit
--      pattern.
--
--   4. ORDERED BY A SEQUENCE, UNDER A LOCK, NOT BY `timestamp DESC`. Helios
--      picks the predecessor with `ORDER BY timestamp DESC, id DESC` and takes
--      no lock. `now()` is transaction-start time, so two concurrent appenders
--      can read the same predecessor and fork the chain, and the fork is
--      indistinguishable from tampering. Here the chain is ordered by
--      `chain_seq` and appends are serialised by an advisory transaction lock.
--      Cost: see "WRITE THROUGHPUT" below.
--
-- ===========================================================================
-- WHAT THE HASH COVERS (canonical payload v1)
-- ===========================================================================
-- `record_hash` = sha256 hex of a text payload built by
-- `audit_log_canonical_payload_v1()`, which is:
--
--   'aegis.audit_log.v1' || '|' || '22' || '|' || f1 || f2 || ... || f22
--
-- where each field is LENGTH-PREFIXED:
--
--   NULL          -> '-1:'
--   a text value  -> octet_length(value) || ':' || value
--
-- Length prefixing (rather than Helios's bare `'|'` join) is what makes the
-- payload UNAMBIGUOUS: `entity_name`, `error_message`, `actor_name` and the
-- jsonb columns are free text and can themselves contain '|', so a plain join
-- lets an attacker move bytes across a field boundary without changing the
-- hash. A chain over an ambiguous serialisation is not evidence.
--
-- The 22 fields, in order, with their serialisation:
--
--    1 id                     uuid::text
--    2 organization_id        uuid::text
--    3 actor_type             text as stored
--    4 user_id                uuid::text
--    5 provider_user_id       uuid::text
--    6 provider_id            uuid::text
--    7 actor_email            text as stored
--    8 actor_name             text as stored
--    9 actor_ip               text as stored (varchar(45), not inet)
--   10 action                 text as stored
--   11 action_category        text as stored
--   12 entity_type            text as stored
--   13 entity_id              uuid::text
--   14 entity_name            text as stored
--   15 old_values             jsonb::text  (Postgres canonicalises jsonb:
--                             keys sorted, whitespace normalised, duplicate
--                             keys dropped — so the text form is stable for a
--                             given value)
--   16 new_values             jsonb::text  (same)
--   17 changed_fields         text[]::text (array literal, e.g. '{a,b}';
--                             ORDER-SENSITIVE by design — reordering the list
--                             changes the hash)
--   18 success                boolean::text -> 'true' / 'false'
--   19 error_message          text as stored
--   20 created_at             to_char(created_at AT TIME ZONE 'UTC',
--                             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') — microsecond
--                             precision, timezone-independent
--   21 revoked_by_cascade_id  uuid::text
--   22 previous_hash          text as stored; NULL for the genesis row
--
-- NULL vs empty string are distinct: NULL serialises as '-1:' and '' as '0:'.
--
-- `hash_version` is stored on every row so this definition can be superseded
-- without invalidating existing evidence. Any future column MUST get a v2
-- payload function and a v2 branch in the verifier — extending v1 in place
-- would silently change the meaning of every historical hash. `hash_version`
-- and `chain_seq` are NOT inside the payload: they are the chain's own
-- framing, and a verifier that cannot trust the framing cannot run at all.
--
-- ===========================================================================
-- PRE-EXISTING ROWS: the chain STARTS HERE, and the boundary is recorded
-- ===========================================================================
-- Rows written before this migration were never protected. Computing hashes
-- over them now would produce a chain that LOOKS verified back to the first
-- install while in fact certifying nothing — manufactured evidence, which is
-- worse than no evidence. So:
--
--   * legacy rows get `hash_version = 0`, `record_hash IS NULL`,
--     `previous_hash IS NULL`, and a `chain_seq` assigned in
--     (created_at, id) order purely so ordering is total;
--   * a CHECK constraint makes "hash_version = 0" and "record_hash IS NULL"
--     mean each other, so a legacy row cannot be forged into a chained one
--     (and vice versa) by anything that gets past the triggers;
--   * `verify_audit_log_chain()` reports the legacy count separately and
--     verifies only from the first chained row;
--   * where an organisation already exists, this migration appends one
--     `audit.chain.initialised` row recording the boundary (how many legacy
--     rows, and the newest legacy timestamp). That row is the genesis of the
--     chain: `previous_hash IS NULL`.
--
-- ===========================================================================
-- WRITE THROUGHPUT
-- ===========================================================================
-- Appends to audit_log are now serialised: the BEFORE INSERT trigger takes
-- `pg_advisory_xact_lock(7741098)` before reading the chain head, and an
-- advisory XACT lock is held until COMMIT.
--
-- Measured on Postgres 16.15 in the dev `aegis-db` container (scratch
-- databases built from init.sql; same host, nothing else running against
-- them), comparing the same statements with and without this migration:
--
--     5 000 rows, one INSERT ... SELECT, no jsonb payload
--         without 098:  181 ms   (0.036 ms/row)
--         with 098:     714-958 ms (0.14-0.19 ms/row)
--     5 000 rows, one INSERT ... SELECT, ~200-byte jsonb new_values
--         without 098:  237 ms   (0.047 ms/row)
--         with 098:    1212-1537 ms (0.24-0.31 ms/row)
--     2 000 rows, plpgsql loop (one INSERT statement per row)
--         without 098:  118 ms   (0.059 ms/row)
--         with 098:     400-475 ms (0.20-0.24 ms/row)
--
-- So the chain costs roughly +0.15-0.25 ms per appended row (3-5x the bare
-- insert, which was very cheap). Consequences:
--
--   * Concurrent audit writes queue. Throughput becomes
--     1 / (time to read the head + hash + the rest of that transaction).
--     The head read is a single-row index scan on `chain_seq DESC` and sha256
--     over a payload of a few hundred bytes — the ~0.2 ms above; the real
--     serialising cost is however long the ENCLOSING transaction stays open
--     after the insert.
--   * Aegis is helped by accident here: `lib/audit.ts` (`logAudit`,
--     `logAuthEvent`) writes fire-and-forget through `pool.query` in its own
--     short autocommit transaction, so the lock is held for roughly the
--     insert. `lib/mtp-write.ts`, `app/api/settings/ai/config/route.ts` and
--     `lib/retention-purge.ts` do the same.
--   * The one place that writes audit rows inside a larger transaction is
--     `lib/cascade-revoke.ts`, which writes up to 3 audit rows per cascade
--     in one transaction (depth cap 1, one cascade at a time). It will hold
--     the lock for the cascade's duration — acceptable, and cascades are
--     rare and already serialised by their own 60-second undo window.
--   * NOTHING in Aegis currently writes audit rows in a tight loop.
--     `lib/retention-purge.ts` writes one audit row per BATCH (batch size,
--     not per purged row), so a large purge is tens of appends, not
--     thousands. A bulk ticket import or an email sync does not audit per
--     record today. If one ever does, the fix is to batch the audit write,
--     not to loosen the chain: a multi-row `INSERT ... SELECT` takes the lock
--     once for the whole statement, and the rows still chain to each other
--     in order (verified — each BEFORE ROW trigger sees the rows the same
--     statement already inserted).
--   * Gaps in `chain_seq` are expected and harmless: `nextval` is not
--     transactional, so a rolled-back append burns a number. Verification
--     follows the HASH LINKS, never seq contiguity — which is exactly why a
--     deleted row is still detected (its successor's `previous_hash` no
--     longer matches its new predecessor's `record_hash`).
--
-- ===========================================================================
-- WHAT THIS DOES NOT STOP
-- ===========================================================================
-- A PostgreSQL superuser can `ALTER TABLE audit_log DISABLE TRIGGER ...` or
-- set `session_replication_role = replica`, and table ACLs do not apply to
-- superusers at all. The default `docker-compose.yml` has the application
-- connect as `aegis`, which IS the container's superuser — so on a default
-- install the REVOKE below is documentation and the TRIGGERS are the control.
-- That is still a real improvement (a bug, an ORM call or a hand-run UPDATE
-- all fail loudly), and the hash chain means even a superuser's tampering is
-- DETECTABLE after the fact. To make the ACL bite as well, run the app as a
-- non-superuser role — see `docs/AUDIT_LOG_INTEGRITY.md`.
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / guarded DO blocks), because
-- docker-entrypoint.sh applies migrations once but a hand-run replay must be
-- safe.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. Columns + sequence. All backfill happens BEFORE the guard triggers exist.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS audit_log_chain_seq AS bigint START WITH 1;

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS chain_seq     bigint;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS hash_version  smallint;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS previous_hash varchar(64);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS record_hash   varchar(64);

COMMENT ON COLUMN audit_log.chain_seq IS
  'Total append order. Assigned under an advisory lock so it agrees with the hash links. Gaps are expected (rolled-back appends) and harmless.';
COMMENT ON COLUMN audit_log.hash_version IS
  '0 = written before migration 098, never hash-protected (record_hash IS NULL). 1 = canonical payload v1.';
COMMENT ON COLUMN audit_log.previous_hash IS
  'record_hash of the preceding chained row; NULL for the genesis row.';
COMMENT ON COLUMN audit_log.record_hash IS
  'sha256 hex of this row''s canonical payload (see audit_log_canonical_payload_v1), which includes previous_hash.';

-- Mark pre-existing rows as unchained and give them a total order.
--
-- This is the ONE sanctioned UPDATE on audit_log, and it can only run before
-- the immutability trigger exists. Guarded so a hand-run replay of this
-- migration skips it rather than being refused by the very trigger this file
-- installs — the error would be correct but baffling.
DO $$
DECLARE
  v_marked bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'audit_log'::regclass
       AND tgname = 'trg_audit_log_no_update'
       AND NOT tgisinternal
  ) THEN
    RAISE NOTICE 'audit_log: immutability trigger already present; skipping the legacy backfill (replay).';
    RETURN;
  END IF;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY created_at NULLS FIRST, id) AS rn
      FROM audit_log
     WHERE chain_seq IS NULL
  )
  UPDATE audit_log a
     SET chain_seq     = ordered.rn,
         hash_version  = 0,
         previous_hash = NULL,
         record_hash   = NULL
    FROM ordered
   WHERE a.id = ordered.id;

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RAISE NOTICE 'audit_log: marked % pre-existing row(s) as unchained (hash_version 0).', v_marked;
END $$;

-- Park the sequence past the backfilled block.
SELECT setval('audit_log_chain_seq', GREATEST((SELECT COALESCE(MAX(chain_seq), 0) FROM audit_log), 1), true);

-- No column DEFAULT on chain_seq on purpose: the BEFORE INSERT trigger assigns
-- it under the advisory lock, and a DEFAULT would burn a second sequence value
-- on every append for nothing.
ALTER TABLE audit_log ALTER COLUMN chain_seq    DROP DEFAULT;
ALTER TABLE audit_log ALTER COLUMN hash_version SET DEFAULT 1;
ALTER TABLE audit_log ALTER COLUMN chain_seq    SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN hash_version SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_chain_seq ON audit_log (chain_seq);

-- hash_version = 0 and "no hash" must mean each other, in both directions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'audit_log_hash_version_consistent'
       AND conrelid = 'audit_log'::regclass
  ) THEN
    ALTER TABLE audit_log ADD CONSTRAINT audit_log_hash_version_consistent CHECK (
      (hash_version = 0 AND record_hash IS NULL AND previous_hash IS NULL)
      OR (hash_version >= 1 AND record_hash IS NOT NULL)
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Canonical payload v1 + the record hash.
-- ---------------------------------------------------------------------------

-- Length-prefixed field encoder. '-1:' for NULL, 'N:value' otherwise.
CREATE OR REPLACE FUNCTION audit_log_hash_field(p_value text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
           WHEN p_value IS NULL THEN '-1:'
           ELSE octet_length(p_value)::text || ':' || p_value
         END;
$$;

COMMENT ON FUNCTION audit_log_hash_field(text) IS
  'Length-prefixed (netstring-style) encoding of one audit field, so free-text values cannot shift bytes across a field boundary. NULL is -1:, empty string is 0:.';

CREATE OR REPLACE FUNCTION audit_log_canonical_payload_v1(r audit_log)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT 'aegis.audit_log.v1|22|'
      || audit_log_hash_field(r.id::text)
      || audit_log_hash_field(r.organization_id::text)
      || audit_log_hash_field(r.actor_type)
      || audit_log_hash_field(r.user_id::text)
      || audit_log_hash_field(r.provider_user_id::text)
      || audit_log_hash_field(r.provider_id::text)
      || audit_log_hash_field(r.actor_email)
      || audit_log_hash_field(r.actor_name)
      || audit_log_hash_field(r.actor_ip)
      || audit_log_hash_field(r.action)
      || audit_log_hash_field(r.action_category)
      || audit_log_hash_field(r.entity_type)
      || audit_log_hash_field(r.entity_id::text)
      || audit_log_hash_field(r.entity_name)
      || audit_log_hash_field(r.old_values::text)
      || audit_log_hash_field(r.new_values::text)
      || audit_log_hash_field(r.changed_fields::text)
      || audit_log_hash_field(r.success::text)
      || audit_log_hash_field(r.error_message)
      || audit_log_hash_field(
           to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
      || audit_log_hash_field(r.revoked_by_cascade_id::text)
      || audit_log_hash_field(r.previous_hash);
$$;

COMMENT ON FUNCTION audit_log_canonical_payload_v1(audit_log) IS
  'Canonical, unambiguous serialisation of an audit_log row (22 length-prefixed fields incl. previous_hash). See the header of migration 098 for the field list. Never edit in place — add a v2.';

CREATE OR REPLACE FUNCTION audit_log_record_hash(r audit_log)
RETURNS varchar(64)
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF COALESCE(r.hash_version, 1) <> 1 THEN
    RAISE EXCEPTION 'audit_log: no canonical payload for hash_version % (row id=%)',
      r.hash_version, r.id
      USING ERRCODE = 'feature_not_supported';
  END IF;
  RETURN encode(sha256(audit_log_canonical_payload_v1(r)::bytea), 'hex');
END $$;

-- ---------------------------------------------------------------------------
-- 3. Append: fill the chain. BEFORE INSERT, serialised.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_log_chain_before_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_previous_hash varchar(64);
BEGIN
  -- Serialise appenders for the whole transaction. Without this, two
  -- concurrent inserts read the same chain head and fork the chain, which is
  -- indistinguishable from tampering at verification time. Key 7741098 is this
  -- migration's number; it is this table's lock and nothing else's.
  PERFORM pg_advisory_xact_lock(7741098);

  SELECT record_hash INTO v_previous_hash
    FROM audit_log
   WHERE hash_version >= 1
   ORDER BY chain_seq DESC
   LIMIT 1;

  -- The chain's framing is the database's to set, never the caller's.
  NEW.chain_seq     := nextval('audit_log_chain_seq');
  NEW.hash_version  := 1;
  NEW.previous_hash := v_previous_hash;
  NEW.record_hash   := audit_log_record_hash(NEW);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_log_chain ON audit_log;
CREATE TRIGGER trg_audit_log_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_chain_before_insert();

-- ---------------------------------------------------------------------------
-- 4. Immutability: UPDATE / DELETE / TRUNCATE all raise, loudly and by name.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_log_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'audit_log is append-only: DELETE rejected (id=%, chain_seq=%)', OLD.id, OLD.chain_seq
      USING ERRCODE = 'integrity_constraint_violation',
            DETAIL  = 'Audit history is immutable and hash-chained; removing this row would break the chain for every row after it.',
            HINT    = 'Nothing in Aegis may delete audit rows. Record the correction as a NEW audit event. Retention purges delete the audited entities, never the audit trail.';
  END IF;

  RAISE EXCEPTION
    'audit_log is append-only: UPDATE rejected (id=%, chain_seq=%)', OLD.id, OLD.chain_seq
    USING ERRCODE = 'integrity_constraint_violation',
          DETAIL  = 'Audit history is immutable and hash-chained; editing this row would invalidate its record_hash.',
          HINT    = 'Nothing in Aegis may edit audit rows. Record the correction as a NEW audit event.';
END $$;

CREATE OR REPLACE FUNCTION audit_log_reject_truncate()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: TRUNCATE rejected'
    USING ERRCODE = 'integrity_constraint_violation',
          DETAIL  = 'Audit history is immutable and hash-chained; TRUNCATE would destroy the whole chain at once.',
          HINT    = 'There is no supported way to clear the audit trail.';
END $$;

-- Two row triggers rather than one combined trigger: the name in the error
-- says which operation was refused, and a forensic exercise can disable one
-- without the other.
DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_reject_truncate();

COMMENT ON TABLE audit_log IS
  'APPEND-ONLY, hash-chained audit trail. UPDATE / DELETE / TRUNCATE are rejected by trigger and revoked at the table ACL. Verify with SELECT * FROM verify_audit_log_chain(). See migration 098 and docs/AUDIT_LOG_INTEGRITY.md.';

-- ---------------------------------------------------------------------------
-- 5. REVOKE as the second layer. A privileged role bypasses one of these two
--    controls, so both exist; neither is relied on alone.
-- ---------------------------------------------------------------------------

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM PUBLIC;

DO $$
DECLARE
  v_grantee text;
BEGIN
  -- Every role holding an explicit grant on audit_log, including the owner.
  FOR v_grantee IN
    SELECT DISTINCT pg_get_userbyid(a.grantee)
      FROM pg_class c, aclexplode(c.relacl) a
     WHERE c.oid = 'audit_log'::regclass
       AND a.grantee <> 0                       -- 0 is PUBLIC, handled above
       AND a.privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE')
  LOOP
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM %I', v_grantee);
    RAISE NOTICE 'audit_log: revoked UPDATE/DELETE/TRUNCATE from %', v_grantee;
  END LOOP;

  -- The owner's privileges are implicit when relacl IS NULL, so the loop above
  -- may not have seen them.
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM %I',
                 pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'audit_log'::regclass)));

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
    RAISE WARNING 'audit_log: % is a SUPERUSER, which bypasses table ACLs entirely. The immutability TRIGGERS are the enforcing control on this install; the hash chain keeps tampering detectable. Run Aegis as a non-superuser role to make the ACL bite too — see docs/AUDIT_LOG_INTEGRITY.md.', current_user;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Verification: walk the chain, report the FIRST break with its row id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_audit_log_chain(p_from_seq bigint DEFAULT NULL)
RETURNS TABLE (
  ok                     boolean,
  checked_rows           bigint,
  unchained_legacy_rows  bigint,
  chain_start_seq        bigint,
  chain_end_seq          bigint,
  first_break_id         uuid,
  first_break_seq        bigint,
  first_break_created_at timestamptz,
  first_break_reason     text
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  r              audit_log;
  v_expected     varchar(64);
  v_checked      bigint := 0;
  v_legacy       bigint;
  v_start        bigint;
  v_end          bigint;
  v_break_id     uuid;
  v_break_seq    bigint;
  v_break_at     timestamptz;
  v_break_reason text;
  v_recomputed   varchar(64);
BEGIN
  SELECT COUNT(*) INTO v_legacy FROM audit_log WHERE hash_version = 0;

  -- Where to start, and what previous_hash the first inspected row must carry.
  IF p_from_seq IS NULL THEN
    -- Whole chain: the first chained row is the genesis and must have no
    -- predecessor.
    v_expected := NULL;
  ELSE
    -- Partial verification from a known-good point: trust that row's own
    -- previous_hash as the seed. Content hashes are still checked.
    SELECT previous_hash INTO v_expected
      FROM audit_log
     WHERE hash_version >= 1 AND chain_seq >= p_from_seq
     ORDER BY chain_seq
     LIMIT 1;
  END IF;

  FOR r IN
    SELECT *
      FROM audit_log
     WHERE hash_version >= 1
       AND (p_from_seq IS NULL OR chain_seq >= p_from_seq)
     ORDER BY chain_seq
  LOOP
    IF v_start IS NULL THEN
      v_start := r.chain_seq;
    END IF;
    v_end     := r.chain_seq;
    v_checked := v_checked + 1;

    IF r.hash_version <> 1 THEN
      v_break_id     := r.id;
      v_break_seq    := r.chain_seq;
      v_break_at     := r.created_at;
      v_break_reason := format('unsupported_hash_version: row carries hash_version %s, this verifier knows v1', r.hash_version);
      EXIT;
    END IF;

    -- (a) The link. Catches a DELETED row: the successor still points at the
    --     hash of a row that is no longer in front of it.
    IF r.previous_hash IS DISTINCT FROM v_expected THEN
      v_break_id     := r.id;
      v_break_seq    := r.chain_seq;
      v_break_at     := r.created_at;
      v_break_reason := format(
        'chain_link_mismatch: row previous_hash=%s but predecessor record_hash=%s (a row before this one was removed or altered)',
        COALESCE(r.previous_hash, '<genesis>'), COALESCE(v_expected, '<genesis>'));
      EXIT;
    END IF;

    -- (b) The content. Catches an EDITED row.
    v_recomputed := audit_log_record_hash(r);
    IF v_recomputed <> r.record_hash THEN
      v_break_id     := r.id;
      v_break_seq    := r.chain_seq;
      v_break_at     := r.created_at;
      v_break_reason := format(
        'record_hash_mismatch: stored=%s recomputed=%s (this row''s contents were altered)',
        r.record_hash, v_recomputed);
      EXIT;
    END IF;

    v_expected := r.record_hash;
  END LOOP;

  RETURN QUERY SELECT
    v_break_reason IS NULL,
    v_checked,
    v_legacy,
    v_start,
    v_end,
    v_break_id,
    v_break_seq,
    v_break_at,
    v_break_reason;
END $$;

COMMENT ON FUNCTION verify_audit_log_chain(bigint) IS
  'Walks the audit_log hash chain in chain_seq order and returns the FIRST break with its row id, chain_seq, created_at and reason (chain_link_mismatch | record_hash_mismatch | unsupported_hash_version). Rows written before migration 098 (hash_version 0) are counted separately, never treated as verified. Pass p_from_seq to verify a suffix from a known-good point.';

-- ---------------------------------------------------------------------------
-- 7. Record the boundary between unchained history and the chain.
--    Only where an organisation exists (i.e. an upgrade, not a fresh install)
--    and only once.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_org_id     uuid;
  v_legacy     bigint;
  v_legacy_max timestamptz;
BEGIN
  SELECT COUNT(*), MAX(created_at) INTO v_legacy, v_legacy_max
    FROM audit_log WHERE hash_version = 0;

  IF v_legacy = 0 THEN
    RAISE NOTICE 'audit_log: no pre-existing rows; the chain starts with the first append.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM audit_log WHERE action = 'audit.chain.initialised') THEN
    RAISE NOTICE 'audit_log: chain boundary already recorded.';
    RETURN;
  END IF;

  SELECT id INTO v_org_id FROM organizations ORDER BY created_at NULLS LAST, id LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'audit_log: % unchained legacy row(s) but no organization yet; boundary not recorded (verify_audit_log_chain reports the count).', v_legacy;
    RETURN;
  END IF;

  INSERT INTO audit_log (
    organization_id, actor_type, action, action_category, entity_type, entity_name,
    new_values, success
  ) VALUES (
    v_org_id, 'system', 'audit.chain.initialised', 'settings', 'audit_log', 'audit_log',
    jsonb_build_object(
      'migration', '098_audit_log_append_only',
      'hash_version', 1,
      'canonical_payload', 'aegis.audit_log.v1',
      'unchained_legacy_rows', v_legacy,
      'newest_unchained_row_at', v_legacy_max,
      'note', 'Rows before this one were written without hash protection and are NOT covered by the chain.'
    ),
    true
  );

  RAISE NOTICE 'audit_log: chain genesis recorded; % legacy row(s) remain unchained.', v_legacy;
END $$;
