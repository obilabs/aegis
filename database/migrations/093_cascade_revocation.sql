-- Migration 093: Cascade revocation for MSP pairing keys
--
-- Spec: openspec/changes/msp-cascade-revocation/
-- Design: openspec/changes/msp-cascade-revocation/design.md
--
-- Ships what NIST 800-53 PS-4 + SOC 2 CC7.2 + ISO 27001 A.16.1 have
-- asked for since 2014 and what no MSP platform offers as a primitive:
-- one-button revoke of an MSP firm's pairing key that cascades to
-- every downstream credential the MSP firm holds — child api_keys
-- created by MSP techs, user accounts provisioned for MSP staff, live
-- Better Auth sessions, and effective invalidation of bearer tokens
-- carrying pre-cascade key_version claims.
--
-- Schema additions:
--
--   * api_keys.parent_key_id — nullable FK to api_keys(id). Set on
--     child keys issued by an MSP tech under a pairing. Depth cap: 1.
--     Enforced by CHECK constraint + trigger (belt-and-suspenders per
--     design D2 — the Okta transitive-lockout pattern must not recur).
--
--   * users.user_origin — CHECK'd enum (msp_provisioned |
--     customer_native | customer_linked_to_msp). Defaults
--     customer_native so existing rows are safe.
--
--   * users.msp_pairing_key_id — nullable FK to api_keys(id).
--     Populated only for msp_provisioned + customer_linked_to_msp
--     rows. Cascade only disables users with matching pairing AND
--     user_origin='msp_provisioned' — customer_linked_to_msp rows
--     lose SSO but keep their account.
--
--   * users.disabled_at + users.disabled_reason — audit context for
--     disabled state. Populated only when status transitions to
--     'disabled'. Never used for status='active' rows.
--
--   * users.key_version — bigint bumped on cascade. lib/api-auth.ts
--     validates against any bearer-token key_version claim; mismatch
--     → 401 immediately, regardless of token TTL. Fixes the NIST
--     AC-12 gap (revoked credential still valid until token expiry).
--
--   * audit_log.revoked_by_cascade_id — self-referential FK to
--     audit_log(id). Child cascade rows link to the parent event.
--     Design references provider_audit_log; the canonical table is
--     audit_log — same append-only invariant, name updated to reality.
--
--   * cascade_revocation_queue — 60-second undo window backing table
--     (design D7). Persistent so boot recovery covers process death
--     between queue-insert and commit.
--
-- What this migration does NOT do:
--
--   * Doesn't touch existing rows. All new columns default to
--     safe values. No rewrite pass required.
--
--   * Doesn't create a parent api_keys row for existing MSP
--     pairings' historical children. Cascade only affects
--     forward-issued keys. Historic child keys are unowned by any
--     pairing until an admin explicitly parents them (out of scope
--     for the migration).
--
--   * Doesn't disable existing users with active MSP access.
--     Backfill of user_origin='msp_provisioned' is an admin choice,
--     not a schema default — the migration cannot know which
--     existing users came from which MSP.
--
-- Idempotent: re-running on a fully-migrated DB is a no-op. Every
-- ALTER + CREATE guards on IF NOT EXISTS or catalog lookup.

BEGIN;

-- ============================================================================
-- Section 1 — api_keys.parent_key_id + depth-cap enforcement
-- ============================================================================

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS parent_key_id UUID NULL REFERENCES public.api_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_parent
  ON public.api_keys(parent_key_id)
  WHERE parent_key_id IS NOT NULL;

-- Depth cap enforcement: single trigger. Design D2 originally called
-- for a CHECK-subquery + trigger belt-and-suspenders pattern, but
-- Postgres rejects subqueries in CHECK constraints outright ("cannot
-- use subquery in check constraint"). Trigger alone is sufficient
-- because it fires on both INSERT and UPDATE OF parent_key_id — the
-- exact two vectors the CHECK was supposed to defend. The Okta
-- transitive-lockout pattern that motivated the cap cannot recur.

CREATE OR REPLACE FUNCTION public.enforce_flat_cascade() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_key_id IS NOT NULL THEN
    PERFORM 1 FROM public.api_keys
      WHERE id = NEW.parent_key_id
        AND parent_key_id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION
        'api_keys: cascade depth cap (1); parent % already has a parent_key_id',
        NEW.parent_key_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_api_keys_flat_cascade ON public.api_keys;
CREATE TRIGGER trg_api_keys_flat_cascade
  BEFORE INSERT OR UPDATE OF parent_key_id ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_flat_cascade();

-- ============================================================================
-- Section 2 — users.user_origin / msp_pairing_key_id / disabled_at /
-- disabled_reason / key_version
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_origin VARCHAR(32) NOT NULL DEFAULT 'customer_native';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_user_origin_chk'
       AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_user_origin_chk
      CHECK (user_origin IN (
        'msp_provisioned',
        'customer_native',
        'customer_linked_to_msp'
      ));
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS msp_pairing_key_id UUID NULL
    REFERENCES public.api_keys(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS key_version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_msp_pairing
  ON public.users(msp_pairing_key_id)
  WHERE msp_pairing_key_id IS NOT NULL;

-- ============================================================================
-- Section 3 — audit_log.revoked_by_cascade_id
-- ============================================================================

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS revoked_by_cascade_id UUID NULL
    REFERENCES public.audit_log(id);

CREATE INDEX IF NOT EXISTS idx_audit_log_cascade
  ON public.audit_log(revoked_by_cascade_id)
  WHERE revoked_by_cascade_id IS NOT NULL;

-- ============================================================================
-- Section 4 — cascade_revocation_queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cascade_revocation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_key_id UUID NOT NULL REFERENCES public.api_keys(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id UUID NOT NULL REFERENCES public.users(id),
  reason TEXT NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'cancelled', 'committed', 'failed')),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commit_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  committed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  cascade_audit_id UUID NULL REFERENCES public.audit_log(id)
);

CREATE INDEX IF NOT EXISTS idx_cascade_queue_pending
  ON public.cascade_revocation_queue(commit_after)
  WHERE state = 'queued';

CREATE INDEX IF NOT EXISTS idx_cascade_queue_org
  ON public.cascade_revocation_queue(organization_id, state);

COMMIT;
