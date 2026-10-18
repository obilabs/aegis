-- Integration test: audit_log is append-only and tamper-evident (migration 098).
--
-- Spec: openspec/changes/audit-log-append-only/proposal.md (D-058)
-- Run via: apps/aegis/scripts/test-db.sh audit-immutability
--
-- These tests PROVE the guarantees rather than assert that the DDL exists:
-- every case performs the forbidden operation and checks what the database
-- does about it. T07 and T08 tamper with the table using the ELEVATED role
-- (disabling the guard trigger, which only the owner/superuser can do),
-- because a test that only tries what the application role can do would prove
-- nothing about detection.
--
-- Self-sufficient: creates its own organisation, and scopes verification to
-- the rows it wrote (p_from_seq) so it passes on a dev database that already
-- holds unchained legacy history.

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
DECLARE
  v_org_id      uuid;
  v_start_seq   bigint;
  v_id1         uuid;
  v_id2         uuid;
  v_id3         uuid;
  v_seq1        bigint;
  v_seq2        bigint;
  v_seq3        bigint;
  v_hash1       varchar(64);
  v_hash2       varchar(64);
  v_prev2       varchar(64);
  v_hv          smallint;
  v_caught      text;
  v_ok          boolean;
  v_break_id    uuid;
  v_reason      text;
  v_checked     bigint;
  v_legacy      bigint;
  v_count       int;
BEGIN
  INSERT INTO organizations (name) VALUES ('D-058 audit chain test org')
    RETURNING id INTO v_org_id;
  ASSERT v_org_id IS NOT NULL, 'Setup: could not create organisation';

  v_start_seq := COALESCE((SELECT MAX(chain_seq) FROM audit_log), 0) + 1;

  -- =========================================================================
  -- T01: an ordinary append still works, and the database fills the chain
  --      framing itself.
  -- =========================================================================
  INSERT INTO audit_log (organization_id, actor_type, action, action_category, entity_type, entity_name)
    VALUES (v_org_id, 'user', 'test.append.one', 'create', 'ticket', 'T-1')
    RETURNING id, chain_seq, hash_version, record_hash INTO v_id1, v_seq1, v_hv, v_hash1;

  ASSERT v_id1 IS NOT NULL,                'T01: insert returned no id';
  ASSERT v_seq1 IS NOT NULL,               'T01: chain_seq was not assigned';
  ASSERT v_hv = 1,                         format('T01: expected hash_version 1, got %s', v_hv);
  ASSERT v_hash1 IS NOT NULL,              'T01: record_hash was not computed';
  ASSERT length(v_hash1) = 64,             format('T01: record_hash is not 64 hex chars: %s', v_hash1);

  -- =========================================================================
  -- T02: a second append links to the first, and the verifier walks it clean.
  -- =========================================================================
  INSERT INTO audit_log (organization_id, actor_type, action, action_category, entity_type)
    VALUES (v_org_id, 'user', 'test.append.two', 'update', 'ticket')
    RETURNING id, chain_seq, previous_hash, record_hash INTO v_id2, v_seq2, v_prev2, v_hash2;

  ASSERT v_prev2 = v_hash1,
    format('T02: previous_hash should be the first row''s record_hash. got=%s want=%s', v_prev2, v_hash1);
  ASSERT v_seq2 > v_seq1, 'T02: chain_seq did not advance';

  INSERT INTO audit_log (organization_id, actor_type, action, action_category, entity_type)
    VALUES (v_org_id, 'system', 'test.append.three', 'settings', 'audit_log')
    RETURNING id, chain_seq INTO v_id3, v_seq3;

  SELECT ok, checked_rows, first_break_reason
    INTO v_ok, v_checked, v_reason
    FROM verify_audit_log_chain(v_start_seq);
  ASSERT v_ok, format('T02: verifier reported a break on a clean chain: %s', v_reason);
  ASSERT v_checked = 3, format('T02: expected 3 rows checked, got %s', v_checked);

  -- =========================================================================
  -- T03: UPDATE is refused, by the database, with a clear error.
  -- =========================================================================
  v_caught := 'no error';
  BEGIN
    UPDATE audit_log SET action = 'test.tampered' WHERE id = v_id1;
    v_caught := 'UPDATE SUCCEEDED (BAD)';
  EXCEPTION WHEN integrity_constraint_violation THEN
    v_caught := SQLERRM;
  END;
  ASSERT v_caught LIKE '%append-only%' AND v_caught LIKE '%UPDATE rejected%',
    format('T03: expected an append-only UPDATE refusal, got: %s', v_caught);

  -- The row is untouched, and the refusal was not a silent no-op.
  SELECT COUNT(*) INTO v_count FROM audit_log WHERE id = v_id1 AND action = 'test.append.one';
  ASSERT v_count = 1, 'T03: the row changed despite the refusal';

  -- =========================================================================
  -- T04: DELETE is refused.
  -- =========================================================================
  v_caught := 'no error';
  BEGIN
    DELETE FROM audit_log WHERE id = v_id2;
    v_caught := 'DELETE SUCCEEDED (BAD)';
  EXCEPTION WHEN integrity_constraint_violation THEN
    v_caught := SQLERRM;
  END;
  ASSERT v_caught LIKE '%append-only%' AND v_caught LIKE '%DELETE rejected%',
    format('T04: expected an append-only DELETE refusal, got: %s', v_caught);

  SELECT COUNT(*) INTO v_count FROM audit_log WHERE id = v_id2;
  ASSERT v_count = 1, 'T04: the row was deleted despite the refusal';

  -- =========================================================================
  -- T05: TRUNCATE is refused (the one statement that would erase the whole
  --      chain at once). CASCADE form, because a plain TRUNCATE is already
  --      refused earlier for an unrelated reason: audit_log is referenced by
  --      a foreign key (its own revoked_by_cascade_id, and
  --      cascade_revocation_queue), and Postgres checks that BEFORE firing
  --      TRUNCATE triggers. CASCADE removes that objection and reaches the
  --      guard, which is the control under test.
  -- =========================================================================
  v_caught := 'no error';
  BEGIN
    EXECUTE 'TRUNCATE TABLE audit_log CASCADE';
    v_caught := 'TRUNCATE SUCCEEDED (BAD)';
  EXCEPTION WHEN integrity_constraint_violation THEN
    v_caught := SQLERRM;
  END;
  ASSERT v_caught LIKE '%TRUNCATE rejected%',
    format('T05: expected an append-only TRUNCATE refusal, got: %s', v_caught);

  -- =========================================================================
  -- T06: the second layer — no role holds UPDATE/DELETE/TRUNCATE in the table
  --      ACL. (A superuser bypasses ACLs, which is why T03-T05 exist too.)
  -- =========================================================================
  SELECT COUNT(*) INTO v_count
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE c.oid = 'audit_log'::regclass
     AND a.privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');
  ASSERT v_count = 0,
    format('T06: %s UPDATE/DELETE/TRUNCATE grant(s) still present on audit_log', v_count);

  -- =========================================================================
  -- T07: ELEVATED-ROLE TAMPER. Disable the guard trigger (owner-only), edit a
  --      row, and prove the verifier names that row.
  -- =========================================================================
  EXECUTE 'ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_update';
  UPDATE audit_log SET entity_name = 'quietly-rewritten' WHERE id = v_id1;
  EXECUTE 'ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_update';

  SELECT ok, first_break_id, first_break_reason
    INTO v_ok, v_break_id, v_reason
    FROM verify_audit_log_chain(v_start_seq);
  ASSERT NOT v_ok, 'T07: verifier did not notice an edited row';
  ASSERT v_break_id = v_id1,
    format('T07: verifier blamed the wrong row. got=%s want=%s', v_break_id, v_id1);
  ASSERT v_reason LIKE 'record_hash_mismatch%',
    format('T07: expected record_hash_mismatch, got: %s', v_reason);

  -- Put it back so T08 starts from a clean chain.
  EXECUTE 'ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_update';
  UPDATE audit_log SET entity_name = 'T-1' WHERE id = v_id1;
  EXECUTE 'ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_update';
  SELECT ok INTO v_ok FROM verify_audit_log_chain(v_start_seq);
  ASSERT v_ok, 'T07: restoring the original value did not restore the chain';

  -- =========================================================================
  -- T08: ELEVATED-ROLE DELETE. A removed row is still detected, because its
  --      successor points at a hash that is no longer in front of it.
  -- =========================================================================
  EXECUTE 'ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_delete';
  DELETE FROM audit_log WHERE id = v_id2;
  EXECUTE 'ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_delete';

  SELECT COUNT(*) INTO v_count FROM audit_log WHERE id = v_id2;
  ASSERT v_count = 0, 'T08: setup failed, the row was not actually removed';

  SELECT ok, first_break_id, first_break_reason
    INTO v_ok, v_break_id, v_reason
    FROM verify_audit_log_chain(v_start_seq);
  ASSERT NOT v_ok, 'T08: verifier did not notice a deleted row';
  ASSERT v_break_id = v_id3,
    format('T08: break should be reported at the successor row. got=%s want=%s', v_break_id, v_id3);
  ASSERT v_reason LIKE 'chain_link_mismatch%',
    format('T08: expected chain_link_mismatch, got: %s', v_reason);

  RAISE NOTICE 'T01-T08 passed (append, chain, UPDATE/DELETE/TRUNCATE refused, ACL, tamper + delete detected)';
END $$;

-- ===========================================================================
-- T09: the canonical payload is UNAMBIGUOUS. Two rows whose free-text fields
--      differ only in where a '|' sits must hash differently — this is the
--      case a bare pipe-joined payload (Helios 066) cannot distinguish.
-- ===========================================================================
DO $$
DECLARE
  v_a text;
  v_b text;
BEGIN
  v_a := audit_log_hash_field('a|b') || audit_log_hash_field('c');
  v_b := audit_log_hash_field('a') || audit_log_hash_field('b|c');
  ASSERT v_a <> v_b,
    format('T09: field encoding is ambiguous: %s == %s', v_a, v_b);

  -- NULL and the empty string are distinct inputs and must stay distinct.
  ASSERT audit_log_hash_field(NULL) = '-1:', 'T09: NULL encoding changed';
  ASSERT audit_log_hash_field('')   = '0:',  'T09: empty-string encoding changed';

  RAISE NOTICE 'T09 passed (length-prefixed payload is unambiguous)';
END $$;

-- ===========================================================================
-- T10: a legacy (pre-098) row cannot be forged into a chained one, and a
--      chained row cannot be demoted to legacy, even with the guard triggers
--      out of the way — the CHECK constraint ties hash_version to the hashes.
-- ===========================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_caught text;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at NULLS LAST, id LIMIT 1;

  v_caught := 'no error';
  BEGIN
    -- The INSERT trigger forces hash_version = 1, so reach past it the same
    -- way an attacker with elevated rights would.
    EXECUTE 'ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_chain';
    BEGIN
      INSERT INTO audit_log (organization_id, actor_type, action, chain_seq, hash_version, record_hash)
        VALUES (v_org_id, 'system', 'test.forged.legacy',
                nextval('audit_log_chain_seq'), 0, repeat('a', 64));
      v_caught := 'INSERT SUCCEEDED (BAD)';
    EXCEPTION WHEN check_violation THEN
      v_caught := 'check_violation';
    END;
    EXECUTE 'ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_chain';
  END;

  ASSERT v_caught = 'check_violation',
    format('T10: expected check_violation for hash_version 0 with a hash, got: %s', v_caught);

  RAISE NOTICE 'T10 passed (hash_version/record_hash consistency enforced)';
END $$;

-- ===========================================================================
-- T11: the hash really does cover every column it claims to. For each of the
--      22 fields in canonical payload v1, change ONLY that field and check the
--      recomputed hash changes. Documentation that says "all columns" is a
--      claim; this is the check.
--
--      Done by round-tripping the row through jsonb rather than by UPDATEing
--      the table, so no guard trigger has to be disabled.
-- ===========================================================================
DO $$
DECLARE
  v_org    uuid;
  v_id     uuid;
  v_base   varchar(64);
  v_new    varchar(64);
  v_field  text;
  v_value  jsonb;
  v_uncovered text := '';
  -- field -> a different value of the right type
  v_mutations jsonb;
BEGIN
  INSERT INTO organizations (name) VALUES ('D-058 hash coverage test org')
    RETURNING id INTO v_org;

  INSERT INTO audit_log (
    organization_id, actor_type, user_id, provider_user_id, provider_id,
    actor_email, actor_name, actor_ip, action, action_category,
    entity_type, entity_id, entity_name, old_values, new_values,
    changed_fields, success, error_message
  ) VALUES (
    v_org, 'user', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    'a@b.c', 'Someone', '10.0.0.1', 'test.coverage.base', 'update',
    'ticket', gen_random_uuid(), 'T-cov', '{"o":1}'::jsonb, '{"n":1}'::jsonb,
    ARRAY['a','b'], true, 'none'
  ) RETURNING id INTO v_id;

  SELECT record_hash INTO v_base FROM audit_log WHERE id = v_id;

  v_mutations := jsonb_build_object(
    'id',                    to_jsonb(gen_random_uuid()),
    'organization_id',       to_jsonb(gen_random_uuid()),
    'actor_type',            to_jsonb('service'::text),
    'user_id',               to_jsonb(gen_random_uuid()),
    'provider_user_id',      to_jsonb(gen_random_uuid()),
    'provider_id',           to_jsonb(gen_random_uuid()),
    'actor_email',           to_jsonb('x@y.z'::text),
    'actor_name',            to_jsonb('Someone Else'::text),
    'actor_ip',              to_jsonb('10.0.0.9'::text),
    'action',                to_jsonb('test.coverage.other'::text),
    'action_category',       to_jsonb('view'::text),
    'entity_type',           to_jsonb('asset'::text),
    'entity_id',             to_jsonb(gen_random_uuid()),
    'entity_name',           to_jsonb('renamed'::text),
    'old_values',            '{"o":2}'::jsonb,
    'new_values',            '{"n":2}'::jsonb,
    'changed_fields',        '["z"]'::jsonb,
    'success',               to_jsonb(false),
    'error_message',         to_jsonb('boom'::text),
    'created_at',            to_jsonb((SELECT created_at + interval '1 microsecond' FROM audit_log WHERE id = v_id)),
    'revoked_by_cascade_id', to_jsonb(v_id),
    'previous_hash',         to_jsonb(repeat('f', 64))
  );

  FOR v_field, v_value IN SELECT * FROM jsonb_each(v_mutations) LOOP
    SELECT audit_log_record_hash(
             jsonb_populate_record(a, to_jsonb(a) || jsonb_build_object(v_field, v_value)))
      INTO v_new
      FROM audit_log a
     WHERE a.id = v_id;

    IF v_new = v_base THEN
      v_uncovered := v_uncovered || ' ' || v_field;
    END IF;
  END LOOP;

  ASSERT v_uncovered = '',
    format('T11: these columns are NOT covered by the hash:%s', v_uncovered);

  ASSERT (SELECT COUNT(*) FROM jsonb_object_keys(v_mutations)) = 22,
    'T11: the mutation set must cover all 22 fields of canonical payload v1';

  RAISE NOTICE 'T11 passed (all 22 payload v1 fields change the hash)';
END $$;

ROLLBACK;
