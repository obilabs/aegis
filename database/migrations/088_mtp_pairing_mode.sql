-- Migration 088: MTP pairing mode — single-use handshake + time-bounded window
--
-- Defense-in-depth against leaked pairing keys. Without this gate, a key
-- that escapes the customer's chain of custody (Slack, screenshots, backups,
-- password manager exports) is usable forever by an attacker. With it:
--
--   - Issuing a key opens a 15-minute pairing window (configurable per pair).
--     Outside the window, /api/v1/mtp/handshake refuses with 401.
--   - First successful handshake binds the key to that MTP install: paired_at
--     gets set atomically. All subsequent handshakes are refused.
--   - /api/v1/mtp/tickets keeps working forever for the bound MTP — pairing
--     mode only gates the ENROLLMENT event, not ongoing polling.
--
-- Self-healing: this migration also creates `mtp_pairings` if missing.
-- The original migration that introduced the table (the deleted
-- 087_mtp_handshake_api.sql) was folded into init.sql by the 2026-05-06
-- flatten (commit bbbaa41). Databases populated before that flatten only
-- ever ran init.sql + migrations 001-082; they never saw 087, so they're
-- missing the table. CREATE TABLE IF NOT EXISTS heals them. Fresh installs
-- since the flatten already have the table from init.sql, so the IF NOT
-- EXISTS guards make this a no-op for them.
--
-- For existing rows (any pairings created before pairing-mode was added),
-- backfill so they behave correctly:
--   - paired_at = COALESCE(last_used_at, created_at) — they've been used,
--     so consider them already paired (any further handshake attempt will
--     be refused — single-use binding kicks in retroactively).
--   - pairing_window_expires_at = created_at + interval '15 minutes' —
--     window closed long ago, can't be re-opened (would need a new key).
--
-- Idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Self-heal: create mtp_pairings if missing.
--    DDL kept in sync with apps/aegis/database/init.sql.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mtp_pairings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    display_name varchar(255) NOT NULL,
    api_key_hash varchar(255) NOT NULL,
    api_key_prefix varchar(20) NOT NULL,
    created_by_user_id uuid REFERENCES users(id),
    status varchar(20) NOT NULL DEFAULT 'active',
    scopes text[] NOT NULL DEFAULT ARRAY['tickets:read'::text],
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    revocation_reason text,
    CONSTRAINT mtp_pairings_status_chk
      CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_mtp_pairings_hash
  ON mtp_pairings (api_key_hash) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mtp_pairings_lookup
  ON mtp_pairings (api_key_prefix) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mtp_pairings_org
  ON mtp_pairings (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Add the pairing-mode columns (idempotent).
-- ---------------------------------------------------------------------------

ALTER TABLE mtp_pairings
  ADD COLUMN IF NOT EXISTS pairing_window_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paired_at timestamptz,
  ADD COLUMN IF NOT EXISTS paired_from_ip text,
  ADD COLUMN IF NOT EXISTS paired_user_agent text;

-- ---------------------------------------------------------------------------
-- 3. Backfill existing rows BEFORE adding NOT NULL + DEFAULT, to avoid
--    the default applying to old rows.
-- ---------------------------------------------------------------------------

UPDATE mtp_pairings
   SET paired_at = COALESCE(last_used_at, created_at),
       pairing_window_expires_at = created_at + interval '15 minutes'
 WHERE pairing_window_expires_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Lock in the default for future inserts.
-- ---------------------------------------------------------------------------

ALTER TABLE mtp_pairings
  ALTER COLUMN pairing_window_expires_at SET DEFAULT (now() + interval '15 minutes'),
  ALTER COLUMN pairing_window_expires_at SET NOT NULL;

COMMIT;
