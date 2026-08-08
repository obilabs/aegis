import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'

/**
 * Helper to get the contact_id linked to a user, if any.
 */
async function getUserContactId(userId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT contact_id FROM users WHERE id = $1',
    [userId]
  )
  return result.rows[0]?.contact_id || null
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { session, userId, orgId } = ctx
  const contactId = await getUserContactId(userId)

  try {
    // Get categories with article counts
    // Include private articles the user is entitled to in the count
    const categoriesResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.icon,
        COUNT(a.id) FILTER (
          WHERE a.status = 'published'
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
          AND a.is_deleted = false
          AND (
            a.visibility IN ('public', 'internal', 'authenticated')
            OR (
              a.visibility = 'private'
              AND (
                ($2::uuid IS NOT NULL AND a.visible_to_roles && ARRAY[(SELECT role_id FROM users WHERE id = $2)])
                OR EXISTS (
                  SELECT 1 FROM contacts ct
                  WHERE ct.id = $3
                  AND (
                    (ct.company_id IS NOT NULL AND ct.company_id = ANY(a.visible_to_companies))
                    OR (ct.location_id IS NOT NULL AND ct.location_id = ANY(a.visible_to_locations))
                    OR (ct.department_id IS NOT NULL AND ct.department_id = ANY(a.visible_to_departments))
                    OR (ct.job_title_id IS NOT NULL AND ct.job_title_id = ANY(a.visible_to_job_titles))
                    OR (ct.employment_type_id IS NOT NULL AND ct.employment_type_id = ANY(a.visible_to_employment_types))
                  )
                )
                OR ($3::uuid IS NOT NULL AND array_length(a.visible_to_contact_groups, 1) IS NOT NULL
                    AND EXISTS (
                      SELECT 1 FROM contact_group_members cgm
                      WHERE cgm.contact_id = $3
                      AND cgm.group_id = ANY(a.visible_to_contact_groups)
                    ))
              )
            )
          )
        ) as article_count
      FROM kb_categories c
      LEFT JOIN kb_articles a ON a.category_id = c.id AND a.organization_id = $1
      WHERE c.organization_id = $1
      GROUP BY c.id, c.name, c.slug, c.description, c.icon, c.display_order
      HAVING COUNT(a.id) FILTER (
        WHERE a.status = 'published'
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND a.is_deleted = false
        AND (
          a.visibility IN ('public', 'internal', 'authenticated')
          OR (
            a.visibility = 'private'
            AND (
              ($2::uuid IS NOT NULL AND a.visible_to_roles && ARRAY[(SELECT role_id FROM users WHERE id = $2)])
              OR EXISTS (
                SELECT 1 FROM contacts ct
                WHERE ct.id = $3
                AND (
                  (ct.company_id IS NOT NULL AND ct.company_id = ANY(a.visible_to_companies))
                  OR (ct.location_id IS NOT NULL AND ct.location_id = ANY(a.visible_to_locations))
                  OR (ct.department_id IS NOT NULL AND ct.department_id = ANY(a.visible_to_departments))
                  OR (ct.job_title_id IS NOT NULL AND ct.job_title_id = ANY(a.visible_to_job_titles))
                  OR (ct.employment_type_id IS NOT NULL AND ct.employment_type_id = ANY(a.visible_to_employment_types))
                )
              )
            )
          )
        )
      ) > 0
      ORDER BY c.display_order ASC
    `, [orgId, userId, contactId])

    // Get featured/popular articles (using search function for visibility)
    const featuredResult = await pool.query(`
      SELECT * FROM search_kb_articles_for_user($1, NULL, $2, $3, NULL, 6)
    `, [orgId, userId, contactId])

    // Sort by view_count desc for "featured"
    const featuredArticles = featuredResult.rows.sort(
      (a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)
    )

    // Get recently updated articles (using search function for visibility, sorted by date)
    const recentResult = await pool.query(`
      SELECT * FROM search_kb_articles_for_user($1, NULL, $2, $3, NULL, 10)
      ORDER BY updated_at DESC
    `, [orgId, userId, contactId])

    return NextResponse.json({
      categories: categoriesResult.rows,
      featuredArticles,
      recentArticles: recentResult.rows,
      // Whether this user may author/manage articles (settings capability or
      // admin) — drives the "New Article" / edit / delete controls in the UI.
      can_manage: await hasCapabilityOrAdmin(userId, 'settings'),
    })
  } catch (error) {
    console.error('Failed to fetch portal KB:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 })
  }
}
