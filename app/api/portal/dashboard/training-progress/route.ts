import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'

/**
 * GET /api/portal/dashboard/training-progress
 *
 * Returns training articles the CURRENT USER owes (per policy-audience's
 * `kb_article_owes`) with their best attempt against the CURRENT version
 * (per kb-quiz D38's assessment_hash invalidation).
 *
 * - `passed` is true only if the user passed the CURRENT quiz version.
 * - `needs_retake` is true when they passed an older version but the quiz
 *   has since changed — they need to take it again.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  // App users.id (UUID) resolved from the session email; session.user.id is the
  // Better Auth id (not a UUID) and made every My Hub widget fail.
  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) {
    return NextResponse.json({ error: 'No application user for this session' }, { status: 403 })
  }

  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.passing_score,
        a.assessment_hash,
        c.slug as category_slug,
        tc.best_score_current,
        tc.passed_current,
        tc.passed_any,
        tc.attempts
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN LATERAL (
        SELECT
          MAX(score) FILTER (WHERE assessment_hash = a.assessment_hash) AS best_score_current,
          BOOL_OR(passed) FILTER (WHERE assessment_hash = a.assessment_hash) AS passed_current,
          BOOL_OR(passed) AS passed_any,
          COUNT(*)::int AS attempts
        FROM training_completions
        WHERE article_id = a.id AND user_id = $2
      ) tc ON true
      WHERE a.organization_id = $1
        AND a.article_type = 'training'
        AND a.status = 'published'
        AND a.assessment IS NOT NULL
        AND (a.is_deleted IS NULL OR a.is_deleted = false)
        AND kb_article_owes(a.id, $2) = true
      ORDER BY a.created_at ASC
      LIMIT 20
    `, [orgId, userId])

    const articles = result.rows
    const total = articles.length
    const completed = articles.filter((a: any) => a.passed_current === true).length

    return NextResponse.json({
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      articles: articles.map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        category_slug: a.category_slug,
        passing_score: parseFloat(a.passing_score) || 80,
        best_score: a.best_score_current !== null ? parseFloat(a.best_score_current) : null,
        passed: a.passed_current === true,
        // True when user passed an older version but the quiz has changed
        needs_retake: a.passed_any === true && a.passed_current !== true,
        attempts: a.attempts || 0,
      })),
    })
  } catch (error) {
    console.error('Training progress fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch training progress' }, { status: 500 })
  }
}
