/**
 * Public KB Article API
 *
 * Returns a single article by slug.
 * Public/internal articles are available without auth.
 * Authenticated/private articles require a session and entitlement check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { toSafeHtml } from '@/lib/article-render'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    let orgId: string
    try {
      orgId = await getOrgId()
    } catch {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Try to get session (optional - public articles work without it)
    // Import auth lazily here to avoid removing the import used only in this block
    let session: any = null
    try {
      const { auth } = await import('@/lib/auth')
      session = await auth.api.getSession({ headers: request.headers })
    } catch {
      // No session is fine for public articles
    }

    // Get the article without visibility filter first
    const articleResult = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.content,
        a.content_format,
        a.category_id,
        a.visibility,
        a.visible_to_roles,
        a.visible_to_companies,
        a.visible_to_locations,
        a.visible_to_departments,
        a.visible_to_job_titles,
        a.visible_to_employment_types,
        a.visible_to_contact_groups,
        c.name as category_name,
        c.slug as category_slug,
        a.view_count,
        a.helpful_count,
        a.not_helpful_count,
        a.published_at,
        a.updated_at,
        a.tags,
        a.article_type,
        a.assessment,
        a.passing_score,
        a.requires_acknowledgment,
        a.content_version,
        a.author_id,
        COALESCE(u.first_name || ' ' || u.last_name, '') as author_name
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.organization_id = $1
        AND a.slug = $2
        AND a.status = 'published'
        AND a.is_deleted = false
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
    `, [orgId, slug])

    if (articleResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    const article = articleResult.rows[0]

    // Get user info if authenticated (needed for visibility checks and related articles)
    let userId: string | null = null
    let contactId: string | null = null

    if (session) {
      userId = await getUserId(session.user.email).catch(() => null)
      const userResult = await pool.query(
        'SELECT contact_id FROM users WHERE id = $1',
        [userId]
      )
      contactId = userResult.rows[0]?.contact_id || null
    }

    // Check visibility access
    if (article.visibility === 'public') {
      // Public articles are accessible to everyone
    } else if (article.visibility === 'internal') {
      // Internal articles require authentication
      if (!session) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
    } else if (article.visibility === 'authenticated') {
      // Authenticated articles require a session
      if (!session) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
    } else if (article.visibility === 'private') {
      // Private articles require session + entitlement check
      if (!session || !userId) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }

      // Get user's role_id
      const roleResult = await pool.query(
        'SELECT role_id FROM users WHERE id = $1',
        [userId]
      )
      const userRoleId = roleResult.rows[0]?.role_id

      let entitled = false

      // Check role access
      if (userRoleId && article.visible_to_roles?.length > 0) {
        if (article.visible_to_roles.includes(userRoleId)) {
          entitled = true
        }
      }

      // Check contact-based access
      if (!entitled && contactId) {
        const contactResult = await pool.query(
          'SELECT company_id, location_id, department_id, job_title_id, employment_type_id FROM contacts WHERE id = $1',
          [contactId]
        )
        const contact = contactResult.rows[0]
        if (contact) {
          if (contact.company_id && article.visible_to_companies?.includes(contact.company_id)) {
            entitled = true
          }
          if (!entitled && contact.location_id && article.visible_to_locations?.includes(contact.location_id)) {
            entitled = true
          }
          if (!entitled && contact.department_id && article.visible_to_departments?.includes(contact.department_id)) {
            entitled = true
          }
          if (!entitled && contact.job_title_id && article.visible_to_job_titles?.includes(contact.job_title_id)) {
            entitled = true
          }
          if (!entitled && contact.employment_type_id && article.visible_to_employment_types?.includes(contact.employment_type_id)) {
            entitled = true
          }
        }
      }

      // Check contact group membership
      if (!entitled && contactId && article.visible_to_contact_groups?.length > 0) {
        const groupCheck = await pool.query(
          `SELECT 1 FROM contact_group_members cgm
           WHERE cgm.contact_id = $1
           AND cgm.group_id = ANY($2::uuid[])
           LIMIT 1`,
          [contactId, article.visible_to_contact_groups]
        )
        if (groupCheck.rows.length > 0) {
          entitled = true
        }
      }

      if (!entitled) {
        // Return 404 instead of 403 to avoid confirming the article exists
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
    }

    // kb-quiz Phase 1a (D37): can the current user edit? Author OR `settings`.
    // Editable by the author, or by anyone with the settings capability / admin.
    // NOTE: must not gate on article.author_id being set — seeded/system
    // articles have a null author_id, and that previously left canEdit false so
    // even admins saw no Edit/Delete on them.
    let canEdit = false
    if (userId) {
      if (article.author_id && article.author_id === userId) {
        canEdit = true
      } else {
        const { hasCapabilityOrAdmin } = await import('@/lib/permissions')
        canEdit = await hasCapabilityOrAdmin(userId, 'settings')
      }
    }

    // Strip audience fields + author_id from response (internal metadata)
    const { visible_to_roles, visible_to_companies, visible_to_locations,
            visible_to_departments, visible_to_job_titles, visible_to_employment_types,
            visible_to_contact_groups, author_id, ...articleResponse } = article
    void visible_to_roles; void visible_to_companies; void visible_to_locations
    void visible_to_departments; void visible_to_job_titles; void visible_to_employment_types
    void visible_to_contact_groups; void author_id

    // Sanitize server-side so the client's dangerouslySetInnerHTML is defensible
    // (design §10.4). Never return raw kb_articles.content.
    const responsePayload = {
      ...articleResponse,
      content: toSafeHtml(article.content, article.content_format),
      can_edit: canEdit,
    }

    // Increment view count
    await pool.query(`
      UPDATE kb_articles
      SET view_count = view_count + 1
      WHERE id = $1
    `, [article.id])

    // Get related articles (respecting visibility for the current user)
    let relatedRows: any[]
    if (session && userId) {
      const relatedResult = await pool.query(`
        SELECT * FROM search_kb_articles_for_user($1, NULL, $2, $3, $4, 5)
      `, [orgId, userId, contactId, article.category_id])
      // Exclude current article and limit to 4
      relatedRows = relatedResult.rows.filter((r: any) => r.id !== article.id).slice(0, 4)
    } else {
      const relatedResult = await pool.query(`
        SELECT
          a.id,
          a.title,
          a.slug,
          a.summary,
          c.slug as category_slug
        FROM kb_articles a
        LEFT JOIN kb_categories c ON a.category_id = c.id
        WHERE a.organization_id = $1
          AND a.category_id = $2
          AND a.id != $3
          AND a.status = 'published'
          AND a.visibility = 'public'
          AND a.is_deleted = false
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ORDER BY a.view_count DESC
        LIMIT 4
      `, [orgId, article.category_id, article.id])
      relatedRows = relatedResult.rows
    }

    return NextResponse.json({
      article: responsePayload,
      relatedArticles: relatedRows,
    })
  } catch (error) {
    console.error('Failed to fetch article:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    )
  }
}
