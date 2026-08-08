-- Integration tests for policy-audience SQL functions.
--
-- Spec: openspec/changes/policy-audience/proposal.md (D42-D48)
-- Migration: 081_policy_audience.sql
-- Functions under test: kb_article_owes, kb_article_audience_count,
--                       get_pending_acknowledgments
--
-- Run inside the running aegis_db container:
--   docker exec -i aegis_db psql -U aegis -d aegis -v ON_ERROR_STOP=1 \
--     < apps/aegis/database/tests/audience.integration.test.sql
--
-- The test wraps everything in BEGIN/ROLLBACK so the DB is left untouched.
-- Each test uses PL/pgSQL ASSERT — first failure aborts with a clear message.

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
DECLARE
  v_org_id uuid;
  v_admin_user_id uuid;  -- admin with no contact link

  -- Synthetic axis ids (all real rows we INSERT below)
  v_role_a uuid; v_role_b uuid;
  v_dept_a uuid; v_dept_b uuid;
  v_jt_a uuid;
  v_et_a uuid;
  v_company_a uuid;
  v_location_a uuid;
  v_group_a uuid;

  -- Synthetic users
  v_emp_role_a uuid;       -- employee with role_a, dept_a
  v_emp_role_b uuid;       -- employee with role_b, dept_b
  v_emp_no_role uuid;      -- employee with no role, no dept
  v_cust_role_a uuid;      -- customer with role_a (still external — should be excluded for 'internal')
  v_vendor_role_a uuid;
  v_partner_role_a uuid;
  v_emp_in_group_a uuid;   -- employee in contact_group_a
  v_emp_company_a uuid;    -- employee with jt_a, et_a, company_a, location_a

  -- Contact ids (need them for users.contact_id wiring)
  v_c_emp_role_a uuid; v_c_emp_role_b uuid; v_c_emp_no_role uuid;
  v_c_cust_role_a uuid; v_c_vendor_role_a uuid; v_c_partner_role_a uuid;
  v_c_emp_in_group_a uuid; v_c_emp_company_a uuid;

  -- Articles
  v_art_none uuid;
  v_art_internal uuid;
  v_art_targeted_role uuid;
  v_art_targeted_dept uuid;
  v_art_targeted_jt uuid;
  v_art_targeted_et uuid;
  v_art_targeted_company uuid;
  v_art_targeted_location uuid;
  v_art_targeted_group uuid;
  v_art_targeted_multi uuid;
  v_art_targeted_empty uuid;
  v_art_internal_deleted uuid;

  v_count integer;
BEGIN
  -- ============================================================
  -- SETUP — seed axis tables, contacts, users, articles
  -- ============================================================

  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  ASSERT v_org_id IS NOT NULL, 'Setup: no organization in DB';

  SELECT id INTO v_admin_user_id FROM users WHERE contact_id IS NULL LIMIT 1;
  ASSERT v_admin_user_id IS NOT NULL, 'Setup: no contact-less admin user found';

  INSERT INTO user_roles (organization_id, name)
    VALUES (v_org_id, 'audtest_role_a'), (v_org_id, 'audtest_role_b');
  SELECT id INTO v_role_a FROM user_roles WHERE organization_id = v_org_id AND name = 'audtest_role_a';
  SELECT id INTO v_role_b FROM user_roles WHERE organization_id = v_org_id AND name = 'audtest_role_b';

  INSERT INTO departments (organization_id, name)
    VALUES (v_org_id, 'audtest_dept_a'), (v_org_id, 'audtest_dept_b');
  SELECT id INTO v_dept_a FROM departments WHERE organization_id = v_org_id AND name = 'audtest_dept_a';
  SELECT id INTO v_dept_b FROM departments WHERE organization_id = v_org_id AND name = 'audtest_dept_b';

  INSERT INTO job_titles (organization_id, name) VALUES (v_org_id, 'audtest_jt_a');
  SELECT id INTO v_jt_a FROM job_titles WHERE organization_id = v_org_id AND name = 'audtest_jt_a';

  INSERT INTO employment_types (organization_id, name) VALUES (v_org_id, 'audtest_et_a');
  SELECT id INTO v_et_a FROM employment_types WHERE organization_id = v_org_id AND name = 'audtest_et_a';

  INSERT INTO companies (organization_id, name) VALUES (v_org_id, 'audtest_co_a');
  SELECT id INTO v_company_a FROM companies WHERE organization_id = v_org_id AND name = 'audtest_co_a';

  INSERT INTO locations (organization_id, name) VALUES (v_org_id, 'audtest_loc_a');
  SELECT id INTO v_location_a FROM locations WHERE organization_id = v_org_id AND name = 'audtest_loc_a';

  INSERT INTO contact_groups (organization_id, name) VALUES (v_org_id, 'audtest_grp_a');
  SELECT id INTO v_group_a FROM contact_groups WHERE organization_id = v_org_id AND name = 'audtest_grp_a';

  -- Contacts of each contact_type, wired to axis ids
  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, email,
                        department_id, job_title_id, employment_type_id, company_id, location_id, start_date) VALUES
    (v_org_id, 'employee', 'Emp',  'RoleA',    'audtest.emp.a@local',  v_dept_a, NULL,   NULL,   NULL,         NULL,         CURRENT_DATE - 60),
    (v_org_id, 'employee', 'Emp',  'RoleB',    'audtest.emp.b@local',  v_dept_b, NULL,   NULL,   NULL,         NULL,         CURRENT_DATE - 60),
    (v_org_id, 'employee', 'Emp',  'NoRole',   'audtest.emp.nr@local', NULL,     NULL,   NULL,   NULL,         NULL,         CURRENT_DATE - 60),
    (v_org_id, 'customer', 'Cust', 'RoleA',    'audtest.cust@local',   NULL,     NULL,   NULL,   NULL,         NULL,         NULL),
    (v_org_id, 'vendor',   'Vend', 'RoleA',    'audtest.vend@local',   NULL,     NULL,   NULL,   NULL,         NULL,         NULL),
    (v_org_id, 'partner',  'Part', 'RoleA',    'audtest.part@local',   NULL,     NULL,   NULL,   NULL,         NULL,         NULL),
    (v_org_id, 'employee', 'Emp',  'GroupA',   'audtest.emp.g@local',  NULL,     NULL,   NULL,   NULL,         NULL,         CURRENT_DATE - 60),
    (v_org_id, 'employee', 'Emp',  'CompanyA', 'audtest.emp.c@local',  NULL,     v_jt_a, v_et_a, v_company_a,  v_location_a, CURRENT_DATE - 60);

  SELECT id INTO v_c_emp_role_a    FROM contacts WHERE email = 'audtest.emp.a@local';
  SELECT id INTO v_c_emp_role_b    FROM contacts WHERE email = 'audtest.emp.b@local';
  SELECT id INTO v_c_emp_no_role   FROM contacts WHERE email = 'audtest.emp.nr@local';
  SELECT id INTO v_c_cust_role_a   FROM contacts WHERE email = 'audtest.cust@local';
  SELECT id INTO v_c_vendor_role_a FROM contacts WHERE email = 'audtest.vend@local';
  SELECT id INTO v_c_partner_role_a FROM contacts WHERE email = 'audtest.part@local';
  SELECT id INTO v_c_emp_in_group_a FROM contacts WHERE email = 'audtest.emp.g@local';
  SELECT id INTO v_c_emp_company_a FROM contacts WHERE email = 'audtest.emp.c@local';

  INSERT INTO users (organization_id, email, first_name, last_name, contact_id, role_id) VALUES
    (v_org_id, 'audtest.emp.a@local',  'Emp',  'RoleA',    v_c_emp_role_a,    v_role_a),
    (v_org_id, 'audtest.emp.b@local',  'Emp',  'RoleB',    v_c_emp_role_b,    v_role_b),
    (v_org_id, 'audtest.emp.nr@local', 'Emp',  'NoRole',   v_c_emp_no_role,   NULL),
    (v_org_id, 'audtest.cust@local',   'Cust', 'RoleA',    v_c_cust_role_a,   v_role_a),
    (v_org_id, 'audtest.vend@local',   'Vend', 'RoleA',    v_c_vendor_role_a, v_role_a),
    (v_org_id, 'audtest.part@local',   'Part', 'RoleA',    v_c_partner_role_a, v_role_a),
    (v_org_id, 'audtest.emp.g@local',  'Emp',  'GroupA',   v_c_emp_in_group_a, NULL),
    (v_org_id, 'audtest.emp.c@local',  'Emp',  'CompanyA', v_c_emp_company_a, NULL);

  SELECT id INTO v_emp_role_a       FROM users WHERE email = 'audtest.emp.a@local';
  SELECT id INTO v_emp_role_b       FROM users WHERE email = 'audtest.emp.b@local';
  SELECT id INTO v_emp_no_role      FROM users WHERE email = 'audtest.emp.nr@local';
  SELECT id INTO v_cust_role_a      FROM users WHERE email = 'audtest.cust@local';
  SELECT id INTO v_vendor_role_a    FROM users WHERE email = 'audtest.vend@local';
  SELECT id INTO v_partner_role_a   FROM users WHERE email = 'audtest.part@local';
  SELECT id INTO v_emp_in_group_a   FROM users WHERE email = 'audtest.emp.g@local';
  SELECT id INTO v_emp_company_a    FROM users WHERE email = 'audtest.emp.c@local';

  INSERT INTO contact_group_members (contact_id, group_id) VALUES (v_c_emp_in_group_a, v_group_a);

  -- Articles in each kind / axis
  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind) VALUES
    (v_org_id, 'TEST none',     'audtest-none',     'x', 'x', 'published', false, 'policy', 'none'),
    (v_org_id, 'TEST internal', 'audtest-internal', 'x', 'x', 'published', true,  'policy', 'internal');

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_roles) VALUES
    (v_org_id, 'TEST tgt-role', 'audtest-tgt-role', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_role_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_departments) VALUES
    (v_org_id, 'TEST tgt-dept', 'audtest-tgt-dept', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_dept_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_job_titles) VALUES
    (v_org_id, 'TEST tgt-jt', 'audtest-tgt-jt', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_jt_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_employment_types) VALUES
    (v_org_id, 'TEST tgt-et', 'audtest-tgt-et', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_et_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_companies) VALUES
    (v_org_id, 'TEST tgt-co', 'audtest-tgt-co', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_company_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_locations) VALUES
    (v_org_id, 'TEST tgt-loc', 'audtest-tgt-loc', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_location_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_contact_groups) VALUES
    (v_org_id, 'TEST tgt-grp', 'audtest-tgt-grp', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_group_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, required_for_roles, required_for_departments) VALUES
    (v_org_id, 'TEST tgt-multi', 'audtest-tgt-multi', 'x', 'x', 'published', true, 'policy', 'targeted', ARRAY[v_role_b], ARRAY[v_dept_a]);

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind) VALUES
    (v_org_id, 'TEST tgt-empty', 'audtest-tgt-empty', 'x', 'x', 'published', true, 'policy', 'targeted');

  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, requires_acknowledgment, article_type, required_for_audience_kind, is_deleted) VALUES
    (v_org_id, 'TEST internal-deleted', 'audtest-int-del', 'x', 'x', 'published', true, 'policy', 'internal', true);

  SELECT id INTO v_art_none              FROM kb_articles WHERE slug = 'audtest-none';
  SELECT id INTO v_art_internal          FROM kb_articles WHERE slug = 'audtest-internal';
  SELECT id INTO v_art_targeted_role     FROM kb_articles WHERE slug = 'audtest-tgt-role';
  SELECT id INTO v_art_targeted_dept     FROM kb_articles WHERE slug = 'audtest-tgt-dept';
  SELECT id INTO v_art_targeted_jt       FROM kb_articles WHERE slug = 'audtest-tgt-jt';
  SELECT id INTO v_art_targeted_et       FROM kb_articles WHERE slug = 'audtest-tgt-et';
  SELECT id INTO v_art_targeted_company  FROM kb_articles WHERE slug = 'audtest-tgt-co';
  SELECT id INTO v_art_targeted_location FROM kb_articles WHERE slug = 'audtest-tgt-loc';
  SELECT id INTO v_art_targeted_group    FROM kb_articles WHERE slug = 'audtest-tgt-grp';
  SELECT id INTO v_art_targeted_multi    FROM kb_articles WHERE slug = 'audtest-tgt-multi';
  SELECT id INTO v_art_targeted_empty    FROM kb_articles WHERE slug = 'audtest-tgt-empty';
  SELECT id INTO v_art_internal_deleted  FROM kb_articles WHERE slug = 'audtest-int-del';

  RAISE NOTICE 'Setup complete (org=%, 8 users, 12 articles)', v_org_id;

  -- ============================================================
  -- TESTS: kb_article_owes
  -- ============================================================

  -- T01: 'none' mode → false for everyone
  ASSERT kb_article_owes(v_art_none, v_emp_role_a)    = false, 'T01a: none/employee should be false';
  ASSERT kb_article_owes(v_art_none, v_cust_role_a)   = false, 'T01b: none/customer should be false';
  ASSERT kb_article_owes(v_art_none, v_admin_user_id) = false, 'T01c: none/admin should be false';

  -- T02: 'internal' mode → only employees owe (THE KEY FIX)
  ASSERT kb_article_owes(v_art_internal, v_emp_role_a)     = true,  'T02a: internal/employee should be true';
  ASSERT kb_article_owes(v_art_internal, v_emp_role_b)     = true,  'T02b: internal/employee should be true';
  ASSERT kb_article_owes(v_art_internal, v_emp_no_role)    = true,  'T02c: internal/employee (no role) — role independence';
  ASSERT kb_article_owes(v_art_internal, v_cust_role_a)    = false, 'T02d: internal/customer must be false (external excluded)';
  ASSERT kb_article_owes(v_art_internal, v_vendor_role_a)  = false, 'T02e: internal/vendor must be false';
  ASSERT kb_article_owes(v_art_internal, v_partner_role_a) = false, 'T02f: internal/partner must be false';
  ASSERT kb_article_owes(v_art_internal, v_admin_user_id)  = false, 'T02g: internal/admin-no-contact must be false';

  -- T03: 'targeted' by role
  ASSERT kb_article_owes(v_art_targeted_role, v_emp_role_a)  = true,  'T03a: targeted role match (employee)';
  ASSERT kb_article_owes(v_art_targeted_role, v_cust_role_a) = true,  'T03b: targeted role match (customer with same role) — targeted does not filter by contact_type';
  ASSERT kb_article_owes(v_art_targeted_role, v_emp_role_b)  = false, 'T03c: targeted role mismatch (different role)';
  ASSERT kb_article_owes(v_art_targeted_role, v_emp_no_role) = false, 'T03d: targeted role mismatch (no role)';

  -- T04: 'targeted' by department
  ASSERT kb_article_owes(v_art_targeted_dept, v_emp_role_a)  = true,  'T04a: targeted dept match';
  ASSERT kb_article_owes(v_art_targeted_dept, v_emp_role_b)  = false, 'T04b: targeted dept mismatch';
  ASSERT kb_article_owes(v_art_targeted_dept, v_emp_no_role) = false, 'T04c: targeted dept mismatch (no dept)';

  -- T05: 'targeted' by job_title / employment_type / company / location
  ASSERT kb_article_owes(v_art_targeted_jt,       v_emp_company_a) = true,  'T05a: targeted job_title match';
  ASSERT kb_article_owes(v_art_targeted_jt,       v_emp_role_a)    = false, 'T05b: targeted job_title mismatch';
  ASSERT kb_article_owes(v_art_targeted_et,       v_emp_company_a) = true,  'T05c: targeted employment_type match';
  ASSERT kb_article_owes(v_art_targeted_company,  v_emp_company_a) = true,  'T05d: targeted company match';
  ASSERT kb_article_owes(v_art_targeted_company,  v_emp_role_a)    = false, 'T05e: targeted company mismatch';
  ASSERT kb_article_owes(v_art_targeted_location, v_emp_company_a) = true,  'T05f: targeted location match';

  -- T06: 'targeted' by contact_group
  ASSERT kb_article_owes(v_art_targeted_group, v_emp_in_group_a) = true,  'T06a: targeted group match';
  ASSERT kb_article_owes(v_art_targeted_group, v_emp_role_a)     = false, 'T06b: targeted group mismatch';

  -- T07: 'targeted' OR semantics — emp_role_a is in dept_a (matches dept axis);
  --      emp_role_b is in role_b (matches role axis); both should owe
  ASSERT kb_article_owes(v_art_targeted_multi, v_emp_role_a)  = true,  'T07a: OR semantics — dept_a matches';
  ASSERT kb_article_owes(v_art_targeted_multi, v_emp_role_b)  = true,  'T07b: OR semantics — role_b matches';
  ASSERT kb_article_owes(v_art_targeted_multi, v_emp_no_role) = false, 'T07c: OR semantics — no axis matches';

  -- T08: 'targeted' with all empty arrays → false (defensive)
  ASSERT kb_article_owes(v_art_targeted_empty, v_emp_role_a) = false, 'T08: targeted with all empty arrays should be false';

  -- T09: soft-deleted / nonexistent → false
  ASSERT kb_article_owes(v_art_internal_deleted, v_emp_role_a) = false, 'T09a: soft-deleted internal article should be false';
  ASSERT kb_article_owes(gen_random_uuid(),      v_emp_role_a) = false, 'T09b: nonexistent article should be false';

  -- ============================================================
  -- TESTS: kb_article_audience_count
  -- ============================================================

  -- T10: internal article → counts only employees (we added 5 employees: emp_role_a/b/nr/g/c)
  --      May also include any pre-existing employees in seed data. Lower bound check.
  v_count := kb_article_audience_count(v_art_internal);
  ASSERT v_count >= 5, format('T10: internal audience_count expected >= 5 employees, got %s', v_count);

  -- T11: targeted-by-role-A → counts users with role_a:
  --      emp_role_a (employee), cust_role_a, vendor_role_a, partner_role_a = 4
  v_count := kb_article_audience_count(v_art_targeted_role);
  ASSERT v_count = 4, format('T11: targeted role_a audience_count expected 4, got %s', v_count);

  -- T12: 'none' article → audience_count = 0
  v_count := kb_article_audience_count(v_art_none);
  ASSERT v_count = 0, format('T12: none audience_count expected 0, got %s', v_count);

  -- ============================================================
  -- TESTS: get_pending_acknowledgments
  -- ============================================================

  -- T13a: employee should see internal article in pending list
  ASSERT EXISTS (
    SELECT 1 FROM get_pending_acknowledgments(v_emp_role_a, NULL)
    WHERE article_id = v_art_internal
  ), 'T13a: employee should see internal article in pending list';

  -- T13b: customer should NOT see internal article in pending list
  ASSERT NOT EXISTS (
    SELECT 1 FROM get_pending_acknowledgments(v_cust_role_a, NULL)
    WHERE article_id = v_art_internal
  ), 'T13b: customer should NOT see internal article (external excluded by audience)';

  -- T14: after acknowledgment, article disappears from pending list
  INSERT INTO kb_article_acknowledgments (article_id, user_id, contact_id, article_version, acknowledged_at)
    VALUES (v_art_internal, v_emp_role_a, v_c_emp_role_a, 1, NOW());
  ASSERT NOT EXISTS (
    SELECT 1 FROM get_pending_acknowledgments(v_emp_role_a, NULL)
    WHERE article_id = v_art_internal
  ), 'T14: acked article should disappear from pending list';

  RAISE NOTICE '✓ All policy-audience integration tests passed (T01-T14)';
END $$;

ROLLBACK;
