import { pool } from './db'

/**
 * Create a fulfillment ticket when a service request is approved.
 *
 * Creates a ticket of type "Service Request" with details from the request form,
 * assigned to the service owner or IT team.
 */
export async function createFulfillmentTicket(requestId: string, orgId: string): Promise<string | null> {
  try {
    // Get the service request with catalog item details
    const reqResult = await pool.query(`
      SELECT
        sr.id, sr.request_number, sr.requester_id, sr.form_responses,
        sr.justification, sr.catalog_item_id,
        ci.name as item_name, ci.auto_category, ci.fulfillment_instructions,
        ci.application_id, ci.owner_id as item_owner_id,
        CONCAT(c.first_name, ' ', c.last_name) as requester_name,
        c.email as requester_email
      FROM service_requests sr
      JOIN catalog_items ci ON sr.catalog_item_id = ci.id
      LEFT JOIN contacts c ON sr.requester_id = c.id
      WHERE sr.id = $1 AND sr.organization_id = $2
    `, [requestId, orgId])

    if (reqResult.rows.length === 0) return null

    const req = reqResult.rows[0]
    const formData = typeof req.form_responses === 'string'
      ? JSON.parse(req.form_responses)
      : req.form_responses || {}

    // Build ticket subject and description
    const subject = `[Request #${req.request_number}] ${req.item_name} for ${req.requester_name || 'Unknown'}`

    const descriptionParts = [
      `**Service Request #${req.request_number}**`,
      `**Catalog Item:** ${req.item_name}`,
      `**Requester:** ${req.requester_name || 'Unknown'} (${req.requester_email || 'N/A'})`,
      '',
      '**Form Responses:**',
    ]

    for (const [key, value] of Object.entries(formData)) {
      if (value !== null && value !== undefined && value !== '') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        descriptionParts.push(`- ${label}: ${value}`)
      }
    }

    if (req.justification) {
      descriptionParts.push('', `**Justification:** ${req.justification}`)
    }

    if (req.fulfillment_instructions) {
      descriptionParts.push('', `**Fulfillment Instructions:**`, req.fulfillment_instructions)
    }

    const description = descriptionParts.join('\n')

    // Find the Service Request ticket type
    const typeResult = await pool.query(
      `SELECT id FROM ticket_types WHERE organization_id = $1 AND name = 'Service Request' LIMIT 1`,
      [orgId]
    )
    const typeId = typeResult.rows[0]?.id || null

    // Find default status (New)
    const statusResult = await pool.query(
      `SELECT id FROM ticket_statuses WHERE organization_id = $1 AND is_default = true LIMIT 1`,
      [orgId]
    )
    const statusId = statusResult.rows[0]?.id || null

    // Find category by auto_category
    let categoryId = null
    if (req.auto_category) {
      const catResult = await pool.query(
        `SELECT id FROM ticket_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
        [orgId, req.auto_category]
      )
      categoryId = catResult.rows[0]?.id || null
    }

    // Find assignee: item owner > application owner > service owner > null (IT team)
    let assignedTo = req.item_owner_id || null

    if (!assignedTo && req.application_id) {
      const appResult = await pool.query(
        `SELECT owner_id FROM applications WHERE id = $1`,
        [req.application_id]
      )
      assignedTo = appResult.rows[0]?.owner_id || null
    }

    // Create the fulfillment ticket
    const ticketResult = await pool.query(`
      INSERT INTO tickets (
        organization_id, subject, description, priority, type_id,
        status_id, category_id, contact_id, assigned_to, source,
        request_category
      ) VALUES ($1, $2, $3, 'medium', $4, $5, $6, $7, $8, 'service_catalog', 'service_request')
      RETURNING id, ticket_number
    `, [orgId, subject, description, typeId, statusId, categoryId, req.requester_id, assignedTo])

    const ticket = ticketResult.rows[0]

    // Link the ticket to the service request
    await pool.query(
      `UPDATE service_requests SET ticket_id = $1, updated_at = NOW() WHERE id = $2`,
      [ticket.id, requestId]
    )

    return ticket.id
  } catch (error) {
    console.error('Error creating fulfillment ticket:', error)
    return null
  }
}
