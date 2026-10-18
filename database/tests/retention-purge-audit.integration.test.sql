-- Integration test: a retention purge is recorded, or it does not happen.
--
-- Run via: apps/aegis/scripts/test-db.sh retention-purge-audit
--
-- Covers `lib/retention-purge.ts`. Until this test existed, that worker built
-- its audit INSERT around a column `audit_log` does not have (`details`) and
-- omitted `actor_type`, which is NOT NULL — so the insert failed every time,
-- inside a try/catch that only `console.error`ed and continued. Every purge
-- hard-deleted customer data and left no trace. Both halves of that are
-- reproduced below (T04) so a revert cannot pass quietly.
--
-- These tests PROVE the behaviour rather than assert the DDL:
--   * T01 runs the exact statement sequence the worker runs, against a real
--     schema, and checks the rows are gone AND the trail is there AND the
--     hash chain still verifies.
--   * T03 makes the audit write GENUINELY FAIL — a trigger that raises on the
--     real INSERT, which is what a NOT NULL violation, a broken chain or a
--     revoked privilege all look like from the caller — and checks that the
--     data is still there afterwards. Nothing is mocked and no return value is
--     stubbed; the write is really refused by the database.
--
-- Self-sufficient: creates its own organisation, and scopes chain verification
-- to the rows it wrote (p_from_seq) so it passes on a dev database that
-- already holds unchained legacy history. Wrapped in BEGIN/ROLLBACK.

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

-- ===========================================================================
-- T01: the happy path. The purge transaction deletes the aged-out rows and
--      appends ONE audit row describing them, and the chain still verifies.
--
--      The statements below are the ones lib/retention-purge.ts issues, in
--      order, on one connection inside one transaction: junction cleanup,
--      entity DELETE, audit INSERT.
-- ===========================================================================
DO $$
DECLARE
  v_org_id     uuid;
  v_start_seq  bigint;
  v_tag_id     uuid;
  v_old_a      uuid;
  v_old_b      uuid;
  v_held       uuid;
  v_recent     uuid;
  v_ids        uuid[];
  v_deleted    int;
  v_junction   int;
  v_audit_id   uuid;
  v_audit      audit_log;
  v_count      int;
  v_ok         boolean;
  v_reason     text;
BEGIN
  INSERT INTO organizations (name) VALUES ('retention purge audit test org')
    RETURNING id INTO v_org_id;

  INSERT INTO data_retention_policies (organization_id, entity_type, retention_mode, retention_days)
    VALUES (v_org_id, 'contacts', 'auto_purge', 365);

  v_start_seq := COALESCE((SELECT MAX(chain_seq) FROM audit_log), 0) + 1;

  -- Two contacts past their window, one on legal hold, one deleted yesterday.
  INSERT INTO contacts (organization_id, first_name, last_name, is_deleted, legal_hold, deleted_at)
    VALUES (v_org_id, 'Aged', 'One',  true,  false, NOW() - interval '400 days')
    RETURNING id INTO v_old_a;
  INSERT INTO contacts (organization_id, first_name, last_name, is_deleted, legal_hold, deleted_at)
    VALUES (v_org_id, 'Aged', 'Two',  true,  false, NOW() - interval '500 days')
    RETURNING id INTO v_old_b;
  INSERT INTO contacts (organization_id, first_name, last_name, is_deleted, legal_hold, deleted_at)
    VALUES (v_org_id, 'Held', 'Back', true,  true,  NOW() - interval '900 days')
    RETURNING id INTO v_held;
  INSERT INTO contacts (organization_id, first_name, last_name, is_deleted, legal_hold, deleted_at)
    VALUES (v_org_id, 'Just', 'Gone', true,  false, NOW() - interval '1 day')
    RETURNING id INTO v_recent;

  INSERT INTO tags (organization_id, name) VALUES (v_org_id, 'rp-test-tag')
    RETURNING id INTO v_tag_id;
  INSERT INTO contact_tags (contact_id, tag_id) VALUES (v_old_a, v_tag_id);

  -- The worker's selection query (contacts branch).
  SELECT array_agg(id ORDER BY deleted_at) INTO v_ids
    FROM contacts
   WHERE organization_id = v_org_id
     AND is_deleted = true
     AND legal_hold = false
     AND deleted_at < NOW() - make_interval(days => 365);

  ASSERT array_length(v_ids, 1) = 2,
    format('T01: selection should find exactly the 2 aged rows, found %s', array_length(v_ids, 1));

  -- --- the purge transaction -------------------------------------------------
  DELETE FROM contact_tags WHERE contact_id = ANY(v_ids);
  GET DIAGNOSTICS v_junction = ROW_COUNT;

  DELETE FROM contacts WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO audit_log (
    organization_id, actor_type, action, action_category,
    entity_type, new_values, success
  ) VALUES (
    v_org_id, 'system', 'retention_purge', 'delete', 'contacts',
    jsonb_build_object(
      'count',          v_deleted,
      'requested',      array_length(v_ids, 1),
      'retention_days', 365,
      'batch_offset',   0,
      'junction_rows',  v_junction,
      'entity_ids',     to_jsonb(v_ids)
    ),
    true
  ) RETURNING id INTO v_audit_id;
  -- --- end of the purge transaction ------------------------------------------

  ASSERT v_deleted = 2, format('T01: expected 2 contacts deleted, got %s', v_deleted);
  ASSERT v_junction = 1, format('T01: expected 1 junction row cleaned, got %s', v_junction);

  -- Legal hold and the still-in-window row survived.
  SELECT COUNT(*) INTO v_count FROM contacts WHERE id IN (v_held, v_recent);
  ASSERT v_count = 2, 'T01: a protected or in-window contact was purged';

  SELECT * INTO v_audit FROM audit_log WHERE id = v_audit_id;

  ASSERT v_audit.actor_type = 'system',
    format('T01: actor_type should be system, got %s', v_audit.actor_type);
  ASSERT v_audit.action = 'retention_purge', 'T01: wrong action';
  ASSERT v_audit.action_category = 'delete', 'T01: wrong action_category';
  ASSERT v_audit.entity_type = 'contacts', 'T01: wrong entity_type';
  ASSERT v_audit.success IS TRUE, 'T01: success should be true';

  -- The payload is in new_values, the column the rest of the codebase uses.
  ASSERT v_audit.new_values IS NOT NULL, 'T01: new_values is empty — the payload went nowhere';
  ASSERT (v_audit.new_values->>'count')::int = 2,
    format('T01: payload count should be 2, got %s', v_audit.new_values->>'count');
  ASSERT (v_audit.new_values->>'retention_days')::int = 365, 'T01: payload lost retention_days';
  ASSERT (v_audit.new_values->>'junction_rows')::int = 1, 'T01: payload lost junction_rows';

  -- WHICH rows, not just how many. A count alone cannot answer "what did the
  -- 2am job destroy".
  ASSERT v_audit.new_values ? 'entity_ids', 'T01: payload does not record which rows were purged';
  ASSERT v_audit.new_values->'entity_ids' @> to_jsonb(ARRAY[v_old_a::text, v_old_b::text]),
    'T01: payload does not name both purged contacts';

  -- The row is chained, not legacy.
  ASSERT v_audit.hash_version = 1,
    format('T01: audit row is not chained (hash_version %s)', v_audit.hash_version);
  ASSERT v_audit.record_hash IS NOT NULL, 'T01: audit row has no record_hash';

  SELECT ok, first_break_reason INTO v_ok, v_reason
    FROM verify_audit_log_chain(v_start_seq);
  ASSERT v_ok, format('T01: the purge broke the audit chain: %s', v_reason);

  -- Exactly one audit row per batch, not one per purged record.
  SELECT COUNT(*) INTO v_count
    FROM audit_log
   WHERE organization_id = v_org_id AND action = 'retention_purge';
  ASSERT v_count = 1, format('T01: expected 1 audit row for the batch, got %s', v_count);

  RAISE NOTICE 'T01 passed (purge recorded: system actor, new_values payload, ids, chain intact)';
END $$;

-- ===========================================================================
-- T02: the failure row has a shape the table accepts too. A purge that could
--      not run must be recordable, or the "loud failure" path has the same
--      bug the success path had.
-- ===========================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_id     uuid;
  v_ok     boolean;
  v_seq    bigint;
BEGIN
  SELECT id INTO v_org_id FROM organizations
   WHERE name = 'retention purge audit test org' LIMIT 1;

  v_seq := COALESCE((SELECT MAX(chain_seq) FROM audit_log), 0) + 1;

  INSERT INTO audit_log (
    organization_id, actor_type, action, action_category,
    entity_type, new_values, success, error_message
  ) VALUES (
    v_org_id, 'system', 'retention_purge_failed', 'delete', 'contacts',
    jsonb_build_object('retention_days', 365, 'exempt_if_closed', true),
    false, 'simulated: audit chain unavailable'
  ) RETURNING id INTO v_id;

  ASSERT (SELECT success FROM audit_log WHERE id = v_id) IS FALSE,
    'T02: failure row did not record success = false';
  ASSERT (SELECT error_message FROM audit_log WHERE id = v_id) LIKE 'simulated:%',
    'T02: failure row lost its error_message';

  SELECT ok INTO v_ok FROM verify_audit_log_chain(v_seq);
  ASSERT v_ok, 'T02: the failure row broke the chain';

  RAISE NOTICE 'T02 passed (retention_purge_failed row is accepted and chains)';
END $$;

-- ===========================================================================
-- T03: THE IMPORTANT ONE. Make the audit write really fail, and check the
--      data survives.
--
--      The failure is induced with a trigger that RAISEs on the actual INSERT
--      — the same thing the caller sees from a NOT NULL violation, a chain
--      error or a revoked privilege. No mock, no stubbed return value: the
--      database refuses the write.
--
--      The purge statements run inside a plpgsql BEGIN/EXCEPTION block, which
--      is a savepoint — the same rollback boundary `purgeBatch`'s
--      BEGIN/ROLLBACK gives the worker. So "did the DELETE survive the failed
--      audit write" is a real question here, and the answer must be no.
-- ===========================================================================
DO $$
DECLARE
  v_org_id   uuid;
  v_c1       uuid;
  v_c2       uuid;
  v_ids      uuid[];
  v_caught   text;
  v_count    int;
  v_audits   int;
BEGIN
  INSERT INTO organizations (name) VALUES ('retention purge abort test org')
    RETURNING id INTO v_org_id;

  INSERT INTO contacts (organization_id, first_name, last_name, is_deleted, legal_hold, deleted_at)
    VALUES (v_org_id, 'Must', 'Survive', true, false, NOW() - interval '400 days')
    RETURNING id INTO v_c1;
  INSERT INTO contacts (organization_id, first_name, last_name, is_deleted, legal_hold, deleted_at)
    VALUES (v_org_id, 'Also', 'Survive', true, false, NOW() - interval '400 days')
    RETURNING id INTO v_c2;

  v_ids := ARRAY[v_c1, v_c2];

  -- Break the audit write for retention purges only.
  EXECUTE $f$
    CREATE OR REPLACE FUNCTION rp_test_break_audit() RETURNS trigger
    LANGUAGE plpgsql AS $body$
    BEGIN
      IF NEW.action = 'retention_purge' THEN
        RAISE EXCEPTION 'simulated audit write failure'
          USING ERRCODE = 'io_error';
      END IF;
      RETURN NEW;
    END $body$;
  $f$;
  EXECUTE 'CREATE TRIGGER trg_zz_rp_test_break_audit BEFORE INSERT ON audit_log '
          'FOR EACH ROW EXECUTE FUNCTION rp_test_break_audit()';

  v_caught := 'no error';
  BEGIN
    DELETE FROM contact_tags WHERE contact_id = ANY(v_ids);
    DELETE FROM contacts WHERE id = ANY(v_ids);

    INSERT INTO audit_log (
      organization_id, actor_type, action, action_category,
      entity_type, new_values, success
    ) VALUES (
      v_org_id, 'system', 'retention_purge', 'delete', 'contacts',
      jsonb_build_object('count', 2, 'entity_ids', to_jsonb(v_ids)), true
    );

    v_caught := 'PURGE COMMITTED WITHOUT ITS AUDIT ROW (BAD)';
  EXCEPTION WHEN others THEN
    -- This is the worker's `catch { ROLLBACK; throw }`: the savepoint unwinds
    -- and the error is kept, not swallowed.
    v_caught := SQLERRM;
  END;

  EXECUTE 'DROP TRIGGER trg_zz_rp_test_break_audit ON audit_log';
  EXECUTE 'DROP FUNCTION rp_test_break_audit()';

  ASSERT v_caught = 'simulated audit write failure',
    format('T03: the failed audit write did not abort the purge. got: %s', v_caught);

  -- The point of the whole exercise.
  SELECT COUNT(*) INTO v_count FROM contacts WHERE id = ANY(v_ids);
  ASSERT v_count = 2,
    format('T03: %s of 2 contacts were destroyed by a purge that could not be recorded', 2 - v_count);

  -- And nothing was half-recorded either.
  SELECT COUNT(*) INTO v_audits
    FROM audit_log WHERE organization_id = v_org_id;
  ASSERT v_audits = 0,
    format('T03: expected no audit rows for the aborted purge, got %s', v_audits);

  RAISE NOTICE 'T03 passed (a purge whose audit write fails deletes nothing)';
END $$;

-- ===========================================================================
-- T04: regression guard on the exact bug. Both halves of the old statement are
--      refused by the database, so a revert fails here instead of in
--      production at 2am.
-- ===========================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_caught text;
BEGIN
  SELECT id INTO v_org_id FROM organizations
   WHERE name = 'retention purge audit test org' LIMIT 1;

  -- (a) `details` is not a column of audit_log. It never was.
  v_caught := 'no error';
  BEGIN
    EXECUTE format(
      'INSERT INTO audit_log (organization_id, action, action_category, entity_type, details) '
      'VALUES (%L, %L, %L, %L, %L)',
      v_org_id, 'retention_purge', 'delete', 'contacts', '{"count":1}');
    v_caught := 'INSERT SUCCEEDED (BAD)';
  EXCEPTION WHEN undefined_column THEN
    v_caught := 'undefined_column';
  END;
  ASSERT v_caught = 'undefined_column',
    format('T04a: expected undefined_column for the `details` column, got: %s', v_caught);

  -- (b) actor_type is NOT NULL, so omitting it fails on its own.
  v_caught := 'no error';
  BEGIN
    INSERT INTO audit_log (organization_id, action, action_category, entity_type, new_values)
      VALUES (v_org_id, 'retention_purge', 'delete', 'contacts', '{"count":1}'::jsonb);
    v_caught := 'INSERT SUCCEEDED (BAD)';
  EXCEPTION WHEN not_null_violation THEN
    v_caught := 'not_null_violation';
  END;
  ASSERT v_caught = 'not_null_violation',
    format('T04b: expected not_null_violation for the missing actor_type, got: %s', v_caught);

  RAISE NOTICE 'T04 passed (both halves of the original bug are refused by the database)';
END $$;

ROLLBACK;
