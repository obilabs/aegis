import { NextRequest, NextResponse } from 'next/server'
import { requireCapability } from '@/lib/access'
import { auth } from '@/lib/auth'
import { pool, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'

/**
 * GET /api/portal/banners
 * Returns which banners the current user should see.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    // Get user's dismissed banners
    const user = await queryOne<{ dismissed_banners: string[] }>(
      `SELECT dismissed_banners FROM users WHERE organization_id = $1 AND email = $2`,
      [orgId, session.user.email]
    )
    const dismissed = user?.dismissed_banners || []

    const banners: { id: string; type: string; title: string; description: string; link?: string; linkText?: string }[] = []

    // Welcome policy review banner
    if (!dismissed.includes('welcome_policy_review')) {
      // Only show if policies exist
      const policyCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM kb_articles
         WHERE organization_id = $1
           AND requires_acknowledgment = true
           AND status = 'published'
           AND is_deleted = false`,
        [orgId]
      )
      if (parseInt(policyCount?.count || '0', 10) > 0) {
        banners.push({
          id: 'welcome_policy_review',
          type: 'info',
          title: 'Welcome! Review your organization\'s policies',
          description: 'Take a few minutes to read and acknowledge the important policies that apply to your role.',
          link: '/portal/kb/policies-procedures',
          linkText: 'View Policies',
        })
      }
    }

    return NextResponse.json({ banners })
  } catch (error) {
    console.error('Banners fetch failed:', error)
    return NextResponse.json({ banners: [] })
  }
}

/**
 * POST /api/portal/banners
 * Dismiss a banner by ID.
 */
export async function POST(request: NextRequest) {
  const guard = await requireCapability(request, 'settings')
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const { banner_id } = await request.json()
    if (!banner_id || typeof banner_id !== 'string') {
      return NextResponse.json({ error: 'banner_id required' }, { status: 400 })
    }

    await pool.query(
      `UPDATE users
       SET dismissed_banners = array_append(
         COALESCE(dismissed_banners, '{}'),
         $1
       )
       WHERE organization_id = $2
         AND email = $3
         AND NOT ($1 = ANY(COALESCE(dismissed_banners, '{}')))`,
      [banner_id, orgId, session.user.email]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Banner dismiss failed:', error)
    return NextResponse.json({ error: 'Failed to dismiss banner' }, { status: 500 })
  }
}
