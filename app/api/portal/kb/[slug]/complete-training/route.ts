import { NextRequest, NextResponse } from 'next/server'
import { pool, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { scoreAssessment, ParsedAssessment } from '@/lib/assessment-parser'

/**
 * POST /api/portal/kb/[slug]/complete-training
 * Submit answers for a training assessment, score them, and record the completion.
 */
export async function POST(
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
    const body = await request.json()
    const { answers, time_spent_seconds } = body

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'answers required' }, { status: 400 })
    }

    // Find the article
    const article = await queryOne<{
      id: string
      article_type: string
      assessment: ParsedAssessment | null
      passing_score: number
    }>(
      `SELECT id, article_type, assessment, passing_score
       FROM kb_articles
       WHERE organization_id = $1 AND slug = $2 AND status = 'published' AND is_deleted = false`,
      [orgId, slug]
    )

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    if (article.article_type !== 'training') {
      return NextResponse.json({ error: 'Article is not a training article' }, { status: 400 })
    }

    if (!article.assessment || !article.assessment.questions?.length) {
      return NextResponse.json({ error: 'Article has no assessment' }, { status: 400 })
    }

    // Score the answers
    const assessment = {
      ...article.assessment,
      passing_score: article.passing_score || article.assessment.passing_score || 80,
    }
    const result = scoreAssessment(assessment, answers)

    // Get next attempt number
    const lastAttempt = await queryOne<{ max_attempt: number }>(
      `SELECT COALESCE(MAX(attempt_number), 0) as max_attempt
       FROM training_completions
       WHERE user_id = $1 AND article_id = $2`,
      [userId, article.id]
    )
    const attemptNumber = (lastAttempt?.max_attempt || 0) + 1

    // Record completion
    await pool.query(
      `INSERT INTO training_completions
        (organization_id, user_id, article_id, attempt_number, answers, total_questions,
         correct_answers, score, passed, passing_score, time_spent_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        orgId,
        userId,
        article.id,
        attemptNumber,
        JSON.stringify(answers),
        result.total,
        result.correct,
        result.score,
        result.passed,
        assessment.passing_score,
        time_spent_seconds || 0,
      ]
    )

    return NextResponse.json({
      score: result.score,
      passed: result.passed,
      correct: result.correct,
      total: result.total,
      attempt_number: attemptNumber,
      results: result.results,
    })
  } catch (error) {
    console.error('Training completion failed:', error)
    return NextResponse.json({ error: 'Failed to complete training' }, { status: 500 })
  }
}
