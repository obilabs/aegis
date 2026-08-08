import { pool, query, queryOne } from '@/lib/db'
import { logAudit, getClientIp } from '@/lib/audit'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin, getTicketAccessFilter } from '@/lib/permissions'
import { logTicketFieldChanges, diffTicketFields, TRACKED_TICKET_FIELDS } from '@/lib/ticket-audit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // RBAC read scoping (audit 2026-07-23): the detail read was `WHERE t.id=$1`
    // with no org or ownership filter — any user could read any ticket by id
    // (the read-twin of the ticket-list leak). Scope to the caller's
    // ticket_access; a ticket outside it returns 404 (never leak existence).
    const access = await getTicketAccessFilter(ctx.userId, ctx.orgId, 't', 3)

    // Get ticket with all related data
    const ticketResult = await pool.query(`
      SELECT
        t.id,
        t.ticket_number,
        t.prefix,
        t.subject,
        t.description,
        t.priority,
        t.source,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        t.root_cause,
        t.resolution_steps,
        t.resolution_category,
        ts.name as status,
        ts.color as status_color,
        ts.base_status as status_base,
        tc.name as category,
        -- Contact
        c.id as contact_id,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.is_deleted as contact_is_deleted,
        -- Company
        cl.id as company_id,
        cl.name as company_name,
        -- Assigned user
        u.id as assigned_id,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_name,
        u.email as assigned_email,
        -- Creator (who opened the ticket)
        creator.id as creator_id,
        CONCAT(creator.first_name, ' ', creator.last_name) as creator_name,
        creator.email as creator_email,
        -- Asset
        a.id as asset_id,
        a.name as asset_name,
        a.asset_tag as asset_tag,
        -- Location
        l.id as location_id,
        l.name as location_name,
        -- Type & custom fields
        tt.name as type_name,
        t.custom_fields,
        COALESCE(t.is_scheduled, false) as is_scheduled,
        t.scheduled_for,
        t.scheduling_active_from,
        t.action_date_type,
        t.lead_time_days,
        t.organization_id
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN companies cl ON c.company_id = cl.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN assets a ON t.asset_id = a.id
      LEFT JOIN locations l ON t.location_id = l.id
      WHERE t.id = $1 AND t.organization_id = $2 ${access.clause}
    `, [id, ctx.orgId, ...access.params])

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const row = ticketResult.rows[0]
    const ticket = {
      id: row.id,
      ticket_number: row.ticket_number,
      prefix: row.prefix,
      subject: row.subject,
      description: row.description,
      status: row.status,
      status_color: row.status_color,
      status_base: row.status_base,
      priority: row.priority,
      category: row.category,
      source: row.source,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
      root_cause: row.root_cause,
      resolution_steps: row.resolution_steps,
      resolution_category: row.resolution_category,
      contact: row.contact_id ? {
        id: row.contact_id,
        first_name: row.contact_first_name,
        last_name: row.contact_last_name,
        email: row.contact_email,
        phone: row.contact_phone,
        is_deleted: row.contact_is_deleted || false,
      } : null,
      company: row.company_id ? {
        id: row.company_id,
        name: row.company_name,
      } : null,
      assigned_to: row.assigned_id ? {
        id: row.assigned_id,
        name: row.assigned_name,
        email: row.assigned_email,
      } : null,
      created_by: row.creator_id ? {
        id: row.creator_id,
        name: row.creator_name,
        email: row.creator_email,
      } : null,
      asset: row.asset_id ? {
        id: row.asset_id,
        name: row.asset_name,
        asset_tag: row.asset_tag,
      } : null,
      location: row.location_id ? {
        id: row.location_id,
        name: row.location_name,
      } : null,
      type_name: row.type_name || null,
      custom_fields: row.custom_fields || {},
      scheduling: {
        is_scheduled: row.is_scheduled || false,
        scheduled_for: row.scheduled_for || null,
        scheduling_active_from: row.scheduling_active_from || null,
        action_date_type: row.action_date_type || 'complete_by',
        lead_time_days: row.lead_time_days || 3,
        is_actionable: !row.is_scheduled || !row.scheduling_active_from || new Date(row.scheduling_active_from) <= new Date(),
      },
    }

    // Get replies
    const repliesResult = await pool.query(`
      SELECT
        tr.id,
        tr.content,
        tr.is_internal,
        tr.created_at,
        c.id as contact_id,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email,
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email,
        uc.department_id,
        d.name as department_name,
        uc.job_title_id,
        jt.name as job_title_name,
        uc.company_id as user_company_id,
        co.name as user_company_name
      FROM ticket_replies tr
      LEFT JOIN contacts c ON tr.contact_id = c.id
      LEFT JOIN users u ON tr.user_id = u.id
      LEFT JOIN contacts uc ON u.contact_id = uc.id
      LEFT JOIN departments d ON uc.department_id = d.id
      LEFT JOIN job_titles jt ON uc.job_title_id = jt.id
      LEFT JOIN companies co ON uc.company_id = co.id
      WHERE tr.ticket_id = $1
      ORDER BY tr.created_at ASC
    `, [id])

    const replies = repliesResult.rows.map(r => ({
      id: r.id,
      content: r.content,
      is_internal: r.is_internal,
      created_at: r.created_at,
      contact: r.contact_id ? {
        id: r.contact_id,
        first_name: r.contact_first_name,
        last_name: r.contact_last_name,
        email: r.contact_email,
      } : null,
      user: r.user_id ? {
        id: r.user_id,
        name: r.user_name,
        email: r.user_email,
        department: r.department_name || null,
        job_title: r.job_title_name || null,
        company: r.user_company_name || null,
      } : null,
    }))

    // Get requester's recent tickets (if contact exists)
    let recentTickets: any[] = []
    if (row.contact_id) {
      const recentResult = await pool.query(`
        SELECT 
          t.id,
          t.ticket_number,
          t.prefix,
          t.subject,
          t.priority,
          t.created_at,
          ts.name as status,
          ts.color as status_color
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
        WHERE t.contact_id = $1
        ORDER BY t.created_at DESC
        LIMIT 5
      `, [row.contact_id])
      recentTickets = recentResult.rows
    }

    // Get linked assets from asset_tickets table
    const linkedAssetsResult = await pool.query(`
      SELECT 
        a.id,
        a.name,
        a.asset_tag,
        a.status,
        at.name as type_name
      FROM asset_tickets ast
      JOIN assets a ON ast.asset_id = a.id
      LEFT JOIN asset_types at ON a.type_id = at.id
      WHERE ast.ticket_id = $1
    `, [id])

    // Get linked tickets (both directions)
    const linkedTicketsResult = await pool.query(`
      SELECT
        tr.id as link_id, tr.relation_type, tr.created_at as linked_at,
        'outgoing' as direction,
        t.id, t.ticket_number, t.prefix, t.subject, t.priority,
        ts.name as status, ts.color as status_color, tt.name as type_name
      FROM ticket_relations tr
      JOIN tickets t ON tr.target_ticket_id = t.id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      WHERE tr.source_ticket_id = $1

      UNION ALL

      SELECT
        tr.id as link_id, tr.relation_type, tr.created_at as linked_at,
        'incoming' as direction,
        t.id, t.ticket_number, t.prefix, t.subject, t.priority,
        ts.name as status, ts.color as status_color, tt.name as type_name
      FROM ticket_relations tr
      JOIN tickets t ON tr.source_ticket_id = t.id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      WHERE tr.target_ticket_id = $1

      ORDER BY linked_at DESC
    `, [id])

    // Get linked KB articles
    const linkedKbResult = await pool.query(`
      SELECT
        tkl.id as link_id, tkl.link_type, tkl.created_at as linked_at,
        a.id, a.title, a.slug, a.summary,
        c.name as category_name, c.slug as category_slug
      FROM ticket_kb_links tkl
      JOIN kb_articles a ON tkl.kb_article_id = a.id
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE tkl.ticket_id = $1
      ORDER BY tkl.created_at DESC
    `, [id])

    // Get linked documents
    const linkedDocumentsResult = await pool.query(`
      SELECT
        tdl.id as link_id, tdl.link_type, tdl.created_at as linked_at,
        d.id, d.title
      FROM ticket_document_links tdl
      JOIN documents d ON tdl.document_id = d.id
      WHERE tdl.ticket_id = $1
      ORDER BY tdl.created_at DESC
    `, [id])

    // Get available statuses (include base_status so client can check closed/pending)
    const statusesResult = await pool.query(`
      SELECT id, name, color, base_status
      FROM ticket_statuses
      WHERE organization_id = $1 OR organization_id IS NULL
      ORDER BY is_default DESC, name ASC
    `, [row.organization_id || 'a0000000-0000-0000-0000-000000000001'])

    // Get similar tickets (full-text search on subject + description)
    let similarTickets: any[] = []
    if (row.subject) {
      try {
        const similarResult = await pool.query(`
          SELECT
            t.id,
            t.ticket_number,
            t.prefix,
            t.subject,
            t.priority,
            t.created_at,
            t.root_cause,
            t.resolution_steps,
            t.resolution_category,
            ts.name as status,
            ts.color as status_color,
            ts.base_status as status_base,
            ts_rank(
              to_tsvector('english', COALESCE(t.subject, '') || ' ' || COALESCE(t.description, '')),
              plainto_tsquery('english', $1)
            ) as relevance
          FROM tickets t
          LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
          WHERE t.organization_id = $2
            AND t.id != $3
            AND (
              to_tsvector('english', COALESCE(t.subject, '') || ' ' || COALESCE(t.description, ''))
              @@ plainto_tsquery('english', $1)
            )
          ORDER BY relevance DESC
          LIMIT 5
        `, [row.subject, row.organization_id, id])
        similarTickets = similarResult.rows
      } catch {
        // Full-text search may fail on very short subjects; skip silently
      }
    }

    // Get suggested KB articles matching ticket subject/description
    let suggestedArticles: any[] = []
    if (row.subject) {
      try {
        const searchText = row.subject
        const articlesResult = await pool.query(`
          SELECT
            a.id,
            a.title,
            a.slug,
            a.summary,
            COALESCE(c.slug, 'general') as category_slug,
            CASE
              WHEN (a.helpful_count + a.not_helpful_count) > 0
              THEN ROUND(a.helpful_count::DECIMAL * 100 / (a.helpful_count + a.not_helpful_count), 1)
              ELSE NULL
            END as helpful_ratio
          FROM kb_articles a
          LEFT JOIN kb_categories c ON a.category_id = c.id
          WHERE a.organization_id = $1
            AND a.status = 'published'
            AND a.visibility IN ('public', 'internal')
            AND (a.expires_at IS NULL OR a.expires_at > NOW())
            AND (
              to_tsvector('english', COALESCE(a.title, '') || ' ' || COALESCE(a.content_plain, '') || ' ' || COALESCE(a.summary, ''))
              @@ plainto_tsquery('english', $2)
              OR a.title ILIKE '%' || $2 || '%'
            )
          ORDER BY
            ts_rank(
              to_tsvector('english', COALESCE(a.title, '') || ' ' || COALESCE(a.content_plain, '') || ' ' || COALESCE(a.summary, '')),
              plainto_tsquery('english', $2)
            ) DESC
          LIMIT 3
        `, [row.organization_id, searchText])
        suggestedArticles = articlesResult.rows
      } catch {
        // Skip silently if search fails
      }
    }

    return NextResponse.json({
      ticket,
      replies,
      recentTickets,
      linkedAssets: linkedAssetsResult.rows,
      linkedTickets: linkedTicketsResult.rows,
      linkedKbArticles: linkedKbResult.rows,
      linkedDocuments: linkedDocumentsResult.rows,
      statuses: statusesResult.rows,
      similarTickets,
      suggestedArticles,
    })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { userId, orgId } = ctx

    // Editing a ticket (assign / status / priority / subject / category) is a
    // triage action — the same gate the dedicated POST .../assign route
    // enforces. Without it, ANY authenticated user (End User included) could
    // reassign, re-status, or re-prioritise any ticket whose id they knew,
    // silently bypassing the /assign triage gate (audit: unguarded PATCH).
    if (!(await hasCapabilityOrAdmin(userId, 'triage'))) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Fetch current ticket values for audit trail diff. Scoped to the caller's
    // organization — a ticket in another org reads as 404 (never leak it).
    const oldTicketResult = await pool.query(
      `SELECT t.status_id, t.priority, t.category_id, t.assigned_to, t.assigned_team,
              t.subject, t.description, t.type_id, t.request_category,
              t.root_cause, t.resolution_steps, t.resolution_category,
              t.approved_at, t.approved_by, t.resolved_at, t.closed_at,
              t.organization_id
       FROM tickets t WHERE t.id = $1 AND t.organization_id = $2`,
      [id, orgId]
    )
    if (oldTicketResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    const oldTicket = oldTicketResult.rows[0]

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.status_id) {
      updates.push(`status_id = $${paramIndex++}`)
      values.push(body.status_id)

      // Check if this status has base_status = 'closed' — set resolved_at
      const statusResult = await pool.query(
        `SELECT name, base_status FROM ticket_statuses WHERE id = $1`,
        [body.status_id]
      )
      const baseStatus = statusResult.rows[0]?.base_status || ''
      if (baseStatus === 'closed') {
        updates.push(`resolved_at = COALESCE(resolved_at, NOW())`)
      }
    }

    if (body.subject) {
      updates.push(`subject = $${paramIndex++}`)
      values.push(body.subject)
    }

    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(body.description)
    }

    if (body.priority) {
      updates.push(`priority = $${paramIndex++}`)
      values.push(body.priority)
    }

    if (body.category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`)
      values.push(body.category_id || null)
    }

    if (body.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`)
      values.push(body.assigned_to)

      // Auto-transition New → Open when ticket is assigned
      if (body.assigned_to) {
        const currentStatus = await pool.query(
          `SELECT ts.name, ts.id as status_id, ts.is_default
           FROM tickets t
           JOIN ticket_statuses ts ON t.status_id = ts.id
           WHERE t.id = $1`,
          [id]
        )
        const cur = currentStatus.rows[0]
        if (cur?.is_default && cur?.name === 'New') {
          const openStatus = await pool.query(
            `SELECT id FROM ticket_statuses
             WHERE organization_id = (SELECT organization_id FROM tickets WHERE id = $1)
               AND name = 'Open'
             LIMIT 1`,
            [id]
          )
          if (openStatus.rows[0]) {
            updates.push(`status_id = $${paramIndex++}`)
            values.push(openStatus.rows[0].id)
          }
        }
      }
    }

    // Resolution fields (Phase 6.1)
    if (body.root_cause !== undefined) {
      updates.push(`root_cause = $${paramIndex++}`)
      values.push(body.root_cause || null)
    }
    if (body.resolution_steps !== undefined) {
      updates.push(`resolution_steps = $${paramIndex++}`)
      values.push(body.resolution_steps || null)
    }
    if (body.resolution_category !== undefined) {
      updates.push(`resolution_category = $${paramIndex++}`)
      values.push(body.resolution_category || null)
    }

    // Scheduling fields
    if (body.action_date_type !== undefined) {
      updates.push(`action_date_type = $${paramIndex++}`)
      values.push(body.action_date_type)
    }
    if (body.scheduled_for !== undefined) {
      updates.push(`scheduled_for = $${paramIndex++}`)
      values.push(body.scheduled_for || null)
    }
    if (body.lead_time_days !== undefined) {
      const ltd = parseInt(body.lead_time_days, 10)
      if (isNaN(ltd) || ltd < 1 || ltd > 30) {
        return NextResponse.json({ error: 'lead_time_days must be between 1 and 30' }, { status: 400 })
      }
      updates.push(`lead_time_days = $${paramIndex++}`)
      values.push(ltd)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)
    values.push(orgId)

    // Org-scoped UPDATE (defense-in-depth alongside the scoped fetch above).
    await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}`,
      values
    )

    const ticketOrgId = oldTicket.organization_id

    // Log field changes to audit trail (SOC2 CC8.1)
    try {
      const changes = diffTicketFields(oldTicket, body, TRACKED_TICKET_FIELDS)
      if (changes.length > 0) {
        await logTicketFieldChanges(ticketOrgId, id, changes, userId, 'user')
      }
    } catch {
      // Audit trail failure should not block the update
    }

    // Re-embed if subject or description changed (non-blocking)
    if (ticketOrgId && (body.subject || body.description)) {
      try {
        const { queueEmbeddingJob } = await import('@/lib/queue')
        await pool.query(
          `UPDATE tickets SET embedding_status = 'stale' WHERE id = $1`,
          [id]
        )
        await queueEmbeddingJob('tickets', id, ticketOrgId)
      } catch {
        // Embedding queue failure shouldn't block ticket update
      }
    }

    // Queue triage re-score on status change, assignment, or priority change (non-blocking)
    if (ticketOrgId && (body.status_id || body.assigned_to !== undefined || body.priority)) {
      try {
        const { queueTriageJob } = await import('@/lib/triage-worker')
        const trigger = body.status_id ? 'status_changed' : 'manual'
        await queueTriageJob(id, ticketOrgId, trigger)
      } catch {
        // Triage queue failure shouldn't block ticket update
      }
    }

    // Phase 5.3: KB gap resolution linkage on ticket close/resolve
    if (body.status_id && ticketOrgId) {
      try {
        const newStatusResult = await pool.query(
          'SELECT base_status FROM ticket_statuses WHERE id = $1',
          [body.status_id]
        )
        const newBaseStatus = newStatusResult.rows[0]?.base_status
        if (newBaseStatus === 'closed') {
          await resolveKbGapsForTicket(id, ticketOrgId, body.resolution_notes || body.resolution_steps || null)
        }
      } catch {
        // Gap resolution is non-blocking — don't fail the ticket update
      }
    }

    logAudit({
      orgId: ticketOrgId, userId, action: 'ticket_updated', actionCategory: 'update',
      entityType: 'tickets', entityId: id,
      newValues: body,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}

/**
 * Phase 5.3: Resolve KB gaps when a ticket is closed/resolved.
 *
 * Two paths:
 * 1. Direct linkage: ticket was created from a chat session (chat_ticket_conversions).
 *    Find KB gap messages from that session and resolve matching gaps.
 * 2. Fuzzy match: match ticket subject against open KB gap topics via ILIKE.
 */
async function resolveKbGapsForTicket(
  ticketId: string,
  orgId: string,
  resolutionNotes: string | null,
): Promise<void> {
  // Path 1: Check if ticket was created from a chat session
  const conversion = await queryOne<{ session_id: string }>(
    'SELECT session_id FROM chat_ticket_conversions WHERE ticket_id = $1',
    [ticketId]
  )

  if (conversion) {
    // Find KB gap messages from this chat session
    const gapMessages = await query<{
      id: string
      metadata: Record<string, any> | null
    }>(
      `SELECT m.id, m.metadata
       FROM ai_chat_messages m
       WHERE m.session_id = $1
         AND m.kb_gap = true
       ORDER BY m.created_at ASC`,
      [conversion.session_id]
    )

    if (gapMessages.length > 0) {
      // Collect search queries and topics from gap message metadata
      const searchTerms: string[] = []
      for (const msg of gapMessages) {
        if (msg.metadata?.search_queries) {
          searchTerms.push(...msg.metadata.search_queries)
        }
      }

      // Find matching kb_gaps by search queries or topic similarity
      if (searchTerms.length > 0) {
        for (const term of searchTerms) {
          const matchingGaps = await query<{ id: string; draft_article_id: string | null }>(
            `SELECT id, draft_article_id FROM kb_gaps
             WHERE organization_id = $1
               AND status IN ('open', 'draft_created')
               AND (
                 topic ILIKE '%' || $2 || '%'
                 OR $2 ILIKE '%' || topic || '%'
                 OR EXISTS (
                   SELECT 1 FROM unnest(search_queries) sq WHERE sq ILIKE '%' || $2 || '%'
                 )
               )`,
            [orgId, term]
          )

          for (const gap of matchingGaps) {
            // If there's a draft article and we have resolution notes, append suggested resolution
            if (gap.draft_article_id && resolutionNotes) {
              await pool.query(
                `UPDATE kb_articles
                 SET content = content || E'\n\n## Suggested Resolution\n\n' || $1,
                     content_plain = content_plain || E'\n\n## Suggested Resolution\n\n' || $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [resolutionNotes, gap.draft_article_id]
              )
            }

            // Mark gap as resolved
            await pool.query(
              `UPDATE kb_gaps
               SET status = 'resolved', resolved_ticket_id = $1, updated_at = NOW()
               WHERE id = $2 AND status IN ('open', 'draft_created')`,
              [ticketId, gap.id]
            )
          }
        }
      }
    }
  }

  // Path 2: Fuzzy-match ticket subject against open KB gaps (even without chat linkage)
  const ticket = await queryOne<{ subject: string; resolution_steps: string | null }>(
    'SELECT subject, resolution_steps FROM tickets WHERE id = $1',
    [ticketId]
  )

  if (ticket?.subject) {
    // Extract meaningful words from subject (skip very short words)
    const subjectWords = ticket.subject
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)

    if (subjectWords.length > 0) {
      // Build ILIKE pattern from the most significant words (first 5)
      const significantWords = subjectWords.slice(0, 5)

      const fuzzyGaps = await query<{ id: string; draft_article_id: string | null }>(
        `SELECT id, draft_article_id FROM kb_gaps
         WHERE organization_id = $1
           AND status IN ('open', 'draft_created')
           AND resolved_ticket_id IS NULL
           AND (
             ${significantWords.map((_, i) => `topic ILIKE '%' || $${i + 2} || '%'`).join(' OR ')}
           )`,
        [orgId, ...significantWords]
      )

      const effectiveResolution = resolutionNotes || ticket.resolution_steps

      for (const gap of fuzzyGaps) {
        // Append resolution to draft article if available
        if (gap.draft_article_id && effectiveResolution) {
          await pool.query(
            `UPDATE kb_articles
             SET content = content || E'\n\n## Suggested Resolution\n\n' || $1,
                 content_plain = content_plain || E'\n\n## Suggested Resolution\n\n' || $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [effectiveResolution, gap.draft_article_id]
          )
        }

        await pool.query(
          `UPDATE kb_gaps
           SET status = 'resolved', resolved_ticket_id = $1, updated_at = NOW()
           WHERE id = $2 AND status IN ('open', 'draft_created') AND resolved_ticket_id IS NULL`,
          [ticketId, gap.id]
        )
      }
    }
  }
}
