-- Migration 090: Email provider settings + send audit
--
-- Spec: openspec/changes/email-first-class/proposal.md (D3, D4)
-- Tasks: openspec/changes/email-first-class/tasks.md (Section 4)
--
-- Adds two tables that together back the new Settings → Email surface:
--   email_settings — one row per organization, holds the provider choice +
--                    encrypted provider credentials + last-test/last-send
--                    status. Encryption uses AEGIS_SECRETS_KEY via the
--                    @aegis/email package's envelope helper.
--   email_attempts — append-only audit log, one row per send attempt
--                    (success or failure), retained for visibility into
--                    delivery issues.
--
-- Legacy migration: detects SMTP_HOST/PORT/USER/PASS/FROM env vars from
-- the pre-spec configuration path and seeds a `smtp`-provider row if
-- email_settings is empty AND the values are present. Logs a deprecation
-- notice; the env vars remain readable for a 30-day grace window before
-- the consuming code is updated to ignore them.
--
-- NOTE: We deliberately do NOT extend data_retention_policies for
-- email_attempts here — that table's CHECK constraint covers user-content
-- entities (contacts/tickets/assets/credentials/kb_articles/documents),
-- not infrastructure audit. A simple periodic cleanup cron will handle
-- the 90-day window for email_attempts; that cron lands in a follow-up.
--
-- Idempotent. Re-running is a no-op (IF NOT EXISTS + ON CONFLICT).

BEGIN;

-- ---------------------------------------------------------------------------
-- Legacy table handling
-- ---------------------------------------------------------------------------
-- A pre-existing `email_settings` table from an earlier SMTP-only design
-- (columns: smtp_host, smtp_port, smtp_user, smtp_password_encrypted,
-- smtp_from_email, smtp_from_name, smtp_secure, is_enabled) exists on
-- some installs. It uses the same table name as this migration's new
-- schema but is otherwise unrelated.
--
-- If it exists AND is empty, drop it. If it has data, raise an
-- exception so the operator can inspect + migrate manually — silently
-- dropping data would be unacceptable.
DO $$
DECLARE
  legacy_exists BOOLEAN;
  row_count BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'email_settings'
       AND column_name = 'smtp_host'
  ) INTO legacy_exists;

  IF legacy_exists THEN
    EXECUTE 'SELECT COUNT(*) FROM email_settings' INTO row_count;
    IF row_count = 0 THEN
      RAISE NOTICE 'Dropping legacy empty email_settings table (SMTP-only schema, superseded by provider-abstraction design).';
      DROP TABLE email_settings;
    ELSE
      RAISE EXCEPTION 'Legacy email_settings table has % rows. Manual migration required — back up SMTP config to docs, then DROP TABLE email_settings; and re-run.', row_count;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- email_settings: per-org provider config
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'gmail-relay',
  -- v1.<nonce>.<ct>.<tag> envelope from @aegis/email crypto helper.
  -- NULL means "provider chosen but not yet configured."
  config_envelope TEXT,
  from_address VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  reply_to VARCHAR(255),
  last_test_at TIMESTAMPTZ,
  last_test_status VARCHAR(20),
  last_test_error_message TEXT,
  last_send_at TIMESTAMPTZ,
  last_send_status VARCHAR(20),
  last_send_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_settings_provider_chk
    CHECK (provider IN ('gmail-relay','gmail-smtp','resend','ses','sendgrid','smtp')),
  CONSTRAINT email_settings_test_status_chk
    CHECK (last_test_status IS NULL OR last_test_status IN ('success','failed')),
  CONSTRAINT email_settings_send_status_chk
    CHECK (last_send_status IS NULL OR last_send_status IN ('success','failed'))
);

-- ---------------------------------------------------------------------------
-- email_attempts: per-send audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  -- Full recipient address kept for debugging. Subject is full text rather
  -- than hashed — the audit log is admin-only and bounded by 90-day cleanup.
  to_address VARCHAR(320) NOT NULL,
  subject TEXT,
  status VARCHAR(20) NOT NULL,
  error_code VARCHAR(50),
  error_message TEXT,
  provider_message_id TEXT,
  queue_job_id TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_attempts_status_chk CHECK (status IN ('success','failed'))
);

-- Retention-friendly indexes: cleanup deletes by attempted_at; admin views
-- filter by organization + most-recent-first.
CREATE INDEX IF NOT EXISTS idx_email_attempts_org_attempted_at
  ON email_attempts(organization_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_attempts_attempted_at
  ON email_attempts(attempted_at);

-- ---------------------------------------------------------------------------
-- Default row per organization
-- ---------------------------------------------------------------------------
-- Every existing organization gets a default email_settings row with
-- provider='gmail-relay' and from_address derived from the admin's email.
-- Without a row, every email-dependent flow would 503 immediately on
-- existing installs — this gives them a configurable starting point.
INSERT INTO email_settings (organization_id, provider, from_address)
SELECT
  o.id,
  'gmail-relay',
  COALESCE(
    (SELECT email FROM "user" u WHERE u.role = 'admin' ORDER BY u."createdAt" LIMIT 1),
    'no-reply@' || COALESCE(LOWER(REPLACE(o.name, ' ', '-')), 'example.com')
  )
FROM organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Legacy env-var migration (one-time)
-- ---------------------------------------------------------------------------
-- We can't read process.env from SQL, so the actual env→DB migration runs
-- in the entrypoint (apps/aegis/docker-entrypoint.sh extension lands with
-- the next chunk). This migration prepares the schema for it; the
-- entrypoint will only write a row if (a) env vars are set and (b) the
-- existing email_settings row is still on the default (provider=
-- 'gmail-relay', config_envelope IS NULL).
--
-- 30-day grace window: until 2026-06-12, the entrypoint also logs that
-- SMTP_* env vars are deprecated. After that, the entrypoint code that
-- reads them is removed in a follow-up.

COMMIT;
