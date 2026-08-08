-- Migration 092: Unify mtp_pairings into api_keys
--
-- Spec: openspec/changes/api-keys-mtp-unification/
--
-- Folds the bespoke MTP pairing flow (mtp_pair_* keys + mtp_pairings
-- table) into the typed-scoped API key system as a fourth type
-- `aegis-mtp-pairing`. After this migration:
--
--   * api_keys gains pairing_window_expires_at, paired_at,
--     paired_from_ip, paired_user_agent columns (nullable; only
--     populated for the aegis-mtp-pairing type).
--   * api_keys_key_type_chk widens to accept 'aegis-mtp-pairing'.
--   * Every row from mtp_pairings is copied into api_keys with
--     key_type='aegis-mtp-pairing', preserving the row id, hash,
--     prefix, scopes, and binding state verbatim.
--   * mtp_pairings_legacy_backup snapshots the original table.
--   * mtp_pairings is DROPPED. Going forward, all bearer-credential
--     state lives in api_keys.
--
-- Wire-format compatibility: existing mtp_pair_* keys still
-- authenticate. lib/api-auth.ts recognizes both 'aegis_*' and
-- 'mtp_pair_*' prefixes for one deprecation window; both look up the
-- same row in api_keys.
--
-- Atomic-claim contract preserved: the single-use binding
-- (WHERE paired_at IS NULL AND pairing_window_expires_at > NOW()
-- predicate inside the UPDATE) moves to a helper reading api_keys
-- in the application layer, not changed here.
--
-- Idempotent: re-running on a fully-migrated DB is a no-op
-- (NOT EXISTS guards on the data copy; IF NOT EXISTS guards on
-- DDL; IF EXISTS on the DROP TABLE).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Widen api_keys.key_type CHECK constraint
-- ---------------------------------------------------------------------------

ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_key_type_chk;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_key_type_chk
  CHECK (key_type IN (
    'personal',
    'mtp-polling',
    'delegated-write',
    'standard',
    'aegis-mtp-pairing'
  ));

-- ---------------------------------------------------------------------------
-- 2. Add pairing-specific columns
-- ---------------------------------------------------------------------------
-- All nullable. Only populated for rows with key_type='aegis-mtp-pairing'.
-- The application enforces the contract; the schema documents intent.

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS pairing_window_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS paired_at                 TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS paired_from_ip            TEXT NULL,
  ADD COLUMN IF NOT EXISTS paired_user_agent         TEXT NULL;

-- Partial index for the handshake hot path: look up an unpaired
-- pairing key by prefix within its window.
CREATE INDEX IF NOT EXISTS idx_api_keys_pairing_lookup
  ON api_keys (key_prefix)
  WHERE key_type = 'aegis-mtp-pairing' AND paired_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Snapshot mtp_pairings to a forward-only backup
-- ---------------------------------------------------------------------------
-- Same pattern as api_keys_legacy_permissions_backup in migration 091.
-- The migration is destructive (DROPs mtp_pairings); the backup makes
-- the destructive path recoverable from operator error.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtp_pairings') THEN
    CREATE TABLE IF NOT EXISTS mtp_pairings_legacy_backup (LIKE mtp_pairings INCLUDING ALL);
    INSERT INTO mtp_pairings_legacy_backup
      SELECT * FROM mtp_pairings
      WHERE NOT EXISTS (
        SELECT 1 FROM mtp_pairings_legacy_backup b WHERE b.id = mtp_pairings.id
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Copy mtp_pairings → api_keys (idempotent)
-- ---------------------------------------------------------------------------
-- Field mappings:
--   mtp_pairings.id                        → api_keys.id (UUID, preserved)
--   mtp_pairings.organization_id           → api_keys.organization_id
--   mtp_pairings.display_name              → api_keys.name
--   mtp_pairings.api_key_hash              → api_keys.key_hash
--   mtp_pairings.api_key_prefix            → api_keys.key_prefix
--     (NOTE: preserves the 'mtp_pair_*' label verbatim — that's
--      what lib/api-auth.ts dual-prefix recognition relies on)
--   mtp_pairings.scopes                    → api_keys.scopes (text[], 1:1)
--   mtp_pairings.created_by_user_id        → api_keys.created_by
--   mtp_pairings.created_at                → api_keys.created_at
--   mtp_pairings.pairing_window_expires_at → api_keys.pairing_window_expires_at
--   mtp_pairings.paired_at                 → api_keys.paired_at
--   mtp_pairings.paired_from_ip            → api_keys.paired_from_ip
--   mtp_pairings.paired_user_agent         → api_keys.paired_user_agent
--   mtp_pairings.last_used_at              → api_keys.last_used_at
--   mtp_pairings.status='revoked'          → api_keys.is_revoked=true, is_active=false
--   mtp_pairings.revoked_at                → api_keys.revoked_at
--   mtp_pairings.revocation_reason         → api_keys.revoked_reason
-- Constants set per type contract:
--   key_type = 'aegis-mtp-pairing'
--   key_owner_user_id = NULL (org-owned)
--   ai_context_level = 'technician' (MTP polls; technician context)
--   rate_limit = 500 (sensible default; MTP polling cadence)
--   permissions JSONB = scope array (kept in sync per legacy UI surface)
-- Idempotence: skip rows whose key_hash already exists in api_keys.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtp_pairings') THEN
    INSERT INTO api_keys (
      id, organization_id, name, key_hash, key_prefix,
      scopes, permissions,
      rate_limit, is_active, ai_context_level,
      created_by, created_at, last_used_at,
      key_type, key_owner_user_id,
      pairing_window_expires_at, paired_at, paired_from_ip, paired_user_agent,
      is_revoked, revoked_at, revoked_reason
    )
    SELECT
      p.id, p.organization_id, p.display_name, p.api_key_hash, p.api_key_prefix,
      p.scopes, to_jsonb(p.scopes),
      500, (p.status = 'active'), 'technician',
      p.created_by_user_id, p.created_at, p.last_used_at,
      'aegis-mtp-pairing', NULL,
      p.pairing_window_expires_at, p.paired_at, p.paired_from_ip, p.paired_user_agent,
      (p.status = 'revoked'), p.revoked_at, p.revocation_reason
    FROM mtp_pairings p
    WHERE NOT EXISTS (
      SELECT 1 FROM api_keys k WHERE k.key_hash = p.api_key_hash
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Drop mtp_pairings — data preserved in backup
-- ---------------------------------------------------------------------------
-- The application code that ships with this migration reads from
-- api_keys, not mtp_pairings. Keeping the old table around invites
-- code paths to forget the move; dropping it forces the discipline.
-- If recovery is ever needed, mtp_pairings_legacy_backup has every
-- pre-migration row.

DROP TABLE IF EXISTS mtp_pairings;

COMMIT;
