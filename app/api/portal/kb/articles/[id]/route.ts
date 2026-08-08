import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { parseAssessmentDSL } from '@/lib/assessment-parser'
import { z } from 'zod'

// PUT body schema — all fields optional (partial update). The shape mirrors
// the POST schema in articles/route.ts; keeping them in lock-step is a
// maintenance hazard but cheaper than the abstraction (Phase 1a is supposed
// to land in ~1d). Refactor to a shared schema module if a 3rd consumer
// ever appears.
const updateArticleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().max(255).optional(),
  summary: z.string().max(2000).optional(),
  content: z.string().min(1).optional(),
  category_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['public', 'authenticated', 'internal', 'private']).optional(),
  status: z.enum(['draft', 'published', 'review']).optional(),
  tags: z.array(z.string()).optional(),
  article_type: z.enum(['standard', 'policy', 'procedure', 'training']).optional(),
  assessment_dsl: z.string().nullable().optional(),
  passing_score: z.number().min(0).max(100).optional(),
  visible_to_roles: z.array(z.string().uuid()).optional(),
  visible_to_companies: z.array(z.string().uuid()).optional(),
  visible_to_locations: z.array(z.string().uuid()).optional(),
  visible_to_departments: z.array(z.string().uuid()).optional(),
  visible_to_job_titles: z.array(z.string().uuid()).optional(),
  visible_to_employment_types: z.array(z.string().uuid()).optional(),
  visible_to_contact_groups: z.array(z.string().uuid()).optional(),
  required_for_audience_kind: z.enum(['none', 'internal', 'targeted']).optional(),
  required_for_roles: z.array(z.string().uuid()).optional(),
  required_for_companies: z.array(z.string().uuid()).optional(),
  required_for_locations: z.array(z.string().uuid()).optional(),
  required_for_departments: z.array(z.string().uuid()).optional(),
  required_for_job_titles: z.array(z.string().uuid()).optional(),
  required_for_employment_types: z.array(z.string().uuid()).optional(),
  required_for_contact_groups: z.array(z.string().uuid()).optional(),
})

// kb-quiz D37 RBAC: author OR `settings` capability.
async function canEditArticle(userId: string, authorId: string | null): Promise<boolean> {
  if (authorId && userId === authorId) return true
  return hasCapabilityOrAdmin(userId, 'settings')
}

/**
 * GET /api/portal/kb/articles/[id]
 * Single-article fetch by id (used by the edit page to populate the form).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: _request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId()
  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const result = await pool.query(
    `SELECT * FROM kb_articles WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
    [id, orgId]
  )
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  const article = result.rows[0]

  // Authorization (kb-attestations Phase 2, §3.3): this editor-fetch returns RAW
  // article source (for the edit form), so gate on EDIT rights — author OR the
  // settings capability — NOT on visibility. 404 (not 403) on no-entitlement,
  // matching the public route's non-enumeration convention. Previously this
  // returned any article (private included, raw source included) to ANY
  // authenticated user.
  if (!(await canEditArticle(userId, article.author_id))) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  return NextResponse.json({ article })
}

/**
 * PUT /api/portal/kb/articles/[id]
 * kb-quiz Phase 1a (D36, D37): partial update of an existing article.
 *
 * RBAC: author OR `settings` capability. Anything else → 403.
 *
 * If `assessment_dsl` is supplied AND the article is `training`, we re-parse
 * the DSL into structured `assessment` and let the BEFORE-UPDATE trigger
 * (migration 082) recompute `assessment_hash`. Reports filter on
 * `tc.assessment_hash = ka.assessment_hash` so prior pass states naturally
 * invalidate when the quiz changes (D38).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // App users.id (UUID), resolved from the session email — session.user.id is a
  // Better Auth id (non-UUID) and would throw in the UUID-typed queries below.
  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId()
  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const parsed = updateArticleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Load the current article — also doubles as existence + org scope check.
    const existing = await pool.query(
      `SELECT id, author_id, article_type, assessment_dsl, passing_score, slug
         FROM kb_articles
        WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [id, orgId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    const current = existing.rows[0]

    if (!(await canEditArticle(userId, current.author_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = parsed.data

    // Validate 'targeted' has at least one axis populated (mirrors POST).
    if (data.required_for_audience_kind === 'targeted') {
      const hasTarget =
        (data.required_for_roles?.length || 0) > 0 ||
        (data.required_for_companies?.length || 0) > 0 ||
        (data.required_for_locations?.length || 0) > 0 ||
        (data.required_for_departments?.length || 0) > 0 ||
        (data.required_for_job_titles?.length || 0) > 0 ||
        (data.required_for_employment_types?.length || 0) > 0 ||
        (data.required_for_contact_groups?.length || 0) > 0
      if (!hasTarget) {
        return NextResponse.json(
          { error: 'Targeted audience requires at least one axis' },
          { status: 400 }
        )
      }
    }

    if (data.visibility === 'private') {
      const hasAudience =
        (data.visible_to_roles?.length || 0) > 0 ||
        (data.visible_to_companies?.length || 0) > 0 ||
        (data.visible_to_locations?.length || 0) > 0 ||
        (data.visible_to_departments?.length || 0) > 0 ||
        (data.visible_to_job_titles?.length || 0) > 0 ||
        (data.visible_to_employment_types?.length || 0) > 0 ||
        (data.visible_to_contact_groups?.length || 0) > 0
      if (!hasAudience) {
        return NextResponse.json(
          { error: 'Private articles must have at least one audience rule' },
          { status: 400 }
        )
      }
    }

    // Slug uniqueness check (only if slug changed)
    if (data.slug && data.slug !== current.slug) {
      const dup = await pool.query(
        `SELECT id FROM kb_articles
          WHERE organization_id = $1 AND slug = $2 AND id <> $3 AND is_deleted = false`,
        [orgId, data.slug, id]
      )
      if (dup.rows.length > 0) {
        return NextResponse.json(
          { error: 'An article with this slug already exists' },
          { status: 409 }
        )
      }
    }

    // Build dynamic UPDATE — only touch fields the client supplied.
    const sets: string[] = []
    const values: unknown[] = []
    let p = 1
    const set = (col: string, val: unknown) => {
      sets.push(`${col} = $${p++}`)
      values.push(val)
    }

    if (data.title !== undefined) set('title', data.title.trim())
    if (data.slug !== undefined) set('slug', data.slug)
    if (data.summary !== undefined) set('summary', data.summary?.trim() || '')
    if (data.content !== undefined) {
      set('content', data.content)
      // Re-derive plain text for search index.
      const contentPlain = data.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      set('content_plain', contentPlain)
    }
    if (data.category_id !== undefined) set('category_id', data.category_id || null)
    if (data.visibility !== undefined) set('visibility', data.visibility)
    if (data.status !== undefined) {
      set('status', data.status)
      // Stamp published_at when transitioning to published.
      if (data.status === 'published') sets.push(`published_at = COALESCE(published_at, NOW())`)
    }
    if (data.tags !== undefined) set('tags', data.tags)

    // Article type and the policy/training derived flags
    const effectiveType = data.article_type ?? current.article_type
    if (data.article_type !== undefined) {
      set('article_type', data.article_type)
      set('requires_acknowledgment', data.article_type === 'policy')
    }

    // Assessment DSL — re-parse if supplied. Setting assessment_dsl to null
    // explicitly clears the assessment too (e.g., article_type changed away
    // from training).
    if (data.assessment_dsl !== undefined) {
      if (data.assessment_dsl === null || data.assessment_dsl === '') {
        set('assessment_dsl', null)
        set('assessment', null)
      } else if (effectiveType === 'training') {
        const passingScore = data.passing_score ?? current.passing_score ?? 80
        const parseResult = parseAssessmentDSL(data.assessment_dsl, passingScore)
        if (!parseResult.success) {
          return NextResponse.json(
            { error: 'Assessment DSL validation failed', details: parseResult.errors },
            { status: 400 }
          )
        }
        set('assessment_dsl', data.assessment_dsl)
        set('assessment', JSON.stringify(parseResult.data))
      } else {
        // DSL supplied but article isn't training — store DSL but don't parse.
        set('assessment_dsl', data.assessment_dsl)
      }
    }
    if (data.passing_score !== undefined) set('passing_score', data.passing_score)

    // Audience arrays (visibility + required_for_*) — pass-through
    const arrayFields = [
      'visible_to_roles', 'visible_to_companies', 'visible_to_locations',
      'visible_to_departments', 'visible_to_job_titles', 'visible_to_employment_types',
      'visible_to_contact_groups',
      'required_for_roles', 'required_for_companies', 'required_for_locations',
      'required_for_departments', 'required_for_job_titles', 'required_for_employment_types',
      'required_for_contact_groups',
    ] as const
    for (const f of arrayFields) {
      if (data[f] !== undefined) set(f, data[f])
    }
    if (data.required_for_audience_kind !== undefined) {
      set('required_for_audience_kind', data.required_for_audience_kind)
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    sets.push(`updated_at = NOW()`)
    values.push(id, orgId)

    const sql = `
      UPDATE kb_articles SET ${sets.join(', ')}
       WHERE id = $${p++} AND organization_id = $${p++} AND is_deleted = false
       RETURNING id, title, slug, status, article_type, assessment_hash, updated_at
    `
    const result = await pool.query(sql, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Re-queue embedding generation if content changed.
    if (data.content !== undefined) {
      try {
        const { queueEmbeddingJob } = await import('@/lib/queue')
        await queueEmbeddingJob('kb_articles', id, orgId)
      } catch {
        // Non-blocking — embeddings can lag.
      }
    }

    return NextResponse.json({ article: result.rows[0] })
  } catch (error) {
    console.error('Update article failed:', error)
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }
}

/**
 * DELETE /api/portal/kb/articles/[id]
 * Soft delete — sets is_deleted = true. Same RBAC as PUT.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // App users.id (UUID), resolved from the session email — session.user.id is a
  // Better Auth id (non-UUID) and would throw in the UUID-typed queries below.
  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId()
  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const existing = await pool.query(
      `SELECT id, author_id FROM kb_articles
        WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [id, orgId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    if (!(await canEditArticle(userId, existing.rows[0].author_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await pool.query(
      `UPDATE kb_articles SET is_deleted = true, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete article failed:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
