-- Migration 097: MSP write-back provenance on ticket_replies.
--
-- Spec: openspec/changes/msp-mtp-inline-ticket-actions (minimal write path,
-- 2026-08-16). Adds the two columns the MTP write endpoints stamp so an MSP
-- reply is attributable and filterable.
--
-- `via_pairing_key_id` is exactly what the JIT detail endpoint already
-- anticipates in a comment — "NULL for every row today; the write path will
-- stamp it". Until now `lib/mtp-thread-filter.ts#filterThreadForCaller` (D8,
-- "another MSP's internal notes are hidden by default") had nothing to filter
-- on, so it was a no-op wearing the shape of a control. This makes it real.
--
-- `msp_actor_email` is denormalised on purpose. The acting MSP tech often has
-- no `users` row in this install, and authorship must outlive both that and
-- the revocation of the pairing key. A migrated or MSP-authored reply that
-- renders as anonymous is worse than no write path at all.
--
-- FK is ON DELETE RESTRICT per the repo's identity-reference rule (never
-- orphan a reference; deletion of an api_key is a revocation, not a purge).
--
-- Idempotent (guarded ADD COLUMN), per the apps/aegis migration convention.
-- Also folded into init.sql so a fresh install gets it without the migration
-- chain; applying this to a fresh DB is a no-op.

ALTER TABLE ticket_replies
  ADD COLUMN IF NOT EXISTS via_pairing_key_id uuid;

ALTER TABLE ticket_replies
  ADD COLUMN IF NOT EXISTS msp_actor_email character varying(320);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_name = 'ticket_replies_via_pairing_key_id_fkey'
       AND table_name = 'ticket_replies'
  ) THEN
    ALTER TABLE ticket_replies
      ADD CONSTRAINT ticket_replies_via_pairing_key_id_fkey
      FOREIGN KEY (via_pairing_key_id) REFERENCES api_keys(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Partial index: MSP-authored replies are a small minority of the table, and
-- every query that uses this column filters on NOT NULL (thread filtering,
-- "what did this MSP write" audit views).
CREATE INDEX IF NOT EXISTS idx_ticket_replies_via_pairing_key
  ON ticket_replies (via_pairing_key_id)
  WHERE via_pairing_key_id IS NOT NULL;

COMMENT ON COLUMN ticket_replies.via_pairing_key_id IS
  'MSP pairing key that authored this reply via /api/v1/mtp/tickets/{id}/comment. NULL for replies authored inside this install. Drives the msp actor_type and the D8 cross-MSP internal-note filter.';

COMMENT ON COLUMN ticket_replies.msp_actor_email IS
  'Asserted acting MSP technician (X-Aegis-Acting-User-Email). Denormalised so authorship survives the tech having no local user row and the pairing key later being revoked.';
