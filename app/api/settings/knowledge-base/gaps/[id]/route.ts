import { NextRequest, NextResponse } from 'next/server'
import { requireCapability, requestAllows } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { z } from 'zod'

const PatchSchema = z.object({
  action: z.enum(['dismiss', 'create_draft', 'link_article']),
  article_id: z.string().uuid().optional(),
})

/**
 * PATCH /api/settings/knowledge-base/gaps/[id]
 * Perform an action on a KB gap: dismiss, create_draft, or link_article.
 * Admin/helpdesk only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability(request, 'settings')
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { id: gapId } = await params

    // Check admin or helpdesk role
    if (!(await requestAllows(request, { capability: 'triage' }))) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Verify gap exists and belongs to this org
    const gap = await queryOne<{
      id: string
      topic: string
      sample_questions: string[]
      occurrence_count: number
      status: string
      draft_article_id: string | null
    }>(
      'SELECT id, topic, sample_questions, occurrence_count, status, draft_article_id FROM kb_gaps WHERE id = $1 AND organization_id = $2',
      [gapId, orgId]
    )
    if (!gap) {
      return NextResponse.json(
        { success: false, error: 'Gap not found' },
        { status: 404 }
      )
    }

    const { action, article_id } = parsed.data

    switch (action) {
      case 'dismiss': {
        await query(
          `UPDATE kb_gaps SET status = 'dismissed', updated_at = NOW() WHERE id = $1`,
          [gapId]
        )
        return NextResponse.json({
          success: true,
          data: { id: gapId, status: 'dismissed' },
        })
      }

      case 'create_draft': {
        if (gap.draft_article_id) {
          return NextResponse.json(
            { success: false, error: 'Draft article already exists for this gap' },
            { status: 400 }
          )
        }

        // Create a draft KB article
        const slug = gap.topic
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80)
          + '-' + Date.now().toString(36)

        const questionsMarkdown = (gap.sample_questions || [])
          .map(q => `- ${q}`)
          .join('\n')

        const body = `# ${gap.topic}

> This article was created from KB Gap Detection. Users have asked about this topic ${gap.occurrence_count} time(s) without finding a matching article.

## Sample Questions

${questionsMarkdown || '- (no sample questions recorded)'}

## Suggested Content

*Replace this section with the actual answer. Use the sample questions above to understand what users are looking for.*

---

**Status:** Draft - Needs review and content before publishing.
`

        const article = await queryOne<{ id: string }>(
          `INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, visibility, source)
           VALUES ($1, $2, $3, $4, $5, 'draft', 'internal', 'ai_gap')
           RETURNING id`,
          [orgId, gap.topic, slug, body, body]
        )

        if (!article) {
          return NextResponse.json(
            { success: false, error: 'Failed to create draft article' },
            { status: 500 }
          )
        }

        await query(
          `UPDATE kb_gaps SET draft_article_id = $1, status = 'draft_created', updated_at = NOW() WHERE id = $2`,
          [article.id, gapId]
        )

        return NextResponse.json({
          success: true,
          data: {
            id: gapId,
            status: 'draft_created',
            draft_article_id: article.id,
          },
        })
      }

      case 'link_article': {
        if (!article_id) {
          return NextResponse.json(
            { success: false, error: 'article_id is required for link_article action' },
            { status: 400 }
          )
        }

        // Verify article exists and belongs to org
        const article = await queryOne<{ id: string }>(
          'SELECT id FROM kb_articles WHERE id = $1 AND organization_id = $2',
          [article_id, orgId]
        )
        if (!article) {
          return NextResponse.json(
            { success: false, error: 'Article not found' },
            { status: 404 }
          )
        }

        await query(
          `UPDATE kb_gaps SET draft_article_id = $1, status = 'resolved', updated_at = NOW() WHERE id = $2`,
          [article_id, gapId]
        )

        return NextResponse.json({
          success: true,
          data: {
            id: gapId,
            status: 'resolved',
            draft_article_id: article_id,
          },
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating KB gap:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update KB gap' },
      { status: 500 }
    )
  }
}
