import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const { id } = await params

  try {
    const policy = await queryOne(
      `SELECT
        ka.id,
        ka.title AS name,
        ka.summary AS description,
        ka.content,
        ka.article_type AS policy_type,
        kc.name AS category,
        ka.content_version::text AS version,
        ka.status,
        ka.published_at AS effective_date,
        ka.updated_at AS review_date,
        ka.requires_acknowledgment,
        ka.acknowledgment_required_by,
        ka.tags
      FROM kb_articles ka
      LEFT JOIN kb_categories kc ON ka.category_id = kc.id
      WHERE ka.id = $1
        AND ka.organization_id = $2
        AND ka.article_type = 'policy'
        AND ka.is_deleted = false`,
      [id, orgId]
    )

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    // Check if current user has acknowledged
    const ack = await queryOne(
      `SELECT id, acknowledged_at
       FROM kb_article_acknowledgments
       WHERE article_id = $1 AND user_id = $2`,
      [id, userId]
    )

    return NextResponse.json({
      policy: {
        ...policy,
        userAcknowledged: !!ack,
        userAcknowledgedAt: ack?.acknowledged_at || null,
      },
    })
  } catch (error) {
    console.error('Failed to fetch policy:', error)
    return NextResponse.json({ error: 'Failed to fetch policy' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const { id } = await params

  try {
    // Verify policy exists and belongs to org
    const policy = await queryOne(
      `SELECT id, content_version, requires_acknowledgment
       FROM kb_articles
       WHERE id = $1 AND organization_id = $2 AND article_type = 'policy' AND is_deleted = false`,
      [id, orgId]
    )

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    if (!policy.requires_acknowledgment) {
      return NextResponse.json({ error: 'Policy does not require acknowledgment' }, { status: 400 })
    }

    // Check if already acknowledged for current version
    const existing = await queryOne(
      `SELECT id FROM kb_article_acknowledgments
       WHERE article_id = $1 AND user_id = $2 AND article_version = $3`,
      [id, userId, policy.content_version]
    )

    if (existing) {
      return NextResponse.json({ message: 'Already acknowledged' })
    }

    // Record acknowledgment
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const ua = request.headers.get('user-agent') || ''

    await query(
      `INSERT INTO kb_article_acknowledgments (article_id, user_id, ip_address, user_agent, article_version)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, ip, ua, policy.content_version]
    )

    return NextResponse.json({ message: 'Acknowledged successfully' }, { status: 201 })
  } catch (error) {
    console.error('Failed to acknowledge policy:', error)
    return NextResponse.json({ error: 'Failed to acknowledge policy' }, { status: 500 })
  }
}
