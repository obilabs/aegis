import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

/**
 * GET /api/portal/kb/[slug]/training-status
 * Returns the current user's best attempt and attempt count for a training article.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const { userId, orgId } = ctx

  try {
    // Find the article
    const article = await queryOne<{
      id: string
      article_type: string
      assessment: unknown
      passing_score: number
    }>(
      `SELECT id, article_type, assessment, passing_score
       FROM kb_articles
       WHERE organization_id = $1 AND slug = $2 AND is_deleted = false`,
      [orgId, slug]
    )

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    if (article.article_type !== 'training') {
      return NextResponse.json({
        is_training: false,
        has_assessment: false,
      })
    }

    const hasAssessment = article.assessment && typeof article.assessment === 'object'

    // Get best attempt
    const best = await queryOne<{
      score: string
      passed: boolean
      attempt_number: number
      completed_at: string
    }>(
      `SELECT score, passed, attempt_number, completed_at
       FROM training_completions
       WHERE user_id = $1 AND article_id = $2
       ORDER BY score DESC, completed_at DESC
       LIMIT 1`,
      [userId, article.id]
    )

    // Get total attempts
    const count = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total
       FROM training_completions
       WHERE user_id = $1 AND article_id = $2`,
      [userId, article.id]
    )

    return NextResponse.json({
      is_training: true,
      has_assessment: !!hasAssessment,
      passing_score: article.passing_score,
      attempts: parseInt(count?.total || '0', 10),
      best_score: best ? parseFloat(best.score) : null,
      best_passed: best?.passed || false,
      best_attempt: best?.attempt_number || null,
      last_completed_at: best?.completed_at || null,
    })
  } catch (error) {
    console.error('Training status failed:', error)
    return NextResponse.json({ error: 'Failed to load training status' }, { status: 500 })
  }
}
