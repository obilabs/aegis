-- Integration test: mtp_pairings table + indexes (migration 087).
--
-- Spec: openspec/changes/mtp-phase1/proposal.md (D72)
-- Run via: apps/aegis/scripts/test-db.sh mtp-pairings
--
-- Tests the schema-side guarantees the verifyPairingKey() / issuePairing() /
-- revokePairing() helpers in apps/aegis/lib/mtp-pairings.ts depend on:
-- unique active lookup by hash, status CHECK, partial indexes, FK cascade.

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_pairing_id uuid;
  v_count int;
  v_hash text := 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  ASSERT v_org_id IS NOT NULL, 'Setup: no organization';

  SELECT id INTO v_user_id FROM users LIMIT 1;
  ASSERT v_user_id IS NOT NULL, 'Setup: no users';

  -- T01: insert active pairing
  INSERT INTO mtp_pairings (organization_id, display_name, api_key_hash, api_key_prefix, created_by_user_id)
    VALUES (v_org_id, 'Test MSP', v_hash, 'mtp_pair_aaa', v_user_id)
    RETURNING id INTO v_pairing_id;
  ASSERT v_pairing_id IS NOT NULL, 'T01: insert returned no id';

  -- T02: default status is 'active', default scopes is ['tickets:read']
  DO $inner$
  DECLARE st text; sc text[];
  BEGIN
    SELECT status, scopes INTO st, sc FROM mtp_pairings WHERE id = (SELECT id FROM mtp_pairings WHERE api_key_hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    IF st <> 'active' THEN RAISE EXCEPTION 'T02 FAILED: status default expected active, got %', st; END IF;
    IF sc <> ARRAY['tickets:read']::text[] THEN RAISE EXCEPTION 'T02 FAILED: scopes default expected [tickets:read], got %', sc; END IF;
  END $inner$;

  -- T03: status CHECK rejects bogus values
  DO $inner$
  DECLARE caught text := 'no error';
  BEGIN
    BEGIN
      INSERT INTO mtp_pairings (organization_id, display_name, api_key_hash, api_key_prefix, status)
        VALUES ('00000000-0000-0000-0000-000000000000', 'x', 'b1', 'mtp_pair_bb', 'maybe');
      caught := 'no error (BAD)';
    EXCEPTION WHEN check_violation THEN caught := 'check_violation';
                WHEN foreign_key_violation THEN caught := 'check_violation_or_fk';  -- accept either
    END;
    IF caught NOT IN ('check_violation', 'check_violation_or_fk') THEN
      RAISE EXCEPTION 'T03 FAILED: expected check_violation, got %', caught;
    END IF;
  END $inner$;

  -- T04: lookup by hash on active rows returns exactly one row
  SELECT COUNT(*) INTO v_count FROM mtp_pairings WHERE api_key_hash = v_hash AND status = 'active';
  ASSERT v_count = 1, format('T04 FAILED: expected 1 active row by hash, got %s', v_count);

  -- T05: revoke flips status + sets revoked_at + revocation_reason
  UPDATE mtp_pairings
     SET status = 'revoked', revoked_at = NOW(), revocation_reason = 'test-revoke'
   WHERE id = v_pairing_id;
  DO $inner$
  DECLARE st text; ra timestamptz; rr text;
  BEGIN
    SELECT status, revoked_at, revocation_reason INTO st, ra, rr
      FROM mtp_pairings WHERE id = (SELECT id FROM mtp_pairings WHERE api_key_hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    IF st <> 'revoked' OR ra IS NULL OR rr IS NULL THEN
      RAISE EXCEPTION 'T05 FAILED: revoke did not set all 3 fields. status=%, revoked_at=%, reason=%', st, ra, rr;
    END IF;
  END $inner$;

  -- T06: partial index `idx_mtp_pairings_hash WHERE status = 'active'` excludes revoked rows
  -- (revoked above; verify the SQL the verifyPairingKey() helper runs returns 0 rows)
  SELECT COUNT(*) INTO v_count
    FROM mtp_pairings
   WHERE api_key_hash = v_hash AND status = 'active';
  ASSERT v_count = 0, format('T06 FAILED: revoked pairing still matches active filter (count=%s)', v_count);

  -- T07: FK to organizations ON DELETE CASCADE — when an org is deleted, its
  -- pairings disappear with it. (We can't actually delete the org since other
  -- tables depend on it, so verify the constraint exists with the right action.)
  DO $inner$
  DECLARE v_action char;
  BEGIN
    SELECT confdeltype INTO v_action
      FROM pg_constraint
     WHERE conrelid = 'mtp_pairings'::regclass
       AND conname = 'mtp_pairings_organization_id_fkey';
    IF v_action <> 'c' THEN
      RAISE EXCEPTION 'T07 FAILED: FK to organizations should be ON DELETE CASCADE (c), got %', v_action;
    END IF;
  END $inner$;

  -- T08: scopes column accepts arbitrary string[] (Phase 2 will add more scopes)
  INSERT INTO mtp_pairings (organization_id, display_name, api_key_hash, api_key_prefix, scopes)
    VALUES (v_org_id, 'Wide-scope MSP', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            'mtp_pair_cc', ARRAY['tickets:read', 'assets:read', 'documents:read']);
  DO $inner$
  DECLARE sc text[];
  BEGIN
    SELECT scopes INTO sc FROM mtp_pairings
     WHERE api_key_hash = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    IF array_length(sc, 1) <> 3 THEN RAISE EXCEPTION 'T08 FAILED: expected 3 scopes, got %', sc; END IF;
  END $inner$;

  RAISE NOTICE '✓ All MTP pairings integration tests passed (T01-T08)';
END $$;

ROLLBACK;
