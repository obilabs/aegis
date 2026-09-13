import { toSafeHtml } from '@/lib/article-render'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'
import { getTicketAccessFilter, getUserPermissions } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { session, userId, orgId } = ctx
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const category = url.searchParams.get('category')
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
    const offset = (page - 1) * limit

    const conditions: string[] = ['t.organization_id = $1']
    const values: any[] = [orgId]
    let paramIndex = 2

    if (status && status !== 'all') {
      conditions.push(`ts.name = $${paramIndex++}`)
      values.push(status)
    }

    if (priority && priority !== 'all') {
      conditions.push(`t.priority = $${paramIndex++}`)
      values.push(priority)
    }

    if (category && category !== 'all') {
      conditions.push(`tc.name = $${paramIndex++}`)
      values.push(category)
    }

    if (search) {
      conditions.push(`(
        t.subject ILIKE $${paramIndex} OR
        t.ticket_number::text LIKE $${paramIndex} OR
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        tc.name ILIKE $${paramIndex}
      )`)
      values.push(`%${search}%`)
      paramIndex++
    }

    // RBAC visibility scoping. Without this the list returned EVERY ticket in
    // the org to any authenticated caller (getTicketAccessFilter was defined
    // but never called — the portal queue scoped, this list did not). 'all'
    // access → empty clause (admins unchanged); 'team'/'own' → filtered to the
    // caller's tickets. Params are appended after the optional-filter params so
    // the LIMIT/OFFSET placeholders that follow still line up.
    const access = await getTicketAccessFilter(userId, orgId, 't', paramIndex)
    values.push(...access.params)
    paramIndex += access.params.length
    const where = conditions.join(' AND ') + (access.clause ? ` ${access.clause}` : '')

    // Same scoping for the aggregate badge counts, which start from $1 = orgId.
    const accessBadge = await getTicketAccessFilter(userId, orgId, 't', 2)
    const badgeWhere = `t.organization_id = $1${accessBadge.clause ? ` ${accessBadge.clause}` : ''}`
    const badgeParams: unknown[] = [orgId, ...accessBadge.params]

    // Get tickets with related data
    const ticketsResult = await pool.query(`
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
        ts.name as status,
        ts.color as status_color,
        tc.name as category,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.is_deleted as contact_is_deleted,
        COALESCE(t.is_scheduled, false) as is_scheduled,
        t.scheduled_for,
        t.scheduling_active_from,
        t.action_date_type,
        t.lead_time_days
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE ${where}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...values, limit, offset])

    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE ${where}
    `, values)

    // Get status counts for filter badges
    const statusCountsResult = await pool.query(`
      SELECT ts.name as status, COUNT(*) as count
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE ${badgeWhere}
      GROUP BY ts.name
    `, badgeParams)

    const statusCounts: Record<string, number> = {}
    for (const row of statusCountsResult.rows) {
      statusCounts[row.status || 'Unknown'] = parseInt(row.count, 10)
    }

    // Get category counts for filter tabs
    const categoryCountsResult = await pool.query(`
      SELECT COALESCE(tc.name, 'Uncategorized') as category, COUNT(*) as count
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      WHERE ${badgeWhere}
      GROUP BY tc.name
      ORDER BY count DESC
    `, badgeParams)

    const categoryCounts: Record<string, number> = {}
    for (const row of categoryCountsResult.rows) {
      categoryCounts[row.category] = parseInt(row.count, 10)
    }

    return NextResponse.json({
      tickets: ticketsResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
      page,
      limit,
      statusCounts,
      categoryCounts,
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { session, userId, orgId } = ctx
    const body = await request.json()

    const {
      subject, description, priority, category, contact_email,
      type,                    // 'incident' | 'problem' | 'change' | 'service_request'
      risk_level,              // Change Request: low/medium/high
      implementation_plan,     // Change Request
      rollback_plan,           // Change Request
      scheduled_start,         // Change Request
      scheduled_end,           // Change Request
      change_type,             // Change Request: 'standard' | 'normal' | 'emergency'
      change_areas,            // Change Request: string[] (Infrastructure, Application, etc.)
      related_ticket_ids,      // Problem: linked incident IDs
      impact,                  // Problem: impact description
      action_date_type,        // Scheduling: 'complete_by' | 'scheduled_for'
      scheduled_for,           // Scheduling: future date when work should happen
      lead_time_days,          // Scheduling: days before scheduled_for to surface (1-30)
    } = body

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    const typeName = type || 'incident'

    // Role check: Change Requests and Problems are staff only. Uses the
    // application role (ticket_access/admin_access), not the Better Auth
    // session role, which is only ever 'user' or 'admin' and so refused every
    // technician.
    if (typeName === 'change' || typeName === 'problem') {
      const perms = await getUserPermissions(userId)
      if (!perms.adminAccess && perms.ticketAccess === 'own') {
        return NextResponse.json(
          { error: 'Only technicians and administrators can create this ticket type' },
          { status: 403 }
        )
      }
    }

    // Look up ticket type
    let typeId = null
    const typeMap: Record<string, string> = {
      incident: 'Incident',
      problem: 'Problem',
      change: 'Change Request',
      service_request: 'Service Request',
    }
    const resolvedTypeName = typeMap[typeName] || 'Incident'
    const typeResult = await pool.query(
      'SELECT id, requires_approval, default_priority FROM ticket_types WHERE organization_id = $1 AND name = $2 LIMIT 1',
      [orgId, resolvedTypeName]
    )
    const ticketType = typeResult.rows[0]
    typeId = ticketType?.id || null

    // Look up category ID if provided
    let categoryId = null
    if (typeName === 'change' && change_type) {
      // Map change_type to seeded ticket category (Standard Change, Normal Change, Emergency Change)
      const changeTypeMap: Record<string, string> = {
        standard: 'Standard Change',
        normal: 'Normal Change',
        emergency: 'Emergency Change',
      }
      const changeCategoryName = changeTypeMap[change_type]
      if (changeCategoryName) {
        const catResult = await pool.query(
          'SELECT id FROM ticket_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
          [orgId, changeCategoryName]
        )
        categoryId = catResult.rows[0]?.id || null
      }
    }
    if (!categoryId && category) {
      const catResult = await pool.query(
        'SELECT id FROM ticket_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
        [orgId, category]
      )
      categoryId = catResult.rows[0]?.id || null
    }

    // Determine initial status
    // If type requires approval → "Pending Approval", otherwise default ("New")
    let statusId = null
    if (ticketType?.requires_approval) {
      const approvalStatus = await pool.query(
        `SELECT id FROM ticket_statuses WHERE organization_id = $1 AND name = 'Pending Approval' LIMIT 1`,
        [orgId]
      )
      statusId = approvalStatus.rows[0]?.id || null
    }
    if (!statusId) {
      const defaultStatus = await pool.query(
        'SELECT id FROM ticket_statuses WHERE organization_id = $1 AND is_default = true LIMIT 1',
        [orgId]
      )
      statusId = defaultStatus.rows[0]?.id || null
    }

    // Look up contact by email (use provided email, or fall back to session user's email)
    let contactId = null
    const lookupEmail = contact_email || session.user.email
    if (lookupEmail) {
      const contactResult = await pool.query(
        'SELECT id FROM contacts WHERE organization_id = $1 AND email = $2',
        [orgId, lookupEmail]
      )
      contactId = contactResult.rows[0]?.id || null
    }

    // Use type's default priority if not specified
    const resolvedPriority = priority || ticketType?.default_priority || 'medium'

    // Build custom_fields for type-specific data
    const customFields: Record<string, unknown> = {}
    if (typeName === 'change') {
      if (change_type) customFields.change_type = change_type
      if (change_areas?.length) customFields.change_areas = change_areas
      // Auto-set risk_level based on change_type if not explicitly provided
      const resolvedRisk = risk_level || (change_type === 'emergency' ? 'high' : change_type === 'normal' ? 'medium' : 'low')
      customFields.risk_level = resolvedRisk
      if (implementation_plan) customFields.implementation_plan = implementation_plan
      if (rollback_plan) customFields.rollback_plan = rollback_plan
      if (scheduled_start) customFields.scheduled_start = scheduled_start
      if (scheduled_end) customFields.scheduled_end = scheduled_end
      // Override requires_approval based on change_type
      // Standard = no approval, Normal/Emergency = requires approval
      if (change_type === 'standard') {
        ticketType.requires_approval = false
      } else if (change_type === 'normal' || change_type === 'emergency') {
        ticketType.requires_approval = true
      }
    }
    if (typeName === 'problem') {
      if (related_ticket_ids?.length) customFields.related_ticket_ids = related_ticket_ids
      if (impact) customFields.impact = impact
    }

    // Set request_category based on type
    // Values of the request_category enum ('change_request', not 'change').
    const requestCategory = typeName === 'change' ? 'change_request' : typeName === 'problem' ? 'problem' : typeName === 'service_request' ? 'service_request' : 'incident'

    // Validate scheduling fields
    const resolvedActionDateType = action_date_type || 'complete_by'
    let resolvedScheduledFor = null
    let resolvedLeadTimeDays = 3

    if (resolvedActionDateType === 'scheduled_for') {
      if (!scheduled_for) {
        return NextResponse.json({ error: 'scheduled_for is required when action_date_type is scheduled_for' }, { status: 400 })
      }
      const scheduledDate = new Date(scheduled_for)
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return NextResponse.json({ error: 'scheduled_for must be a valid future date' }, { status: 400 })
      }
      resolvedScheduledFor = scheduledDate.toISOString()

      if (lead_time_days !== undefined) {
        resolvedLeadTimeDays = parseInt(lead_time_days, 10)
        if (isNaN(resolvedLeadTimeDays) || resolvedLeadTimeDays < 1 || resolvedLeadTimeDays > 30) {
          return NextResponse.json({ error: 'lead_time_days must be between 1 and 30' }, { status: 400 })
        }
      }
    }

    // Create the ticket
    const result = await pool.query(`
      INSERT INTO tickets (
        organization_id, subject, description, priority, type_id,
        status_id, category_id, contact_id, created_by, source,
        request_category, custom_fields,
        action_date_type, scheduled_for, lead_time_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'portal', $10, $11, $12, $13, $14)
      RETURNING id, ticket_number, prefix
    `, [
      orgId,
      subject,
      // Rich text: sanitized on write (and again at render via <SafeHtml>).
      toSafeHtml(description),
      resolvedPriority,
      typeId,
      statusId,
      categoryId,
      contactId,
      userId,
      requestCategory,
      Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : '{}',
      resolvedActionDateType,
      resolvedScheduledFor,
      resolvedLeadTimeDays,
    ])

    const ticket = result.rows[0]

    // Create ticket_relations for Problem→Incident links
    if (typeName === 'problem' && related_ticket_ids?.length) {
      try {
        for (const relatedId of related_ticket_ids) {
          await pool.query(
            `INSERT INTO ticket_relations (organization_id, source_ticket_id, target_ticket_id, relation_type, created_by)
             VALUES ($1, $2, $3, 'caused_by', $4)
             ON CONFLICT ON CONSTRAINT ticket_relations_unique DO NOTHING`,
            [orgId, ticket.id, relatedId, userId]
          )
        }
      } catch {
        // Relation creation failure shouldn't block ticket creation
      }
    }

    // Queue embedding generation (non-blocking)
    try {
      const { queueEmbeddingJob } = await import('@/lib/queue')
      await queueEmbeddingJob('tickets', ticket.id, orgId)
    } catch {
      // Embedding queue failure shouldn't block ticket creation
    }

    // Queue triage scoring (non-blocking)
    try {
      const { queueTriageJob } = await import('@/lib/triage-worker')
      await queueTriageJob(ticket.id, orgId, 'ticket_created')
    } catch {
      // Triage queue failure shouldn't block ticket creation
    }

    logAudit({
      orgId, userId, action: 'ticket_created', actionCategory: 'create',
      entityType: 'tickets', entityId: ticket.id,
      entityName: `${ticket.prefix || ''}${ticket.ticket_number} ${subject}`,
      newValues: { subject, priority: resolvedPriority, type: typeName, category },
      actorIp: getClientIp(request.headers),
    })

    // Send email notification to contact (non-blocking)
    try {
      if (contact_email) {
        const { sendTicketNotification } = await import('@/lib/email-queue')
        const ticketNumber = `${ticket.prefix || ''}${ticket.ticket_number}`
        await sendTicketNotification({
          to: contact_email,
          ticketNumber,
          ticketSubject: subject,
          action: 'created',
          ticketId: ticket.id,
        })
      }
    } catch {
      // Email failure should not block ticket creation
    }

    return NextResponse.json({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      prefix: ticket.prefix,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
