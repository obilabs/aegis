-- Telemetry consent: per-org enable/disable + append-only consent log.
--
-- Closes the highest-risk pre-publication item from the 2026-06-11
-- install-count research: aegis phones home but operators have
-- no install-time disclosure, no kill-switch env var, and no in-app
-- consent record. Per PRINCIPLES.md #2 (consent-first telemetry), this
-- has to land before show_install_stats can be flipped on the
-- marketing landing.
--
-- 093 was reserved for msp-cascade-revocation (filed openspec, not yet
-- shipped). The entrypoint applies any missing migrations regardless
-- of gaps, so 094 here doesn't depend on 093 having shipped first.
--
-- Two tables:
--   telemetry_settings — singleton per org. enabled defaults TRUE so
--     existing installs keep current behavior until the operator makes
--     an explicit choice (banner prompts them on next admin login).
--   telemetry_consent_log — append-only audit history. Every state
--     change appends a row. Per PRINCIPLES.md #6 — no UPDATE, no
--     DELETE supported at the application layer.
--
-- Backfill: every existing organization gets a `telemetry_settings`
-- row (enabled=true) + a `telemetry_consent_log` row marked
-- `retroactive_pre_consent_release` so the audit history honestly
-- distinguishes pre-feature installs from operator-confirmed choices.

BEGIN;

-- =========================================================================
-- telemetry_settings — singleton per organization
-- =========================================================================
CREATE TABLE IF NOT EXISTS telemetry_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_settings_org
  ON telemetry_settings(organization_id);

-- =========================================================================
-- telemetry_consent_log — append-only audit history
-- =========================================================================
CREATE TABLE IF NOT EXISTS telemetry_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL,
  source VARCHAR(40) NOT NULL,
  prev_state VARCHAR(20) NOT NULL,
  new_state VARCHAR(20) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT telemetry_consent_log_action_chk
    CHECK (action IN ('acknowledged', 'enabled', 'disabled')),
  CONSTRAINT telemetry_consent_log_source_chk
    CHECK (source IN ('setup_wizard', 'settings_ui', 'env_var',
                       'retroactive_pre_consent_release')),
  CONSTRAINT telemetry_consent_log_prev_state_chk
    CHECK (prev_state IN ('on', 'off', 'default-on')),
  CONSTRAINT telemetry_consent_log_new_state_chk
    CHECK (new_state IN ('on', 'off'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_consent_log_org_created
  ON telemetry_consent_log(organization_id, created_at DESC);

-- =========================================================================
-- Backfill — existing organizations get a settings row + an honestly-
-- named consent log row. Idempotent via ON CONFLICT so re-runs are
-- safe (per docker-entrypoint.sh schema_migrations contract).
-- =========================================================================
INSERT INTO telemetry_settings (organization_id, enabled)
  SELECT id, true FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO telemetry_consent_log
  (organization_id, user_id, action, source, prev_state, new_state, reason)
  SELECT
    id,
    NULL,
    'acknowledged',
    'retroactive_pre_consent_release',
    'default-on',
    'on',
    'Backfilled at telemetry-consent rollout. Operator has not yet made an explicit choice; banner on next admin login.'
  FROM organizations
  WHERE NOT EXISTS (
    SELECT 1 FROM telemetry_consent_log tcl
     WHERE tcl.organization_id = organizations.id
       AND tcl.source = 'retroactive_pre_consent_release'
  );

COMMIT;
