import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import ArticleEditorForm, { type ArticleInitial } from '@/components/kb/ArticleEditorForm'

/**
 * Server component: edit page for a KB article.
 *
 * Spec: openspec/changes/kb-quiz/proposal.md (D36, D37)
 * RBAC enforced server-side: author OR `settings` capability. Anything else
 * redirects to the detail page (avoids leaking the form for users who can
 * see the article but can't edit).
 *
 * Loads the FULL editable row (drafts included, all audience arrays) directly
 * from Postgres so the form is hydrated with real values; the client form
 * only needs to PUT changes back.
 */
export default async function EditKBArticlePage({
  params,
}: {
  params: Promise<{ slug: string; articleSlug: string }>
}) {
  const { slug, articleSlug } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/portal/login')

  // Resolve the *application* user id (UUID) from the session email. The
  // Better Auth session.user.id is a Better Auth identifier (a non-UUID string),
  // and feeding it into UUID-typed queries (hasCapabilityOrAdmin, author_id
  // comparison) throws `invalid input syntax for type uuid`.
  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) redirect('/portal/login')

  const orgId = await getOrgId()

  const result = await pool.query(
    `SELECT id, title, slug, summary, content, category_id, visibility, status,
            tags, article_type, assessment_dsl, passing_score, author_id,
            visible_to_roles, visible_to_companies, visible_to_locations,
            visible_to_departments, visible_to_job_titles, visible_to_employment_types,
            required_for_audience_kind,
            required_for_roles, required_for_companies, required_for_locations,
            required_for_departments, required_for_job_titles, required_for_employment_types,
            required_for_contact_groups
       FROM kb_articles
      WHERE organization_id = $1 AND slug = $2 AND is_deleted = false
      LIMIT 1`,
    [orgId, articleSlug]
  )

  if (result.rows.length === 0) notFound()
  const row = result.rows[0]

  const isAuthor = row.author_id && row.author_id === userId
  const canEdit = isAuthor || (await hasCapabilityOrAdmin(userId, 'settings'))
  if (!canEdit) {
    redirect(`/portal/kb/${slug}/${articleSlug}`)
  }

  const initial: ArticleInitial = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    category_id: row.category_id,
    visibility: row.visibility,
    status: row.status,
    tags: row.tags,
    article_type: row.article_type,
    assessment_dsl: row.assessment_dsl,
    passing_score: row.passing_score,
    visible_to_roles: row.visible_to_roles,
    visible_to_companies: row.visible_to_companies,
    visible_to_locations: row.visible_to_locations,
    visible_to_departments: row.visible_to_departments,
    visible_to_job_titles: row.visible_to_job_titles,
    visible_to_employment_types: row.visible_to_employment_types,
    required_for_audience_kind: row.required_for_audience_kind,
    required_for_roles: row.required_for_roles,
    required_for_companies: row.required_for_companies,
    required_for_locations: row.required_for_locations,
    required_for_departments: row.required_for_departments,
    required_for_job_titles: row.required_for_job_titles,
    required_for_employment_types: row.required_for_employment_types,
    required_for_contact_groups: row.required_for_contact_groups,
  }

  return <ArticleEditorForm mode="edit" initial={initial} detailSlug={slug} />
}
