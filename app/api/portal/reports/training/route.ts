import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapability } from '@/lib/permissions'

/**
 * GET /api/portal/reports/training
 *
 * Spec: openspec/changes/kb-quiz/proposal.md (D40, D41)
 *
 * Per-quiz aggregate: assigned vs passed (current version), pass rate, attempts,
 * average score on the current version. Denominator comes from policy-audience's
 * `kb_article_audience_count(article_id)` (D39 cross-spec contract).
 *
 * "Currently passed" requires `tc.assessment_hash = ka.assessment_hash` — passes
 * against an older version of the quiz don't count (D38). Reports filter via
 * `v_training_best_attempt` so we don't recompute best-attempt logic per query.
 *
 * RBAC: requires `reports` capability.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, orgId } = ctx

  if (!(await hasCapability(userId, 'reports'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.tags,
        a.assessment_hash,
        a.passing_score,
        a.updated_at,
        c.name AS category_name,
        c.slug AS category_slug,

        -- Audience size (denominator) — single source of truth via policy-audience helper
        kb_article_audience_count(a.id) AS total_assigned,

        -- Distinct users who passed the CURRENT version of the quiz
        (SELECT COUNT(DISTINCT v.user_id)::int
           FROM v_training_best_attempt v
          WHERE v.article_id = a.id
            AND v.passed = true
            AND v.assessment_hash = a.assessment_hash) AS passed_count,

        -- Distinct users who passed an OLDER version (need to retake)
        (SELECT COUNT(DISTINCT v.user_id)::int
           FROM v_training_best_attempt v
          WHERE v.article_id = a.id
            AND v.passed = true
            AND (v.assessment_hash IS DISTINCT FROM a.assessment_hash)) AS stale_pass_count,

        -- Total attempts (any version, any result)
        (SELECT COUNT(*)::int
           FROM training_completions tc
          WHERE tc.article_id = a.id) AS attempts_total,

        -- Average best-score on the current version (numeric)
        (SELECT ROUND(AVG(v.score)::numeric, 1)
           FROM v_training_best_attempt v
          WHERE v.article_id = a.id
            AND v.assessment_hash = a.assessment_hash) AS avg_score_current

      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = $1
        AND a.article_type = 'training'
        AND a.assessment IS NOT NULL
        AND a.status = 'published'
        AND a.is_deleted = false
      ORDER BY a.title
    `, [orgId])

    const articles = result.rows.map((r: any) => {
      const total = r.total_assigned || 0
      const passed = r.passed_count || 0
      const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0
      return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        tags: r.tags || [],
        category_name: r.category_name,
        category_slug: r.category_slug,
        passing_score: parseFloat(r.passing_score) || 80,
        updated_at: r.updated_at,
        total_assigned: total,
        passed_count: passed,
        pending_count: Math.max(0, total - passed),
        stale_pass_count: r.stale_pass_count || 0,
        attempts_total: r.attempts_total || 0,
        avg_score: r.avg_score_current !== null ? parseFloat(r.avg_score_current) : null,
        pass_rate: passRate,
      }
    })

    // Aggregate summary
    const totalArticles = articles.length
    const totalAssigned = articles.reduce((s, a) => s + a.total_assigned, 0)
    const totalPassed = articles.reduce((s, a) => s + a.passed_count, 0)
    const overallPassRate = totalAssigned > 0
      ? Math.round((totalPassed / totalAssigned) * 1000) / 10
      : 0

    return NextResponse.json({
      articles,
      summary: {
        total_articles: totalArticles,
        total_assigned: totalAssigned,
        total_passed: totalPassed,
        overall_pass_rate: overallPassRate,
      },
    })
  } catch (error) {
    console.error('Training report fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch training report' }, { status: 500 })
  }
}
