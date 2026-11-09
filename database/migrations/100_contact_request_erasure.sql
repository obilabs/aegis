-- Migration 100: a person named on a request can be erased, and the request
-- says so.
--
-- ## The bug
--
-- Five foreign-key columns are NOT NULL and reference `contacts` with
-- ON DELETE SET NULL:
--
--   access_requests.requester_id        access_requests.for_contact_id
--   asset_requests.requester_id         asset_requests.for_contact_id
--   offboarding_requests.contact_id
--
-- Those two clauses contradict each other. Postgres honours the FK by issuing
-- `UPDATE ONLY access_requests SET for_contact_id = NULL`, the NOT NULL
-- constraint rejects it, and the parent DELETE is refused:
--
--   ERROR: null value in column "for_contact_id" of relation "access_requests"
--          violates not-null constraint
--
-- So anyone ever named on an access request, an asset request or an offboarding
-- request could not be permanently deleted at all — not by
-- /api/portal/admin/contacts/[id]/purge, not by the bulk route, not by the 2am
-- retention worker. The admin got a 500. "We cannot delete this person" is a
-- GDPR Article 17 answer the product was giving by accident, and the reason was
-- a DDL contradiction rather than a retention decision anybody made.
--
-- ## The decision: anonymise, and record that it happened
--
-- Deleting these rows with the person would destroy history — an access request
-- carries who approved what access and why, an asset request carries an
-- approval chain and a fulfilment, an offboarding request carries the
-- termination dates and owns the asset- and badge-retrieval rows that hang off
-- it with ON DELETE CASCADE. Those are records of decisions that were made;
-- they outlive the person, exactly as a ticket does.
--
-- Refusing the purge deliberately would be worse: `contacts.legal_hold` already
-- exists for "this person's records must be kept", it is an explicit admin
-- choice, and both purge paths honour it. A second, implicit hold that catches
-- everyone who ever filled in a form is not a policy — and it cannot be lifted.
--
-- So the link goes, the record stays. That is what `ON DELETE SET NULL` already
-- said; this migration just lets it happen, and is deliberately the same
-- disposition nine other foreign keys to `contacts` already take.
--
-- ## Why a nullable column alone was not enough
--
-- Dropping NOT NULL on its own would give up a real guarantee — nothing would
-- then stop a new request being written with no requester at all — and would
-- leave a null link ambiguous: erased person, or never filled in? For a column
-- whose whole purpose is now to evidence an erasure, that ambiguity is the
-- thing worth avoiding.
--
-- So each column gets a companion `*_erased_at` timestamp, a CHECK that the
-- link may be absent ONLY when it is stamped, and a trigger that stamps it when
-- the FK nulls the link. Net effect:
--
--   * an INSERT with no requester still fails, as it did before;
--   * a purge succeeds, and the surviving row says when that person's identity
--     was erased from it;
--   * `requester_id IS NULL AND requester_erased_at IS NULL` is unreachable, so
--     a reader never has to guess which of the two happened.
--
-- ## What this does NOT do
--
-- It does not change the ON DELETE action. `CLAUDE.md` ("FK design — never
-- orphan identity references") forbids ON DELETE SET NULL on new foreign keys
-- to identity entities and says purge is "gated by reference transfer or
-- anonymization" — which is what this is, at the one moment the rule carves
-- out. Turning these five back into RESTRICT would re-break the purge, and
-- leaving them as the only NOT NULL + SET NULL pair in a set of 28 is how the
-- bug got here. Whether all 28 should instead be RESTRICT + an explicit
-- anonymisation step is a bigger question than this fix, and nothing here
-- forecloses it.
--
-- Idempotent: safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- The stamp columns.
-- ---------------------------------------------------------------------------
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS requester_erased_at    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS for_contact_erased_at  timestamp with time zone;

ALTER TABLE public.asset_requests
  ADD COLUMN IF NOT EXISTS requester_erased_at    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS for_contact_erased_at  timestamp with time zone;

ALTER TABLE public.offboarding_requests
  ADD COLUMN IF NOT EXISTS contact_erased_at      timestamp with time zone;

COMMENT ON COLUMN public.access_requests.requester_erased_at IS
  'Set when the requester contact was purged and the link nulled. NULL means the requester is still named.';
COMMENT ON COLUMN public.access_requests.for_contact_erased_at IS
  'Set when the subject contact was purged and the link nulled.';
COMMENT ON COLUMN public.asset_requests.requester_erased_at IS
  'Set when the requester contact was purged and the link nulled.';
COMMENT ON COLUMN public.asset_requests.for_contact_erased_at IS
  'Set when the subject contact was purged and the link nulled.';
COMMENT ON COLUMN public.offboarding_requests.contact_erased_at IS
  'Set when the offboarded contact was purged and the link nulled.';

-- ---------------------------------------------------------------------------
-- The stamping trigger.
--
-- ON DELETE SET NULL is implemented as a real UPDATE on the referencing table,
-- so a BEFORE UPDATE row trigger sees it and can fill the companion column in
-- the same statement — which is what keeps the CHECK below satisfiable without
-- the purge having to know these tables exist.
--
-- One function, three triggers: the link column and its stamp are passed as
-- trigger arguments, so adding a fourth table is a CREATE TRIGGER and not a
-- fourth copy of this logic.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stamp_contact_link_erasure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_link  text := TG_ARGV[0];
  v_stamp text := TG_ARGV[1];
BEGIN
  -- Only the transition "named -> not named" is an erasure. A row that was
  -- already null stays as it is, and so does its existing stamp.
  IF (to_jsonb(OLD) ->> v_link) IS NOT NULL
     AND (to_jsonb(NEW) ->> v_link) IS NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(v_stamp, NOW()));
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_contact_link_erasure() IS
  'BEFORE UPDATE trigger: stamps TG_ARGV[1] when the contact link in TG_ARGV[0] goes from set to null, which is what ON DELETE SET NULL does during a contact purge.';

DROP TRIGGER IF EXISTS trg_access_requests_requester_erasure ON public.access_requests;
CREATE TRIGGER trg_access_requests_requester_erasure
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_link_erasure('requester_id', 'requester_erased_at');

DROP TRIGGER IF EXISTS trg_access_requests_for_contact_erasure ON public.access_requests;
CREATE TRIGGER trg_access_requests_for_contact_erasure
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_link_erasure('for_contact_id', 'for_contact_erased_at');

DROP TRIGGER IF EXISTS trg_asset_requests_requester_erasure ON public.asset_requests;
CREATE TRIGGER trg_asset_requests_requester_erasure
  BEFORE UPDATE ON public.asset_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_link_erasure('requester_id', 'requester_erased_at');

DROP TRIGGER IF EXISTS trg_asset_requests_for_contact_erasure ON public.asset_requests;
CREATE TRIGGER trg_asset_requests_for_contact_erasure
  BEFORE UPDATE ON public.asset_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_link_erasure('for_contact_id', 'for_contact_erased_at');

DROP TRIGGER IF EXISTS trg_offboarding_requests_contact_erasure ON public.offboarding_requests;
CREATE TRIGGER trg_offboarding_requests_contact_erasure
  BEFORE UPDATE ON public.offboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_link_erasure('contact_id', 'contact_erased_at');

-- ---------------------------------------------------------------------------
-- Drop NOT NULL, and replace it with the weaker guarantee that is actually
-- true: the link may be missing only because it was erased.
--
-- Order matters — the CHECKs go on before the NOT NULLs come off, so there is
-- no window in which an unexplained null is accepted.
-- ---------------------------------------------------------------------------
ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS access_requests_requester_present,
  ADD  CONSTRAINT access_requests_requester_present
       CHECK (requester_id IS NOT NULL OR requester_erased_at IS NOT NULL),
  DROP CONSTRAINT IF EXISTS access_requests_for_contact_present,
  ADD  CONSTRAINT access_requests_for_contact_present
       CHECK (for_contact_id IS NOT NULL OR for_contact_erased_at IS NOT NULL);

ALTER TABLE public.asset_requests
  DROP CONSTRAINT IF EXISTS asset_requests_requester_present,
  ADD  CONSTRAINT asset_requests_requester_present
       CHECK (requester_id IS NOT NULL OR requester_erased_at IS NOT NULL),
  DROP CONSTRAINT IF EXISTS asset_requests_for_contact_present,
  ADD  CONSTRAINT asset_requests_for_contact_present
       CHECK (for_contact_id IS NOT NULL OR for_contact_erased_at IS NOT NULL);

ALTER TABLE public.offboarding_requests
  DROP CONSTRAINT IF EXISTS offboarding_requests_contact_present,
  ADD  CONSTRAINT offboarding_requests_contact_present
       CHECK (contact_id IS NOT NULL OR contact_erased_at IS NOT NULL);

ALTER TABLE public.access_requests      ALTER COLUMN requester_id   DROP NOT NULL;
ALTER TABLE public.access_requests      ALTER COLUMN for_contact_id DROP NOT NULL;
ALTER TABLE public.asset_requests       ALTER COLUMN requester_id   DROP NOT NULL;
ALTER TABLE public.asset_requests       ALTER COLUMN for_contact_id DROP NOT NULL;
ALTER TABLE public.offboarding_requests ALTER COLUMN contact_id     DROP NOT NULL;

-- Finding the records a given erasure touched, and the ones still naming
-- somebody, without a sequential scan over the whole table.
CREATE INDEX IF NOT EXISTS idx_access_requests_requester_erased
  ON public.access_requests (requester_erased_at) WHERE requester_erased_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_requests_for_contact_erased
  ON public.access_requests (for_contact_erased_at) WHERE for_contact_erased_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_requests_requester_erased
  ON public.asset_requests (requester_erased_at) WHERE requester_erased_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_requests_for_contact_erased
  ON public.asset_requests (for_contact_erased_at) WHERE for_contact_erased_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offboarding_requests_contact_erased
  ON public.offboarding_requests (contact_erased_at) WHERE contact_erased_at IS NOT NULL;

COMMIT;
