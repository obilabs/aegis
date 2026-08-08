-- Migration 091: API keys typed + scoped
--
-- Spec: openspec/changes/api-keys-typed-scoped/proposal.md
--
-- Fixes the silent-fail bug (verified 2026-06-05 against Mike's freshly-
-- created "Helpdesk Integration" key): /portal/settings/api-keys writes
-- legacy permission strings (ai_chat / kb_search / ticket_read /
-- ticket_create) into api_keys.permissions JSONB, but /api/v1/* enforces
-- scopes via lib/api-auth.ts reading api_keys.scopes text[]. The two
-- columns never connected — every UI-created key returned 403
-- insufficient_scope on every v1 call.
--
-- This migration:
--   1. Adds key_owner_user_id (NULL for org-owned admin-issued keys, set
--      for personal keys), migrated_at flag, and CHECK constraint on
--      key_type with the new value set (personal / mtp-polling /
--      delegated-write / standard for back-compat during rollout).
--   2. Extends api_key_usage_logs with acting_user_email and
--      action_ticket_ref columns (delegated-write per-call assertions).
--      Existing rows get NULL, which is correct (they predate the
--      assertion contract).
--   3. Adds organizations.migration_banner_dismissed_at for the
--      "verify your scopes" admin banner.
--   4. Creates api_keys_legacy_permissions_backup with one row per
--      existing api_keys row (forward-only safety net; nothing is
--      destroyed by the migration but the backup makes recovery from
--      operator error trivial).
--   5. Backfills key_type='personal' and key_owner_user_id=created_by on
--      every existing row (treating today's keys as user-owned).
--   6. Translates legacy permissions → canonical scopes (writing into the
--      already-present scopes column) using the fixed mapping:
--        ai_chat        → ai:chat
--        kb_search      → kb:read
--        ticket_read    → tickets:read
--        ticket_create  → tickets:write
--      Strings that are already canonical (resource:action shape) pass
--      through. Unknown strings are preserved but flagged in the audit
--      banner; the operator MUST verify before relying on them.
--   7. Sets migrated_at = NOW() on every translated row so the UI banner
--      knows which keys to surface.
--
-- Idempotent: re-running on a database where every api_keys row already
-- has migrated_at set is a no-op for the data-migration steps.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. api_keys: new columns + CHECK constraint
-- ---------------------------------------------------------------------------

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS key_owner_user_id UUID NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_owner
  ON api_keys(key_owner_user_id) WHERE key_owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_org_type
  ON api_keys(organization_id, key_type);

-- key_type CHECK: include 'standard' for back-compat (pre-existing rows
-- the operator hasn't reclassified yet) alongside the three canonical
-- types. The UI only offers the three new values; standard rows are
-- treated as personal in code but kept distinct so we don't pretend
-- they were created via the typed flow.
ALTER TABLE api_keys
  DROP CONSTRAINT IF EXISTS api_keys_key_type_chk;
ALTER TABLE api_keys
  ADD CONSTRAINT api_keys_key_type_chk
  CHECK (key_type IN ('personal','mtp-polling','delegated-write','standard'));

-- ---------------------------------------------------------------------------
-- 2. api_key_usage_logs: extend with delegated-write assertion columns
-- ---------------------------------------------------------------------------
-- Partitioned table; ALTER applies to all partitions transparently.

ALTER TABLE api_key_usage_logs
  ADD COLUMN IF NOT EXISTS acting_user_email VARCHAR(320) NULL,
  ADD COLUMN IF NOT EXISTS action_ticket_ref VARCHAR(60) NULL;

-- No index on these — they're write-only for audit forensics. If a
-- specific compliance report needs them indexed, add the index there.

-- ---------------------------------------------------------------------------
-- 3. organizations.migration_banner_dismissed_at
-- ---------------------------------------------------------------------------

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS migration_banner_dismissed_at TIMESTAMPTZ NULL;

-- ---------------------------------------------------------------------------
-- 4. api_keys_legacy_permissions_backup
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_keys_legacy_permissions_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  legacy_permissions JSONB NOT NULL,
  legacy_scopes TEXT[] NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_legacy_backup_key
  ON api_keys_legacy_permissions_backup(api_key_id);

-- Take a snapshot of every existing api_keys row's permissions + scopes
-- BEFORE we mutate them. Idempotent: the WHERE NOT EXISTS skips rows
-- already in the backup.
INSERT INTO api_keys_legacy_permissions_backup (
  api_key_id, organization_id, legacy_permissions, legacy_scopes
)
SELECT id, organization_id, COALESCE(permissions, '[]'::jsonb), COALESCE(scopes, '{}')
  FROM api_keys k
 WHERE NOT EXISTS (
   SELECT 1 FROM api_keys_legacy_permissions_backup b
    WHERE b.api_key_id = k.id
 );

-- ---------------------------------------------------------------------------
-- 5. Backfill key_type + key_owner_user_id for existing rows
-- ---------------------------------------------------------------------------
-- Treat today's keys as user-owned personal keys. Admin can re-classify
-- in the UI as part of the verification flow.
--
-- NOTE: created_by is uuid; key_owner_user_id is uuid REFERENCES users(id).
-- If created_by was set from session.user.id (which is text from Better
-- Auth user table) the FK won't match — leaves the column NULL for those
-- and the verification banner will prompt the admin to set ownership.

UPDATE api_keys k
   SET key_type = 'personal'
 WHERE k.key_type = 'standard'
   AND k.migrated_at IS NULL;

UPDATE api_keys k
   SET key_owner_user_id = u.id
  FROM users u
 WHERE k.created_by = u.id
   AND k.key_owner_user_id IS NULL
   AND k.migrated_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Translate legacy permissions → canonical scopes
-- ---------------------------------------------------------------------------
-- Apply the fixed mapping. We write into the existing `scopes` text[]
-- column (which is what lib/api-auth.ts already reads). We DO NOT delete
-- the legacy permissions JSONB — leaving it in place preserves the
-- original intent visibly in the row + the backup table.

UPDATE api_keys k
   SET scopes = ARRAY(
     SELECT DISTINCT translated FROM (
       SELECT
         CASE perm
           WHEN 'ai_chat'        THEN 'ai:chat'
           WHEN 'kb_search'      THEN 'kb:read'
           WHEN 'ticket_read'    THEN 'tickets:read'
           WHEN 'ticket_create'  THEN 'tickets:write'
           -- pass-through for already-canonical strings (matches the
           -- resource:action shape). Unknown strings end up here too;
           -- they'll be flagged in the UI banner for operator review.
           ELSE perm
         END AS translated
         FROM jsonb_array_elements_text(COALESCE(k.permissions, '[]'::jsonb)) AS perm
     ) sub
   )
 WHERE k.migrated_at IS NULL
   AND jsonb_typeof(COALESCE(k.permissions, '[]'::jsonb)) = 'array';

UPDATE api_keys
   SET migrated_at = NOW()
 WHERE migrated_at IS NULL;

-- ---------------------------------------------------------------------------
-- 7. Log a summary so the operator can see what happened
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  total INT;
  migrated INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE migrated_at IS NOT NULL)
    INTO total, migrated
    FROM api_keys;
  RAISE NOTICE 'Migration 091 complete: % of % api_keys rows now have migrated_at set', migrated, total;
END $$;

COMMIT;
