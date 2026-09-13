import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    // Service requests are tickets where request_category is not 'incident'
    // or where the ticket type is not Incident
    const result = await pool.query(`
      SELECT
        t.id,
        t.ticket_number,
        t.prefix,
        t.subject as title,
        tt.name as type,
        ts.name as status,
        ts.color as status_color,
        t.priority,
        t.request_category,
        t.created_at,
        t.approved_at,
        CONCAT(req.first_name, ' ', req.last_name) as requester,
        COALESCE((SELECT d.name FROM departments d WHERE d.id = req.department_id), req.department_legacy) as department,
        CONCAT(asgn.first_name, ' ', asgn.last_name) as assigned_to
      FROM tickets t
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN contacts req ON t.contact_id = req.id
      LEFT JOIN users asgn ON t.assigned_to = asgn.id
      WHERE t.organization_id = $1
        AND t.is_deleted = false
        AND (
          t.request_category != 'incident'
          OR tt.name != 'Incident'
        )
      ORDER BY t.created_at DESC
    `, [orgId])

    // Also get type counts for sidebar filters
    const typeCounts = await pool.query(`
      SELECT
        COALESCE(tt.name, t.request_category::text) as type_name,
        COUNT(*)::int as count
      FROM tickets t
      LEFT JOIN ticket_types tt ON t.type_id = tt.id
      WHERE t.organization_id = $1
        AND t.is_deleted = false
        AND (
          t.request_category != 'incident'
          OR tt.name != 'Incident'
        )
      GROUP BY COALESCE(tt.name, t.request_category::text)
      ORDER BY count DESC
    `, [orgId])

    // Also get catalog-based service requests
    const catalogRequests = await pool.query(`
      SELECT
        sr.id,
        sr.request_number,
        ci.name as item_name,
        sr.status,
        sr.priority,
        sr.created_at,
        sr.approved_at,
        sr.fulfilled_at,
        sr.rejected_at,
        sr.rejection_reason,
        sr.ticket_id,
        CONCAT(c.first_name, ' ', c.last_name) as requester_name
      FROM service_requests sr
      JOIN catalog_items ci ON sr.catalog_item_id = ci.id
      LEFT JOIN contacts c ON sr.requester_id = c.id
      WHERE sr.organization_id = $1
      ORDER BY sr.created_at DESC
    `, [orgId])

    return NextResponse.json({
      requests: result.rows,
      catalogRequests: catalogRequests.rows,
      typeCounts: typeCounts.rows,
    })
  } catch (error) {
    console.error('Error fetching requests:', error)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const body = await request.json()
    const { catalog_item_id, form_responses, justification } = body

    if (!catalog_item_id) {
      return NextResponse.json({ error: 'Catalog item is required' }, { status: 400 })
    }

    // Verify catalog item exists and is active
    const itemResult = await pool.query(
      `SELECT id, name, requires_approval, request_form, auto_category, application_id
       FROM catalog_items
       WHERE id = $1 AND organization_id = $2 AND is_active = true`,
      [catalog_item_id, orgId]
    )

    if (itemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 })
    }

    const item = itemResult.rows[0]

    // Find requester (contact linked to the current user)
    const contactResult = await pool.query(
      `SELECT id FROM contacts WHERE organization_id = $1 AND email = $2 LIMIT 1`,
      [orgId, session.user.email]
    )
    const requesterId = contactResult.rows[0]?.id || null

    // Determine initial status
    const status = item.requires_approval ? 'pending_approval' : 'approved'

    // Create the service request
    const reqResult = await pool.query(
      `INSERT INTO service_requests (
        organization_id, requester_id, catalog_item_id,
        form_responses, justification, status, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, request_number`,
      [orgId, requesterId, catalog_item_id,
       JSON.stringify(form_responses || {}), justification || null, status]
    )

    const serviceRequest = reqResult.rows[0]

    // If no approval needed, auto-create fulfillment ticket
    if (!item.requires_approval) {
      try {
        const { createFulfillmentTicket } = await import('@/lib/fulfillment')
        await createFulfillmentTicket(serviceRequest.id, orgId)
        await pool.query(
          `UPDATE service_requests SET approved_at = NOW(), status = 'approved' WHERE id = $1`,
          [serviceRequest.id]
        )
      } catch {
        // Fulfillment ticket creation failure shouldn't block request
      }
    }

    return NextResponse.json({
      id: serviceRequest.id,
      request_number: serviceRequest.request_number,
      status,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating request:', error)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }
}
