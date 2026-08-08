import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/tickets/[id]/links
 * Fetch all linked entities for a ticket, grouped by type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const orgId = await getOrgId()

    // Verify ticket exists and belongs to this org
    const ticketCheck = await pool.query(
      'SELECT id FROM tickets WHERE id = $1 AND organization_id = $2',
      [ticketId, orgId]
    )
    if (ticketCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Fetch all linked entities in parallel
    const [assetsResult, relationsResult, kbResult, documentsResult] = await Promise.all([
      // Linked assets (via ticket_assets)
      pool.query(`
        SELECT
          ta.id as link_id,
          ta.is_primary,
          ta.notes,
          ta.created_at as linked_at,
          a.id,
          a.name,
          a.asset_tag,
          a.status,
          at.name as type_name
        FROM ticket_assets ta
        JOIN assets a ON ta.asset_id = a.id
        LEFT JOIN asset_types at ON a.type_id = at.id
        WHERE ta.ticket_id = $1
        ORDER BY ta.is_primary DESC, a.name ASC
      `, [ticketId]),

      // Linked tickets (via ticket_relations — both directions)
      pool.query(`
        SELECT
          tr.id as link_id,
          tr.relation_type,
          tr.created_at as linked_at,
          'outgoing' as direction,
          t.id,
          t.ticket_number,
          t.prefix,
          t.subject,
          t.priority,
          ts.name as status,
          ts.color as status_color,
          tt.name as type_name
        FROM ticket_relations tr
        JOIN tickets t ON tr.target_ticket_id = t.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        LEFT JOIN ticket_types tt ON t.type_id = tt.id
        WHERE tr.source_ticket_id = $1 AND tr.organization_id = $2

        UNION ALL

        SELECT
          tr.id as link_id,
          tr.relation_type,
          tr.created_at as linked_at,
          'incoming' as direction,
          t.id,
          t.ticket_number,
          t.prefix,
          t.subject,
          t.priority,
          ts.name as status,
          ts.color as status_color,
          tt.name as type_name
        FROM ticket_relations tr
        JOIN tickets t ON tr.source_ticket_id = t.id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        LEFT JOIN ticket_types tt ON t.type_id = tt.id
        WHERE tr.target_ticket_id = $1 AND tr.organization_id = $2

        ORDER BY linked_at DESC
      `, [ticketId, orgId]),

      // Linked KB articles
      pool.query(`
        SELECT
          tkl.id as link_id,
          tkl.link_type,
          tkl.created_at as linked_at,
          a.id,
          a.title,
          a.slug,
          a.summary,
          c.name as category_name,
          c.slug as category_slug
        FROM ticket_kb_links tkl
        JOIN kb_articles a ON tkl.kb_article_id = a.id
        LEFT JOIN kb_categories c ON a.category_id = c.id
        WHERE tkl.ticket_id = $1 AND tkl.organization_id = $2
        ORDER BY tkl.created_at DESC
      `, [ticketId, orgId]),

      // Linked documents
      pool.query(`
        SELECT
          tdl.id as link_id,
          tdl.link_type,
          tdl.created_at as linked_at,
          d.id,
          d.title
        FROM ticket_document_links tdl
        JOIN documents d ON tdl.document_id = d.id
        WHERE tdl.ticket_id = $1 AND tdl.organization_id = $2
        ORDER BY tdl.created_at DESC
      `, [ticketId, orgId]),
    ])

    return NextResponse.json({
      assets: assetsResult.rows,
      tickets: relationsResult.rows,
      kb_articles: kbResult.rows,
      documents: documentsResult.rows,
    })
  } catch (error) {
    console.error('Error fetching ticket links:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket links' }, { status: 500 })
  }
}

/**
 * POST /api/portal/tickets/[id]/links
 * Add a link between a ticket and another entity.
 * Body: { targetType: 'asset'|'ticket'|'kb_article'|'document', targetId: string, linkType?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const orgId = await getOrgId()
    const userId = await getUserId(session.user.email)
    const body = await request.json()

    const { targetType, targetId, linkType } = body

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      )
    }

    // Verify ticket exists and belongs to this org
    const ticketCheck = await pool.query(
      'SELECT id FROM tickets WHERE id = $1 AND organization_id = $2',
      [ticketId, orgId]
    )
    if (ticketCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    switch (targetType) {
      case 'asset': {
        // Verify asset exists in this org
        const assetCheck = await pool.query(
          'SELECT id FROM assets WHERE id = $1 AND organization_id = $2',
          [targetId, orgId]
        )
        if (assetCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
        }
        await pool.query(
          `INSERT INTO ticket_assets (ticket_id, asset_id, created_by)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [ticketId, targetId, userId]
        )
        break
      }

      case 'ticket': {
        // Verify target ticket exists in this org
        const targetCheck = await pool.query(
          'SELECT id FROM tickets WHERE id = $1 AND organization_id = $2',
          [targetId, orgId]
        )
        if (targetCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Target ticket not found' }, { status: 404 })
        }
        if (targetId === ticketId) {
          return NextResponse.json({ error: 'Cannot link a ticket to itself' }, { status: 400 })
        }
        const relationType = linkType || 'related'
        await pool.query(
          `INSERT INTO ticket_relations (organization_id, source_ticket_id, target_ticket_id, relation_type, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ON CONSTRAINT ticket_relations_unique DO NOTHING`,
          [orgId, ticketId, targetId, relationType, userId]
        )
        break
      }

      case 'kb_article': {
        // Verify KB article exists in this org
        const kbCheck = await pool.query(
          'SELECT id FROM kb_articles WHERE id = $1 AND organization_id = $2',
          [targetId, orgId]
        )
        if (kbCheck.rows.length === 0) {
          return NextResponse.json({ error: 'KB article not found' }, { status: 404 })
        }
        const kbLinkType = linkType || 'reference'
        await pool.query(
          `INSERT INTO ticket_kb_links (organization_id, ticket_id, kb_article_id, link_type, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ON CONSTRAINT ticket_kb_links_unique DO NOTHING`,
          [orgId, ticketId, targetId, kbLinkType, userId]
        )
        break
      }

      case 'document': {
        // Verify document exists in this org
        const docCheck = await pool.query(
          'SELECT id FROM documents WHERE id = $1 AND organization_id = $2',
          [targetId, orgId]
        )
        if (docCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }
        const docLinkType = linkType || 'reference'
        await pool.query(
          `INSERT INTO ticket_document_links (organization_id, ticket_id, document_id, link_type, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ON CONSTRAINT ticket_document_links_unique DO NOTHING`,
          [orgId, ticketId, targetId, docLinkType, userId]
        )
        break
      }

      default:
        return NextResponse.json(
          { error: `Invalid targetType: ${targetType}. Must be one of: asset, ticket, kb_article, document` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Error adding ticket link:', error)
    return NextResponse.json({ error: 'Failed to add link' }, { status: 500 })
  }
}

/**
 * DELETE /api/portal/tickets/[id]/links
 * Remove a link between a ticket and another entity.
 * Body: { targetType: 'asset'|'ticket'|'kb_article'|'document', targetId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const orgId = await getOrgId()
    const body = await request.json()

    const { targetType, targetId } = body

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      )
    }

    switch (targetType) {
      case 'asset':
        await pool.query(
          'DELETE FROM ticket_assets WHERE ticket_id = $1 AND asset_id = $2',
          [ticketId, targetId]
        )
        break

      case 'ticket':
        // Delete in both directions (source→target and target→source)
        await pool.query(
          `DELETE FROM ticket_relations
           WHERE organization_id = $1
             AND ((source_ticket_id = $2 AND target_ticket_id = $3)
               OR (source_ticket_id = $3 AND target_ticket_id = $2))`,
          [orgId, ticketId, targetId]
        )
        break

      case 'kb_article':
        await pool.query(
          'DELETE FROM ticket_kb_links WHERE organization_id = $1 AND ticket_id = $2 AND kb_article_id = $3',
          [orgId, ticketId, targetId]
        )
        break

      case 'document':
        await pool.query(
          'DELETE FROM ticket_document_links WHERE organization_id = $1 AND ticket_id = $2 AND document_id = $3',
          [orgId, ticketId, targetId]
        )
        break

      default:
        return NextResponse.json(
          { error: `Invalid targetType: ${targetType}. Must be one of: asset, ticket, kb_article, document` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing ticket link:', error)
    return NextResponse.json({ error: 'Failed to remove link' }, { status: 500 })
  }
}
