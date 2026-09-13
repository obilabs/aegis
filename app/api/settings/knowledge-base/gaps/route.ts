import { NextRequest, NextResponse } from 'next/server'
import { requireCapability } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'

/**
 * GET /api/settings/knowledge-base/gaps
 * List KB gaps sorted by occurrence_count DESC.
 * Filterable by status query param.
 * Admin/helpdesk only.
 */
export async function GET(request: NextRequest) {
  const guard = await requireCapability(request, 'settings')
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    // Check admin or helpdesk role
    if (!session.user.role || !['admin', 'helpdesk'].includes(session.user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    let whereClause = 'WHERE g.organization_id = $1'
    const params: any[] = [orgId]
    let paramIdx = 2

    if (statusFilter && ['open', 'draft_created', 'resolved', 'dismissed'].includes(statusFilter)) {
      whereClause += ` AND g.status = $${paramIdx++}`
      params.push(statusFilter)
    }

    params.push(limit)
    params.push(offset)

    const gaps = await query<{
      id: string
      topic: string
      occurrence_count: number
      sample_questions: string[]
      search_queries: string[]
      status: string
      draft_article_id: string | null
      draft_article_title: string | null
      first_seen_at: string
      last_seen_at: string
      created_at: string
    }>(
      `SELECT
        g.id,
        g.topic,
        g.occurrence_count,
        g.sample_questions,
        g.search_queries,
        g.status,
        g.draft_article_id,
        kb.title as draft_article_title,
        g.first_seen_at,
        g.last_seen_at,
        g.created_at
       FROM kb_gaps g
       LEFT JOIN kb_articles kb ON g.draft_article_id = kb.id
       ${whereClause}
       ORDER BY g.occurrence_count DESC, g.last_seen_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    )

    // Get stats
    const stats = await queryOne<{
      total_open: string
      total_draft_created: string
      total_resolved: string
      total_dismissed: string
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'open') as total_open,
        COUNT(*) FILTER (WHERE status = 'draft_created') as total_draft_created,
        COUNT(*) FILTER (WHERE status = 'resolved') as total_resolved,
        COUNT(*) FILTER (WHERE status = 'dismissed') as total_dismissed
       FROM kb_gaps
       WHERE organization_id = $1`,
      [orgId]
    )

    return NextResponse.json({
      success: true,
      data: gaps,
      stats: {
        total_open: parseInt(stats?.total_open || '0'),
        total_draft_created: parseInt(stats?.total_draft_created || '0'),
        total_resolved: parseInt(stats?.total_resolved || '0'),
        total_dismissed: parseInt(stats?.total_dismissed || '0'),
      },
    })
  } catch (error) {
    console.error('Error fetching KB gaps:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch KB gaps' },
      { status: 500 }
    )
  }
}
