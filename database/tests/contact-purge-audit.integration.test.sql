-- Integration test: a manual contact purge is recorded, or it does not happen.
--
-- Run via: apps/aegis/scripts/test-db.sh contact-purge-audit
--
-- Covers the two manually triggered purge routes:
--   * app/api/portal/admin/contacts/[id]/purge/route.ts
--   * app/api/portal/admin/contacts/bulk/purge/route.ts
--
-- Same bug class as `lib/retention-purge.ts` (fixed in #55), reached by a human
-- clicking a button rather than by a 2am job. Both routes called
-- fire-and-forget `logAudit` — un-awaited, on the module pool, so always in a
-- transaction of its own, and swallowing its own failure into a console line —
-- and then hard-deleted the contact in a separate transaction. Two failures,
-- one in each direction, both reproduced below:
--
--   * T03: the audit write fails; the old code destroyed the contacts anyway
--     and answered 204 / `{purged: n}`.
--   * T04: the DELETE fails (which it really can — see below); the old code had
--     already committed a `contact_purged` row describing a purge that never
--     happened.
--
-- T03 is the load-bearing one and it is not mocked: a trigger RAISEs on the
-- real INSERT, which is what a NOT NULL violation, a broken hash chain or a
-- revoked privilege all look like from the caller.
--
-- Self-sufficient: creates its own organisation, and scopes chain verification
-- to the rows it wrote (p_from_seq) so it passes on a dev database that already
-- holds unchained legacy history. Wrapped in BEGIN/ROLLBACK.

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

-- ===========================================================================
-- T01: single-contact purge, happy path. The transaction deletes the contact
--      and appends ONE audit row describing it, and the chain still verifies.
--
--      The statements are the ones the route issues, in order, on one
--      connection inside one transaction: junction cleanup, contact DELETE,
--      audit INSERT.
-- ===========================================================================
DO $$
DECLARE
  v_org_id    uuid;
  v_actor     uuid;
  v_contact   uuid;
  v_tag_id    uuid;
  v_start_seq bigint;
  v_junction  int;
  v_deleted   int;
  v_audit_id  uuid;
  v_audit     audit_log;
  v_count     int;
  v_ok        boolean;
  v_reason    text;
BEGIN
  INSERT INTO organizations (name) VALUES ('contact purge audit test org')
    RETURNING id INTO v_org_id;

  INSERT INTO users (organization_id, email, first_name, last_name)
    VALUES (v_org_id, 'admin@purge-test.example', 'Pat', 'Admin')
    RETURNING id INTO v_actor;

  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, email, is_deleted, deleted_at)
    VALUES (v_org_id, 'employee', 'Ada', 'Lovelace', 'ada@purge-test.example', true, NOW() - interval '1 day')
    RETURNING id INTO v_contact;

  INSERT INTO tags (organization_id, name) VALUES (v_org_id, 'cp-test-tag')
    RETURNING id INTO v_tag_id;
  INSERT INTO contact_tags (contact_id, tag_id) VALUES (v_contact, v_tag_id);

  v_start_seq := COALESCE((SELECT MAX(chain_seq) FROM audit_log), 0) + 1;

  -- --- the purge transaction -------------------------------------------------
  DELETE FROM contact_tags WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_junction = ROW_COUNT;

  DELETE FROM contacts WHERE id = v_contact;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO audit_log (
    organization_id, actor_type, user_id, actor_name, actor_email, actor_ip,
    action, action_category, entity_type, entity_id, entity_name,
    old_values, new_values, changed_fields, success, error_message
  ) VALUES (
    v_org_id, 'user', v_actor, 'Admin', 'admin@purge-test.example', '203.0.113.7',
    'contact_purged', 'delete', 'contacts', v_contact, 'Ada Lovelace',
    NULL,
    jsonb_build_object(
      'email',         'ada@purge-test.example',
      'first_name',    'Ada',
      'last_name',     'Lovelace',
      'contact_type',  'employee',
      'junction_rows', v_junction
    ),
    NULL, true, NULL
  ) RETURNING id INTO v_audit_id;
  -- --- end of the purge transaction ------------------------------------------

  ASSERT v_deleted = 1, format('T01: expected 1 contact deleted, got %s', v_deleted);
  ASSERT v_junction = 1, format('T01: expected 1 junction row cleaned, got %s', v_junction);

  SELECT * INTO v_audit FROM audit_log WHERE id = v_audit_id;

  -- A human asked for this one, unlike the retention purge: actor_type 'user',
  -- and the actor is identified.
  ASSERT v_audit.actor_type = 'user',
    format('T01: actor_type should be user, got %s', v_audit.actor_type);
  ASSERT v_audit.user_id = v_actor, 'T01: audit row does not name the admin who asked';
  ASSERT v_audit.actor_ip = '203.0.113.7', 'T01: audit row lost the actor IP';
  ASSERT v_audit.action = 'contact_purged', 'T01: wrong action';
  ASSERT v_audit.action_category = 'delete', 'T01: wrong action_category';
  ASSERT v_audit.entity_type = 'contacts', 'T01: wrong entity_type';
  ASSERT v_audit.entity_id = v_contact, 'T01: audit row does not name the purged contact';
  ASSERT v_audit.success IS TRUE, 'T01: success should be true';

  -- The payload is in new_values, the column the rest of the codebase uses.
  ASSERT v_audit.new_values IS NOT NULL, 'T01: new_values is empty — the payload went nowhere';
  ASSERT v_audit.new_values->>'email' = 'ada@purge-test.example',
    'T01: payload lost the contact email';
  ASSERT (v_audit.new_values->>'junction_rows')::int = 1, 'T01: payload lost junction_rows';

  -- The row is chained, not legacy, and the caller set none of the framing.
  ASSERT v_audit.hash_version = 1,
    format('T01: audit row is not chained (hash_version %s)', v_audit.hash_version);
  ASSERT v_audit.record_hash IS NOT NULL, 'T01: audit row has no record_hash';
  ASSERT v_audit.chain_seq IS NOT NULL, 'T01: audit row has no chain_seq';

  SELECT ok, first_break_reason INTO v_ok, v_reason
    FROM verify_audit_log_chain(v_start_seq);
  ASSERT v_ok, format('T01: the purge broke the audit chain: %s', v_reason);

  SELECT COUNT(*) INTO v_count
    FROM audit_log
   WHERE organization_id = v_org_id AND action = 'contact_purged';
  ASSERT v_count = 1, format('T01: expected exactly 1 audit row, got %s', v_count);

  RAISE NOTICE 'T01 passed (single purge recorded: user actor, new_values payload, chain intact)';
END $$;

-- ===========================================================================
-- T02: bulk purge, happy path. One audit row PER contact (so the trail stays
--      queryable by entity_id), all inside the one transaction, chain intact.
-- ===========================================================================
DO $$
DECLARE
  v_org_id    uuid;
  v_actor     uuid;
  v_ids       uuid[];
  v_c         record;
  v_start_seq bigint;
  v_deleted   int;
  v_count     int;
  v_ok        boolean;
  v_reason    text;
BEGIN
  SELECT id INTO v_org_id FROM organizations
   WHERE name = 'contact purge audit test org' LIMIT 1;
  SELECT id INTO v_actor FROM users WHERE organization_id = v_org_id LIMIT 1;

  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, email, is_deleted, deleted_at)
  SELECT v_org_id, 'employee', 'Bulk', 'Number ' || g, 'bulk' || g || '@purge-test.example', true, NOW() - interval '2 days'
    FROM generate_series(1, 3) g;

  SELECT array_agg(id) INTO v_ids FROM contacts
   WHERE organization_id = v_org_id AND first_name = 'Bulk';

  v_start_seq := COALESCE((SELECT MAX(chain_seq) FROM audit_log), 0) + 1;

  -- --- the purge transaction -------------------------------------------------
  CREATE TEMP TABLE cp_batch ON COMMIT DROP AS
    SELECT id, first_name, last_name, email, contact_type
      FROM contacts WHERE id = ANY(v_ids);

  DELETE FROM contact_tags WHERE contact_id = ANY(v_ids);
  DELETE FROM contacts WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  FOR v_c IN SELECT * FROM cp_batch LOOP
    INSERT INTO audit_log (
      organization_id, actor_type, user_id, actor_name, actor_email, actor_ip,
      action, action_category, entity_type, entity_id, entity_name,
      old_values, new_values, changed_fields, success, error_message
    ) VALUES (
      v_org_id, 'user', v_actor, 'Admin', 'admin@purge-test.example', '203.0.113.7',
      'contact_purged', 'delete', 'contacts', v_c.id, v_c.first_name || ' ' || v_c.last_name,
      NULL,
      jsonb_build_object(
        'email',         v_c.email,
        'contact_type',  v_c.contact_type,
        'batch_size',    array_length(v_ids, 1),
        'batch_deleted', v_deleted
      ),
      NULL, true, NULL
    );
  END LOOP;
  -- --- end of the purge transaction ------------------------------------------

  ASSERT v_deleted = 3, format('T02: expected 3 contacts deleted, got %s', v_deleted);

  SELECT COUNT(*) INTO v_count FROM contacts WHERE id = ANY(v_ids);
  ASSERT v_count = 0, format('T02: %s contacts survived the bulk purge', v_count);

  -- One row per contact, each naming its own contact.
  SELECT COUNT(*) INTO v_count
    FROM audit_log WHERE action = 'contact_purged' AND entity_id = ANY(v_ids);
  ASSERT v_count = 3, format('T02: expected 3 audit rows (one per contact), got %s', v_count);

  SELECT COUNT(DISTINCT entity_id) INTO v_count
    FROM audit_log WHERE action = 'contact_purged' AND entity_id = ANY(v_ids);
  ASSERT v_count = 3, 'T02: the bulk rows do not name three distinct contacts';

  -- Every row in the batch chained, in one transaction, without forking.
  SELECT ok, first_break_reason INTO v_ok, v_reason
    FROM verify_audit_log_chain(v_start_seq);
  ASSERT v_ok, format('T02: the bulk purge broke the audit chain: %s', v_reason);

  DROP TABLE cp_batch;

  RAISE NOTICE 'T02 passed (bulk purge recorded: one chained row per contact)';
END $$;

-- ===========================================================================
-- T03: THE IMPORTANT ONE. Make the audit write really fail, and check the
--      contacts survive.
--
--      The failure is induced with a trigger that RAISEs on the actual INSERT
--      — the same thing the caller sees from a NOT NULL violation, a chain
--      error or a revoked privilege. No mock, no stubbed return value.
--
--      The purge statements run inside a plpgsql BEGIN/EXCEPTION block, which
--      is a savepoint — the same rollback boundary the route's BEGIN/ROLLBACK
--      gives it. So "did the DELETE survive the failed audit write" is a real
--      question here, and the answer must be no.
--
--      Before the fix this was the route's behaviour on this exact input:
--      contacts gone, zero audit rows, HTTP 204 (or `{purged: 2}`).
-- ===========================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_c1     uuid;
  v_c2     uuid;
  v_ids    uuid[];
  v_caught text;
  v_count  int;
  v_audits int;
BEGIN
  INSERT INTO organizations (name) VALUES ('contact purge abort test org')
    RETURNING id INTO v_org_id;

  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, is_deleted, deleted_at)
    VALUES (v_org_id, 'employee', 'Must', 'Survive', true, NOW() - interval '1 day')
    RETURNING id INTO v_c1;
  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, is_deleted, deleted_at)
    VALUES (v_org_id, 'employee', 'Also', 'Survive', true, NOW() - interval '1 day')
    RETURNING id INTO v_c2;

  v_ids := ARRAY[v_c1, v_c2];

  -- Break the audit write for contact purges only.
  EXECUTE $f$
    CREATE OR REPLACE FUNCTION cp_test_break_audit() RETURNS trigger
    LANGUAGE plpgsql AS $body$
    BEGIN
      IF NEW.action = 'contact_purged' THEN
        RAISE EXCEPTION 'simulated audit write failure'
          USING ERRCODE = 'io_error';
      END IF;
      RETURN NEW;
    END $body$;
  $f$;
  EXECUTE 'CREATE TRIGGER trg_zz_cp_test_break_audit BEFORE INSERT ON audit_log '
          'FOR EACH ROW EXECUTE FUNCTION cp_test_break_audit()';

  v_caught := 'no error';
  BEGIN
    DELETE FROM contact_tags WHERE contact_id = ANY(v_ids);
    DELETE FROM contacts WHERE id = ANY(v_ids);

    INSERT INTO audit_log (
      organization_id, actor_type, action, action_category,
      entity_type, entity_id, new_values, success
    ) VALUES (
      v_org_id, 'user', 'contact_purged', 'delete', 'contacts', v_c1,
      jsonb_build_object('email', 'must-survive@purge-test.example'), true
    );

    v_caught := 'PURGE COMMITTED WITHOUT ITS AUDIT ROW (BAD)';
  EXCEPTION WHEN others THEN
    -- The route's `catch { ROLLBACK; throw }`: the savepoint unwinds and the
    -- error is kept, not swallowed. The caller gets a 500 saying nothing was
    -- deleted — never a 204.
    v_caught := SQLERRM;
  END;

  EXECUTE 'DROP TRIGGER trg_zz_cp_test_break_audit ON audit_log';
  EXECUTE 'DROP FUNCTION cp_test_break_audit()';

  ASSERT v_caught = 'simulated audit write failure',
    format('T03: the failed audit write did not abort the purge. got: %s', v_caught);

  -- The point of the whole exercise.
  SELECT COUNT(*) INTO v_count FROM contacts WHERE id = ANY(v_ids);
  ASSERT v_count = 2,
    format('T03: %s of 2 contacts were destroyed by a purge that could not be recorded', 2 - v_count);

  -- And nothing was half-recorded either.
  SELECT COUNT(*) INTO v_audits FROM audit_log WHERE organization_id = v_org_id;
  ASSERT v_audits = 0,
    format('T03: expected no audit rows for the aborted purge, got %s', v_audits);

  RAISE NOTICE 'T03 passed (a contact purge whose audit write fails deletes nothing)';
END $$;

-- ===========================================================================
-- T04: the other direction, and it needs no simulation at all.
--
--      `access_requests.requester_id` / `for_contact_id` are NOT NULL and
--      their FK to `contacts` is ON DELETE SET NULL, and neither route cleans
--      that table up. So deleting a contact named on an access request is
--      REFUSED by Postgres today:
--
--        null value in column "for_contact_id" of relation "access_requests"
--        violates not-null constraint
--
--      The old routes had already committed the `contact_purged` row on
--      another connection before the DELETE ran, so the trail claimed a purge
--      that never happened and the caller got a 500. Writing the row inside
--      the transaction makes the two agree: no deletion, no row.
--
--      (The missing junction tables are a separate bug — this test pins the
--      audit behaviour, not the purge coverage.)
-- ===========================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_c      uuid;
  v_caught text;
  v_count  int;
  v_audits int;
BEGIN
  INSERT INTO organizations (name) VALUES ('contact purge rollback test org')
    RETURNING id INTO v_org_id;

  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, is_deleted, deleted_at)
    VALUES (v_org_id, 'employee', 'Blocked', 'ByRequest', true, NOW() - interval '1 day')
    RETURNING id INTO v_c;

  INSERT INTO access_requests (organization_id, requester_id, for_contact_id, requested_services)
    VALUES (v_org_id, v_c, v_c, '[]'::jsonb);

  v_caught := 'no error';
  BEGIN
    DELETE FROM contact_tags WHERE contact_id = v_c;
    DELETE FROM contacts WHERE id = v_c;

    INSERT INTO audit_log (
      organization_id, actor_type, action, action_category,
      entity_type, entity_id, new_values, success
    ) VALUES (
      v_org_id, 'user', 'contact_purged', 'delete', 'contacts', v_c,
      jsonb_build_object('email', 'blocked@purge-test.example'), true
    );

    v_caught := 'DELETE SUCCEEDED (schema changed — revisit this test)';
  EXCEPTION WHEN not_null_violation THEN
    v_caught := 'not_null_violation';
  END;

  ASSERT v_caught = 'not_null_violation',
    format('T04: expected not_null_violation from access_requests, got: %s', v_caught);

  SELECT COUNT(*) INTO v_count FROM contacts WHERE id = v_c;
  ASSERT v_count = 1, 'T04: the contact went after all';

  -- The row must not exist: nothing was purged.
  SELECT COUNT(*) INTO v_audits
    FROM audit_log WHERE organization_id = v_org_id AND action = 'contact_purged';
  ASSERT v_audits = 0,
    format('T04: %s audit row(s) claim a purge that the database refused', v_audits);

  RAISE NOTICE 'T04 passed (a refused delete leaves no audit row claiming otherwise)';
END $$;

-- ===========================================================================
-- T05: regression guard on the chain framing. The routes must not set
--      chain_seq / hash_version / previous_hash / record_hash themselves —
--      migration 099's trigger owns them. A caller-supplied record_hash is
--      overwritten, so a route that "helpfully" computes one is not quietly
--      trusted.
-- ===========================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_id     uuid;
  v_row    audit_log;
BEGIN
  SELECT id INTO v_org_id FROM organizations
   WHERE name = 'contact purge audit test org' LIMIT 1;

  INSERT INTO audit_log (
    organization_id, actor_type, action, action_category, entity_type,
    new_values, success, chain_seq, hash_version, previous_hash, record_hash
  ) VALUES (
    v_org_id, 'user', 'contact_purged', 'delete', 'contacts',
    '{"email":"forged@purge-test.example"}'::jsonb, true,
    -999, 7, repeat('0', 64), repeat('f', 64)
  ) RETURNING id INTO v_id;

  SELECT * INTO v_row FROM audit_log WHERE id = v_id;

  ASSERT v_row.chain_seq <> -999, 'T05: the caller set chain_seq and the database kept it';
  ASSERT v_row.hash_version = 1, format('T05: hash_version should be 1, got %s', v_row.hash_version);
  ASSERT v_row.record_hash <> repeat('f', 64), 'T05: the caller forged record_hash and it stuck';

  RAISE NOTICE 'T05 passed (the chain framing is the database''s, not the caller''s)';
END $$;

ROLLBACK;
