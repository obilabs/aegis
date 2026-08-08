-- Migration 089: Canonicalize user_roles capability names
--
-- Earlier deployments created role rows with capability names like
-- `manage_tickets`, `manage_settings`, `manage_users`, `view_audit_log`,
-- `manage_kb`, `manage_assets`, etc. The canonical set in
-- apps/aegis/lib/permissions.ts (and used by /api/setup/complete on
-- fresh installs) is just `triage`, `bulk_actions`, `reports`,
-- `settings`, `user_management` — coarser, matching the actual
-- hasCapability() lookups in route handlers.
--
-- Without this migration, hasCapability(userId, 'settings') returns
-- false for users in old-style roles, blocking access to admin routes
-- that gate on canonical names. Surfaced during the 2026-05-09 dev
-- deploy when admin@aegis.local got 403 Forbidden on the MTP
-- integrations page despite being in the System Admin role.
--
-- Strategy: for any role still carrying old-style capability names
-- (those starting with `manage_` or matching `view_audit_log`), reset
-- the capability array to the canonical default for that role name.
-- The role names match the seed roles in setup/complete/route.ts.
-- Roles already using only canonical names are untouched.
-- Customer-renamed roles (any name not in the seed list) fall through
-- to an empty capability array — operator must re-customize.
--
-- Note for operators upgrading from old deploys: if you customized any
-- of the seed roles' capabilities beyond the defaults, this migration
-- will reset them. Re-apply your customization after the upgrade.
-- This is a one-shot canonicalization, not an ongoing transform.
--
-- Idempotent. Re-running is a no-op (the WHERE filter only matches
-- rows still carrying old-style names).

BEGIN;

UPDATE user_roles
   SET permissions = jsonb_set(
         permissions,
         '{capabilities}',
         CASE name
           WHEN 'System Admin'   THEN '["triage", "bulk_actions", "reports", "settings", "user_management"]'::jsonb
           WHEN 'Helpdesk Admin' THEN '["triage", "bulk_actions", "reports"]'::jsonb
           WHEN 'Technician'     THEN '[]'::jsonb
           WHEN 'HR'             THEN '[]'::jsonb
           WHEN 'Manager'        THEN '["reports"]'::jsonb
           WHEN 'End User'       THEN '[]'::jsonb
           ELSE '[]'::jsonb
         END
       )
 WHERE jsonb_typeof(permissions->'capabilities') = 'array'
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements_text(permissions->'capabilities') AS e(cap_name)
      WHERE cap_name LIKE 'manage_%'
         OR cap_name = 'view_audit_log'
   );

COMMIT;
