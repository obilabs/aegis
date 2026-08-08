/**
 * KB article visibility — the ONE predicate builder.
 *
 * Semantics are taken verbatim from `search_kb_articles_for_user()`
 * (init.sql, the canonical implementation): four tiers —
 *   public         → everyone
 *   authenticated  → any signed-in user OR any known contact
 *   internal       → signed-in user whose role is a STAFF role
 *   private        → user/contact matching one of the article's audience arrays
 *
 * ⚠️ BEHAVIOUR CHANGE (kb-attestations Phase 2, design §3.6): the pre-existing
 * public article route gated `internal` on session-existence ALONE. This adopts
 * the SQL function's stricter rule — `internal` requires a STAFF role — so a
 * signed-in NON-staff user (e.g. a customer contact's linked user) can no longer
 * see `internal` articles. This is the intended consolidation; note it in the PR.
 *
 * Consolidating here fixes the two routes that skipped visibility entirely and the
 * portal page that fetched the public endpoint (design §2, §10.4). Do NOT hand-roll
 * a visibility check anywhere else — call this.
 */

import { pool } from '@/lib/db';

// Staff roles that may see `internal` articles. Kept in exact sync with
// search_kb_articles_for_user() (init.sql). If you change one, change both.
export const KB_STAFF_ROLES = [
  'System Admin',
  'Helpdesk Admin',
  'Technician',
  'Manager',
  'admin',
  'technician',
  'manager',
] as const;

/** Resolved viewer attributes the visibility predicate keys on. */
export interface KbViewer {
  userId: string | null;
  /** Role NAME (e.g. 'admin'); drives the `internal` staff gate. */
  userRole: string | null;
  /** Role UUID; matched against visible_to_roles. */
  userRoleId: string | null;
  contactId: string | null;
  companyId: string | null;
  locationId: string | null;
  departmentId: string | null;
  jobTitleId: string | null;
  employmentTypeId: string | null;
}

const EMPTY_VIEWER: KbViewer = {
  userId: null, userRole: null, userRoleId: null, contactId: null,
  companyId: null, locationId: null, departmentId: null,
  jobTitleId: null, employmentTypeId: null,
};

/**
 * Resolve a viewer's role + contact attributes from the DB — mirrors the
 * DECLARE/SELECT block of search_kb_articles_for_user(). Either id may be null
 * (anonymous → all-null viewer → only `public` articles are visible).
 */
export async function resolveKbViewer(
  userId: string | null,
  contactId: string | null,
): Promise<KbViewer> {
  const viewer: KbViewer = { ...EMPTY_VIEWER, userId, contactId };

  if (userId) {
    const r = await pool.query(
      `SELECT ur.name AS role, u.role_id
         FROM users u
         LEFT JOIN user_roles ur ON ur.id = u.role_id
        WHERE u.id = $1`,
      [userId],
    );
    viewer.userRole = r.rows[0]?.role ?? null;
    viewer.userRoleId = r.rows[0]?.role_id ?? null;
  }

  if (contactId) {
    const r = await pool.query(
      `SELECT company_id, location_id, department_id, job_title_id, employment_type_id
         FROM contacts WHERE id = $1`,
      [contactId],
    );
    const c = r.rows[0];
    if (c) {
      viewer.companyId = c.company_id ?? null;
      viewer.locationId = c.location_id ?? null;
      viewer.departmentId = c.department_id ?? null;
      viewer.jobTitleId = c.job_title_id ?? null;
      viewer.employmentTypeId = c.employment_type_id ?? null;
    }
  }

  return viewer;
}

/** True iff this viewer is a signed-in staff member (may see `internal`). */
export function isKbStaff(viewer: KbViewer): boolean {
  return (
    viewer.userId !== null &&
    viewer.userRole !== null &&
    (KB_STAFF_ROLES as readonly string[]).includes(viewer.userRole)
  );
}

/**
 * Build the visibility WHERE-fragment to AND into a query over `kb_articles`.
 *
 * The public / authenticated / internal tiers depend only on the VIEWER (not the
 * row beyond its `visibility` column), so they are folded to TRUE/FALSE literals
 * here — only the `private` audience checks need bound params. Returns the SQL
 * fragment (already parenthesised) plus the ordered params; pass `startIndex` =
 * one past however many params the caller has already placed.
 *
 * Null viewer attributes are safe: `$k = ANY(array)` with a NULL `$k` yields NULL
 * (treated as false), exactly matching the SQL function's `IS NOT NULL AND` guards.
 */
export function kbVisibilityPredicate(
  viewer: KbViewer,
  opts: { alias?: string; startIndex?: number } = {},
): { sql: string; params: unknown[] } {
  const a = opts.alias ?? 'a';
  let i = opts.startIndex ?? 1;
  const params: unknown[] = [];
  const p = (v: unknown): string => {
    params.push(v);
    return `$${i++}`;
  };

  const authenticatedOk = viewer.userId !== null || viewer.contactId !== null;
  const internalOk = isKbStaff(viewer);

  // Private-tier bound params (contactId reused in the group check → bind once).
  const roleId = p(viewer.userRoleId);
  const companyId = p(viewer.companyId);
  const locationId = p(viewer.locationId);
  const departmentId = p(viewer.departmentId);
  const jobTitleId = p(viewer.jobTitleId);
  const employmentTypeId = p(viewer.employmentTypeId);
  const contactId = p(viewer.contactId);

  const sql = `(
    ${a}.visibility = 'public'
    OR (${a}.visibility = 'authenticated' AND ${authenticatedOk ? 'TRUE' : 'FALSE'})
    OR (${a}.visibility = 'internal' AND ${internalOk ? 'TRUE' : 'FALSE'})
    OR (${a}.visibility = 'private' AND (
        ${roleId} = ANY(${a}.visible_to_roles)
        OR ${companyId} = ANY(${a}.visible_to_companies)
        OR ${locationId} = ANY(${a}.visible_to_locations)
        OR ${departmentId} = ANY(${a}.visible_to_departments)
        OR ${jobTitleId} = ANY(${a}.visible_to_job_titles)
        OR ${employmentTypeId} = ANY(${a}.visible_to_employment_types)
        OR (
          ${contactId} IS NOT NULL
          AND array_length(${a}.visible_to_contact_groups, 1) IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM contact_group_members cgm
             WHERE cgm.contact_id = ${contactId}
               AND cgm.group_id = ANY(${a}.visible_to_contact_groups)
          )
        )
    ))
  )`;

  return { sql, params };
}
