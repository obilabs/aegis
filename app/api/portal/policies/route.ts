import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'

/**
 * GET /api/portal/policies — list policies + per-policy compliance counts.
 *
 * Rewritten 2026-04-27 (policy-audience Phase 1, migration 081):
 * compliance counts now consume `kb_article_audience_count(article_id)` and
 * `kb_article_owes(article_id, user_id)` — single source of truth that
 * honors all 7 `required_for_*` axes (roles, departments, job_titles,
 * employment_types, contact_groups, companies, locations) plus the
 * `required_for_audience_kind` enum (none / internal / targeted).
 *
 * Pre-rewrite, `total_assigned` only honored `visible_to_contact_groups`
 * and silently fell back to "every user in the org" — producing wrong
 * compliance percentages for any policy targeting a subset by role,
 * department, job_title, etc.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const policies = await query(
      `SELECT
        ka.id,
        ka.title AS name,
        ka.summary AS description,
        ka.article_type AS policy_type,
        kc.name AS category,
        ka.content_version::text AS version,
        ka.status,
        ka.published_at AS effective_date,
        ka.updated_at AS review_date,
        ka.requires_acknowledgment,
        ka.acknowledgment_required_by,
        ka.acknowledgment_days,
        ka.required_for_audience_kind,
        ka.is_assigned,
        ka.tags,

        -- Total assigned: audience-resolved user count (single source of truth).
        CASE
          WHEN ka.requires_acknowledgment
            THEN kb_article_audience_count(ka.id)
          ELSE 0
        END AS total_assigned,

        -- Acknowledged: unique users who acknowledged.
        (SELECT COUNT(DISTINCT kaa.user_id)::int
           FROM kb_article_acknowledgments kaa
          WHERE kaa.article_id = ka.id) AS acknowledged,

        -- Overdue: count audience-resolved users past their effective deadline
        -- who haven't acknowledged. Effective deadline = LEAST(fixed-date, start_date+days)
        -- when both set; whichever is set otherwise.
        CASE
          WHEN ka.requires_acknowledgment
               AND (ka.acknowledgment_required_by IS NOT NULL OR ka.acknowledgment_days IS NOT NULL)
            THEN (
              SELECT COUNT(*)::int
                FROM users u
                LEFT JOIN contacts c ON c.id = u.contact_id
               WHERE kb_article_owes(ka.id, u.id) = true
                 AND NOT EXISTS (
                   SELECT 1 FROM kb_article_acknowledgments ack
                    WHERE ack.article_id = ka.id AND ack.user_id = u.id
                 )
                 AND CURRENT_DATE > CASE
                   WHEN ka.acknowledgment_required_by IS NOT NULL AND ka.acknowledgment_days IS NOT NULL AND c.id IS NOT NULL THEN
                     LEAST(
                       ka.acknowledgment_required_by,
                       (COALESCE(c.start_date, c.created_at::date) + ka.acknowledgment_days)
                     )
                   WHEN ka.acknowledgment_days IS NOT NULL AND c.id IS NOT NULL THEN
                     (COALESCE(c.start_date, c.created_at::date) + ka.acknowledgment_days)
                   ELSE
                     ka.acknowledgment_required_by
                 END
            )
          ELSE 0
        END AS overdue

      FROM kb_articles ka
      LEFT JOIN kb_categories kc ON ka.category_id = kc.id
      WHERE ka.organization_id = $1
        AND ka.article_type IN ('policy', 'procedure')
        AND ka.is_deleted = false
      ORDER BY ka.article_type, ka.title`,
      [orgId],
    )

    const mapped = policies.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      policyType: p.policy_type || 'company_policy',
      category: p.category || 'General',
      version: p.version || '1',
      status: p.status || 'draft',
      effectiveDate: p.effective_date,
      reviewDate: p.review_date,
      requiresAcknowledgment: p.requires_acknowledgment || false,
      acknowledgmentDays: p.acknowledgment_days,
      audienceKind: p.required_for_audience_kind || 'internal',
      tags: p.tags || [],
      totalAssigned: p.total_assigned || 0,
      acknowledged: p.acknowledged || 0,
      pending: p.requires_acknowledgment ? Math.max(0, (p.total_assigned || 0) - (p.acknowledged || 0)) : 0,
      overdue: p.overdue || 0,
      compliancePercentage: p.requires_acknowledgment && p.total_assigned > 0
        ? Math.round((p.acknowledged / p.total_assigned) * 1000) / 10
        : 0,
    }))

    return NextResponse.json({ policies: mapped })
  } catch (error) {
    console.error('Failed to fetch policies:', error)
    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 })
  }
}
