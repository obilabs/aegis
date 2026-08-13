-- 096_kb_categories_sort_order.sql
--
-- Schema-drift fix: kb_categories.sort_order.
--
-- lib/seed-procedures.ts seeds the starter "Policies & Procedures" category with
--   INSERT INTO kb_categories (organization_id, name, slug, description, icon, sort_order)
-- but the baked schema (database/init.sql) only ever defined display_order, never
-- sort_order. On an existing install that seeding INSERT throws (column
-- "sort_order" does not exist) and the starter KB silently fails to seed.
--
-- Fresh installs get the column straight from init.sql (added in the same change);
-- this migration back-fills existing installs. Idempotent (ADD COLUMN IF NOT EXISTS)
-- so re-application is a no-op.
--
-- NOTE: kb_categories also has a separate display_order column that other seeders
-- (lib/seed-training.ts) use. This migration only stops the drift-induced failure;
-- reconciling display_order vs sort_order into one column is a follow-up.

BEGIN;

ALTER TABLE public.kb_categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMIT;
