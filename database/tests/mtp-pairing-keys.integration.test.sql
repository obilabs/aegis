-- Integration test: the MTP pairing credential, as it exists after migration 092.
--
-- Run via: scripts/test-db.sh mtp-pairing-keys
--
-- Replaces `mtp-pairings.integration.test.sql`, which tested the `mtp_pairings`
-- table that migration 092 DROPS. That test had been failing on every fresh
-- database since 2026-06-09 and nobody saw it, because the CI database job
-- hand-listed three of the seven files in this directory and this was not one
-- of them. The coverage is ported rather than deleted: the pairing feature is
-- live (`lib/mtp-pairings.ts`, `/api/v1/mtp/*`, the api-keys settings page) —
-- only its storage moved, onto `api_keys` with `key_type='aegis-mtp-pairing'`.
--
-- What this pins, and why each one is here rather than in a vitest:
--
--   * The single-use binding predicate. CLAUDE.md states that the
--     `WHERE paired_at IS NULL AND pairing_window_expires_at > NOW()` predicate
--     inside the UPDATE is the race-prevention mechanism and MUST survive any
--     refactor. Only the database can show that the second claim of the same
--     key matches zero rows; a mocked query cannot.
--   * The depth-1 cascade cap, enforced by a trigger (`trg_api_keys_flat_cascade`)
--     because the CHECK-subquery form it was first written as does not work in
--     Postgres. A trigger that stops raising is indistinguishable from a trigger
--     that works, until someone issues a grandchild key.
--   * That `mtp_pairings` has not come back. CLAUDE.md forbids reintroducing it
--     as a separate table; T10 makes that rule fail a build instead of relying
--     on a reviewer remembering it.
--
-- Self-sufficient: creates its own organisation and user, and wrapped in
-- BEGIN/ROLLBACK, so it runs against a bare schema as well as a dev database.

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
DECLARE
  v_org_id     uuid;
  v_user_id    uuid;
  v_key_id     uuid;
  v_child_id   uuid;
  v_count      int;
  v_claimed    int;
  v_type       text;
  v_scopes     text[];
  v_action     char;
  v_caught     text;
  v_prefix     text := 'aegis_pairtest';
  v_hash       text := 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
BEGIN
  INSERT INTO organizations (name) VALUES ('mtp pairing keys test org')
    RETURNING id INTO v_org_id;

  INSERT INTO users (organization_id, email, first_name, last_name)
    VALUES (v_org_id, 'admin@pairing-test.example', 'Pat', 'Admin')
    RETURNING id INTO v_user_id;

  -- -------------------------------------------------------------------------
  -- T01: a pairing key is an api_keys row with the pairing type and an open
  -- window. Issuance opens 15 minutes (lib/mtp-pairings.ts).
  -- -------------------------------------------------------------------------
  INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, key_type,
                        scopes, created_by, pairing_window_expires_at)
    VALUES (v_org_id, 'Test MSP pairing', v_hash, v_prefix, 'aegis-mtp-pairing',
            ARRAY['tickets:read'], v_user_id, NOW() + interval '15 minutes')
    RETURNING id INTO v_key_id;
  ASSERT v_key_id IS NOT NULL, 'T01: insert returned no id';

  SELECT key_type, scopes INTO v_type, v_scopes FROM api_keys WHERE id = v_key_id;
  ASSERT v_type = 'aegis-mtp-pairing', format('T01: key_type is %s', v_type);
  ASSERT v_scopes = ARRAY['tickets:read']::text[], format('T01: scopes are %s', v_scopes);

  -- A fresh pairing key is unpaired and not revoked.
  SELECT COUNT(*) INTO v_count FROM api_keys
   WHERE id = v_key_id AND paired_at IS NULL AND is_revoked = false;
  ASSERT v_count = 1, 'T01: a new pairing key should be unpaired and unrevoked';

  -- -------------------------------------------------------------------------
  -- T02: the key_type CHECK rejects anything outside the five known types.
  -- A typo in a migration must not silently create a sixth kind of credential.
  -- -------------------------------------------------------------------------
  v_caught := 'no error';
  BEGIN
    INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, key_type)
      VALUES (v_org_id, 'bogus', 'deadbeef', 'aegis_bogus', 'mtp-pairing');
    v_caught := 'no error (BAD)';
  EXCEPTION WHEN check_violation THEN v_caught := 'check_violation';
  END;
  ASSERT v_caught = 'check_violation',
    format('T02: expected check_violation on an unknown key_type, got %s', v_caught);

  -- -------------------------------------------------------------------------
  -- T03: the handshake lookup. `/handshake` finds an unpaired pairing key by
  -- prefix — the exact shape of idx_api_keys_pairing_lookup.
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_count FROM api_keys
   WHERE key_prefix = v_prefix AND key_type = 'aegis-mtp-pairing' AND paired_at IS NULL;
  ASSERT v_count = 1, format('T03: expected 1 unpaired pairing key by prefix, got %s', v_count);

  -- -------------------------------------------------------------------------
  -- T04: THE LOAD-BEARING ONE. The single-use atomic claim.
  --
  -- completeHandshake() claims the key with one UPDATE carrying its own
  -- predicate. The first claim takes it; a second claim of the same key — the
  -- attacker who also has it — must match zero rows. If someone refactors that
  -- into SELECT-then-UPDATE, both claims find an unpaired row and both proceed.
  -- -------------------------------------------------------------------------
  UPDATE api_keys
     SET paired_at = NOW(), paired_from_ip = '203.0.113.7', paired_user_agent = 'aegis-mtp/1.0'
   WHERE id = v_key_id
     AND paired_at IS NULL
     AND pairing_window_expires_at > NOW();
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  ASSERT v_claimed = 1, format('T04: the first claim should take the key, matched %s rows', v_claimed);

  UPDATE api_keys
     SET paired_at = NOW(), paired_from_ip = '198.51.100.9', paired_user_agent = 'attacker/1.0'
   WHERE id = v_key_id
     AND paired_at IS NULL
     AND pairing_window_expires_at > NOW();
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  ASSERT v_claimed = 0,
    format('T04: a second claim of a paired key must match 0 rows, matched %s', v_claimed);

  -- The binding recorded the first caller, not the second.
  SELECT COUNT(*) INTO v_count FROM api_keys
   WHERE id = v_key_id AND paired_from_ip = '203.0.113.7';
  ASSERT v_count = 1, 'T04: the binding should still name the first caller';

  -- -------------------------------------------------------------------------
  -- T05: the window is the other gate. A key whose window has closed cannot be
  -- claimed at all, even though it is unpaired and unrevoked.
  -- -------------------------------------------------------------------------
  INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, key_type,
                        created_by, pairing_window_expires_at)
    VALUES (v_org_id, 'Expired window MSP',
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            'aegis_pairexp', 'aegis-mtp-pairing', v_user_id, NOW() - interval '1 minute');

  UPDATE api_keys
     SET paired_at = NOW()
   WHERE key_prefix = 'aegis_pairexp'
     AND paired_at IS NULL
     AND pairing_window_expires_at > NOW();
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  ASSERT v_claimed = 0,
    format('T05: a closed window must refuse the claim, matched %s rows', v_claimed);

  -- -------------------------------------------------------------------------
  -- T06: the handshake hot path has its partial index, with both halves of the
  -- predicate. Dropping the WHERE clause would still answer correctly and scan
  -- every key in the table.
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_count FROM pg_indexes
   WHERE tablename = 'api_keys'
     AND indexname = 'idx_api_keys_pairing_lookup'
     AND indexdef LIKE '%aegis-mtp-pairing%'
     AND indexdef LIKE '%paired_at IS NULL%';
  ASSERT v_count = 1, 'T06: idx_api_keys_pairing_lookup is missing or no longer partial';

  -- -------------------------------------------------------------------------
  -- T07: depth cap of 1. A pairing key may have children (the MSP's own techs);
  -- a child may not. This is the Okta transitive-lockout pattern, and the
  -- trigger is the only thing stopping it.
  -- -------------------------------------------------------------------------
  INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, key_type, parent_key_id)
    VALUES (v_org_id, 'MSP tech key',
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            'aegis_pairchild', 'personal', v_key_id)
    RETURNING id INTO v_child_id;
  ASSERT v_child_id IS NOT NULL, 'T07: a direct child of a pairing key should be allowed';

  v_caught := 'no error';
  BEGIN
    INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, key_type, parent_key_id)
      VALUES (v_org_id, 'MSP grandchild key',
              'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
              'aegis_pairgrand', 'personal', v_child_id);
    v_caught := 'no error (BAD)';
  EXCEPTION WHEN check_violation THEN v_caught := 'check_violation';
  END;
  ASSERT v_caught = 'check_violation',
    format('T07: a grandchild key must be refused by the depth cap, got %s', v_caught);

  -- -------------------------------------------------------------------------
  -- T08: revocation records all of what, when and why. The cascade reads these.
  -- -------------------------------------------------------------------------
  UPDATE api_keys
     SET is_revoked = true, revoked_at = NOW(), revoked_by = v_user_id,
         revoked_reason = 'test-revoke', is_active = false
   WHERE id = v_key_id;

  SELECT COUNT(*) INTO v_count FROM api_keys
   WHERE id = v_key_id AND is_revoked = true AND revoked_at IS NOT NULL
     AND revoked_by IS NOT NULL AND revoked_reason IS NOT NULL;
  ASSERT v_count = 1, 'T08: revocation did not set all four fields';

  -- A revoked key is excluded by the predicate every authenticating path uses.
  SELECT COUNT(*) INTO v_count FROM api_keys
   WHERE key_hash = v_hash AND is_revoked = false;
  ASSERT v_count = 0, 'T08: a revoked key still matches the active-key filter';

  -- -------------------------------------------------------------------------
  -- T09: scopes is an open text[] — Phase B adds more, and the vocabulary is
  -- owned by @obilabs/api-scopes rather than by a CHECK constraint here.
  -- -------------------------------------------------------------------------
  INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, key_type, scopes)
    VALUES (v_org_id, 'Wide-scope MSP',
            'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            'aegis_pairwide', 'aegis-mtp-pairing',
            ARRAY['tickets:read', 'tickets:write', 'assets:read']);

  SELECT scopes INTO v_scopes FROM api_keys WHERE key_prefix = 'aegis_pairwide';
  ASSERT array_length(v_scopes, 1) = 3, format('T09: expected 3 scopes, got %s', v_scopes);

  -- -------------------------------------------------------------------------
  -- T10: the old table has not come back, and the forensic snapshot 092 took
  -- is still there. CLAUDE.md forbids reintroducing `mtp_pairings`; this is
  -- that rule, enforced.
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'mtp_pairings';
  ASSERT v_count = 0,
    'T10: mtp_pairings exists again — migration 092 folded it into api_keys, do not revive it';

  SELECT COUNT(*) INTO v_count FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'mtp_pairings_legacy_backup';
  ASSERT v_count = 1, 'T10: the mtp_pairings_legacy_backup snapshot from 092 is gone';

  -- -------------------------------------------------------------------------
  -- T11: the FK to organizations is ON DELETE CASCADE — credentials belong to
  -- the organisation and must not outlive it. (Identity tables are RESTRICT;
  -- a bearer credential is not an identity.)
  -- -------------------------------------------------------------------------
  SELECT confdeltype INTO v_action FROM pg_constraint
   WHERE conrelid = 'api_keys'::regclass
     AND conname = 'api_keys_organization_id_fkey';
  ASSERT v_action = 'c',
    format('T11: api_keys → organizations should be ON DELETE CASCADE (c), got %s', v_action);

  RAISE NOTICE '✓ All MTP pairing-key integration tests passed (T01-T11)';
END $$;

ROLLBACK;
