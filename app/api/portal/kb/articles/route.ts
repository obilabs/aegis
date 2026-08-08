import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { parseAssessmentDSL } from '@/lib/assessment-parser'
import { z } from 'zod'

const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  slug: z.string().max(255).optional(),
  summary: z.string().max(2000).optional(),
  content: z.string().min(1, 'Content is required'),
  category_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['public', 'authenticated', 'internal', 'private']).default('internal'),
  status: z.enum(['draft', 'published', 'review']).default('draft'),
  tags: z.array(z.string()).optional(),
  article_type: z.enum(['standard', 'policy', 'procedure', 'training']).default('standard'),
  assessment_dsl: z.string().optional(),
  passing_score: z.number().min(0).max(100).default(80),
  visible_to_roles: z.array(z.string().uuid()).optional(),
  visible_to_companies: z.array(z.string().uuid()).optional(),
  visible_to_locations: z.array(z.string().uuid()).optional(),
  visible_to_departments: z.array(z.string().uuid()).optional(),
  visible_to_job_titles: z.array(z.string().uuid()).optional(),
  visible_to_employment_types: z.array(z.string().uuid()).optional(),
  visible_to_contact_groups: z.array(z.string().uuid()).optional(),
  // policy-audience (migration 081): targeted ack/quiz audiences,
  // separate from read-visibility. 3 modes:
  //   'none'     — informational; nobody owes an ack
  //   'internal' — all employees (contact_type = 'employee'); default
  //   'targeted' — match any required_for_* axis
  required_for_audience_kind: z.enum(['none', 'internal', 'targeted']).optional(),
  required_for_roles: z.array(z.string().uuid()).optional(),
  required_for_companies: z.array(z.string().uuid()).optional(),
  required_for_locations: z.array(z.string().uuid()).optional(),
  required_for_departments: z.array(z.string().uuid()).optional(),
  required_for_job_titles: z.array(z.string().uuid()).optional(),
  required_for_employment_types: z.array(z.string().uuid()).optional(),
  required_for_contact_groups: z.array(z.string().uuid()).optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  // Authorization (audit 2026-07-23): authoring a KB article is a content-
  // management action — matches the [id] route's canEditArticle('settings').
  const ctx = await getAuthContext(request)
  if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
    return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = createArticleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const {
      title, slug, summary, content, category_id, visibility, status, tags,
      article_type, assessment_dsl, passing_score,
      visible_to_roles, visible_to_companies, visible_to_locations,
      visible_to_departments, visible_to_job_titles, visible_to_employment_types,
      visible_to_contact_groups,
      required_for_audience_kind, required_for_roles, required_for_companies,
      required_for_locations, required_for_departments, required_for_job_titles,
      required_for_employment_types, required_for_contact_groups,
    } = parsed.data

    // Validate 'targeted' audience has at least one axis populated
    if (required_for_audience_kind === 'targeted') {
      const hasTarget = (required_for_roles?.length || 0) > 0
        || (required_for_companies?.length || 0) > 0
        || (required_for_locations?.length || 0) > 0
        || (required_for_departments?.length || 0) > 0
        || (required_for_job_titles?.length || 0) > 0
        || (required_for_employment_types?.length || 0) > 0
        || (required_for_contact_groups?.length || 0) > 0
      if (!hasTarget) {
        return NextResponse.json({
          error: "Targeted audience requires at least one axis (role / department / job title / employment type / company / location / contact group)",
        }, { status: 400 })
      }
    }

    // Validate private articles have at least one visible_to_* field
    if (visibility === 'private') {
      const hasAudience = (visible_to_roles?.length || 0) > 0
        || (visible_to_companies?.length || 0) > 0
        || (visible_to_locations?.length || 0) > 0
        || (visible_to_departments?.length || 0) > 0
        || (visible_to_job_titles?.length || 0) > 0
        || (visible_to_employment_types?.length || 0) > 0
        || (visible_to_contact_groups?.length || 0) > 0

      if (!hasAudience) {
        return NextResponse.json({
          error: 'Private articles must have at least one audience rule (roles, companies, locations, departments, job titles, employment types, or contact groups)',
        }, { status: 400 })
      }
    }

    // Generate slug if not provided
    const articleSlug = slug || title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)

    // Check slug uniqueness
    const existingSlug = await pool.query(
      'SELECT id FROM kb_articles WHERE organization_id = $1 AND slug = $2',
      [orgId, articleSlug]
    )
    if (existingSlug.rows.length > 0) {
      return NextResponse.json({ error: 'An article with this slug already exists' }, { status: 409 })
    }

    // Strip HTML tags for plain text search index
    const contentPlain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    const articleStatus = status || 'draft'
    const publishedAt = articleStatus === 'published' ? 'NOW()' : 'NULL'
    const type = article_type || 'standard'
    const requiresAck = type === 'policy'

    // Parse assessment DSL for training articles
    let parsedAssessment = null
    if (type === 'training' && assessment_dsl) {
      const parseResult = parseAssessmentDSL(assessment_dsl, passing_score || 80)
      if (!parseResult.success) {
        return NextResponse.json({
          error: 'Assessment DSL validation failed',
          details: parseResult.errors,
        }, { status: 400 })
      }
      parsedAssessment = parseResult.data
    }

    const result = await pool.query(`
      INSERT INTO kb_articles (
        organization_id, title, slug, summary, content, content_plain,
        category_id, visibility, status, tags,
        author_id, published_at,
        article_type, requires_acknowledgment,
        assessment, assessment_dsl, passing_score,
        visible_to_roles, visible_to_companies, visible_to_locations,
        visible_to_departments, visible_to_job_titles, visible_to_employment_types,
        visible_to_contact_groups,
        required_for_audience_kind,
        required_for_roles, required_for_companies, required_for_locations,
        required_for_departments, required_for_job_titles, required_for_employment_types,
        required_for_contact_groups
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, ${publishedAt},
        $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22,
        $23,
        $24,
        $25, $26, $27,
        $28, $29, $30,
        $31
      )
      RETURNING id, title, slug, status
    `, [
      orgId,
      title.trim(),
      articleSlug,
      summary?.trim() || '',
      content,
      contentPlain,
      category_id || null,
      visibility,
      articleStatus,
      tags || [],
      ctx.userId, // app users.id (UUID) — NOT session.user.id (Better Auth id)
      type,
      requiresAck,
      parsedAssessment ? JSON.stringify(parsedAssessment) : null,
      assessment_dsl || null,
      passing_score || 80,
      visible_to_roles || [],
      visible_to_companies || [],
      visible_to_locations || [],
      visible_to_departments || [],
      visible_to_job_titles || [],
      visible_to_employment_types || [],
      visible_to_contact_groups || [],
      required_for_audience_kind || 'internal',
      required_for_roles || [],
      required_for_companies || [],
      required_for_locations || [],
      required_for_departments || [],
      required_for_job_titles || [],
      required_for_employment_types || [],
      required_for_contact_groups || [],
    ])

    const article = result.rows[0]

    // Queue embedding generation (non-blocking)
    try {
      const { queueEmbeddingJob } = await import('@/lib/queue')
      await queueEmbeddingJob('kb_articles', article.id, orgId)
    } catch {
      // Embedding queue failure shouldn't block article creation
    }

    return NextResponse.json({
      article,
    }, { status: 201 })
  } catch (error) {
    console.error('Create article failed:', error)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  // Authorization (kb-attestations Phase 2, §3.2): this management list returns
  // drafts + every status + is_system, so it is an AUTHORING surface — gate on
  // the settings capability, matching POST and the [id] route. Previously it
  // returned every org article (including private/internal drafts) to ANY
  // authenticated user, regardless of visibility.
  const ctx = await getAuthContext(request)
  if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
    return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)

    let statusFilter = ''
    const params: any[] = [orgId, limit]

    if (status && status !== 'all') {
      statusFilter = `AND a.status = $3`
      params.push(status)
    }

    const result = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.status,
        a.visibility,
        a.view_count,
        a.is_system,
        a.created_at,
        a.updated_at,
        a.published_at,
        c.name as category_name,
        c.slug as category_slug
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = $1
        ${statusFilter}
      ORDER BY a.updated_at DESC
      LIMIT $2
    `, params)

    return NextResponse.json({
      articles: result.rows,
    })
  } catch (error) {
    console.error('List articles failed:', error)
    return NextResponse.json({ error: 'Failed to list articles' }, { status: 500 })
  }
}
