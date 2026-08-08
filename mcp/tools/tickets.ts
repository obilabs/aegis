import { Pool } from 'pg'

export function createTicketTools(pool: Pool) {
  return {
    'aegis.tickets.list': {
      description: 'List tickets with optional filters. Returns ticket number, subject, status, priority, and assignment.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status name (e.g., "Open", "In Progress", "Resolved")' },
          priority: { type: 'string', description: 'Filter by priority (low, medium, high, critical)' },
          search: { type: 'string', description: 'Search tickets by subject or description' },
          limit: { type: 'number', description: 'Max results (default 10, max 50)' },
        },
      },
      execute: async (args: { status?: string; priority?: string; search?: string; limit?: number }) => {
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { tickets: [], message: 'No organization found' }

        const limit = Math.min(args.limit || 10, 50)
        const conditions: string[] = ['t.organization_id = $1']
        const values: any[] = [orgId]
        let idx = 2

        if (args.status) {
          conditions.push(`ts.name ILIKE $${idx++}`)
          values.push(args.status)
        }
        if (args.priority) {
          conditions.push(`t.priority = $${idx++}`)
          values.push(args.priority)
        }
        if (args.search) {
          conditions.push(`(t.subject ILIKE $${idx} OR t.description ILIKE $${idx})`)
          values.push(`%${args.search}%`)
          idx++
        }

        values.push(limit)
        const where = conditions.join(' AND ')

        const result = await pool.query(`
          SELECT
            t.id,
            t.ticket_number,
            t.prefix,
            t.subject,
            t.priority,
            t.source,
            t.created_at,
            t.updated_at,
            ts.name as status,
            tc.name as category,
            CONCAT(u.first_name, ' ', u.last_name) as assigned_to,
            CONCAT(c.first_name, ' ', c.last_name) as contact_name,
            c.email as contact_email
          FROM tickets t
          LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
          LEFT JOIN ticket_categories tc ON t.category_id = tc.id
          LEFT JOIN users u ON t.assigned_to = u.id
          LEFT JOIN contacts c ON t.contact_id = c.id
          WHERE ${where}
          ORDER BY t.created_at DESC
          LIMIT $${idx}
        `, values)

        return {
          tickets: result.rows.map(t => ({
            ...t,
            ticket_number: `${t.prefix || 'TKT'}-${String(t.ticket_number).padStart(4, '0')}`,
          })),
          total: result.rows.length,
        }
      },
    },

    'aegis.tickets.get': {
      description: 'Get full details of a ticket by ID, including replies, contact info, and linked assets.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Ticket UUID' },
        },
        required: ['id'],
      },
      execute: async (args: { id: string }) => {
        const result = await pool.query(`
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
            ts.name as status,
            tc.name as category,
            CONCAT(u.first_name, ' ', u.last_name) as assigned_to,
            u.email as assigned_email,
            CONCAT(c.first_name, ' ', c.last_name) as contact_name,
            c.email as contact_email,
            c.phone as contact_phone,
            cl.name as company_name
          FROM tickets t
          LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
          LEFT JOIN ticket_categories tc ON t.category_id = tc.id
          LEFT JOIN users u ON t.assigned_to = u.id
          LEFT JOIN contacts c ON t.contact_id = c.id
          LEFT JOIN companies cl ON c.company_id = cl.id
          WHERE t.id = $1
        `, [args.id])

        if (result.rows.length === 0) {
          return { error: 'Ticket not found' }
        }

        const ticket = result.rows[0]

        // Get replies
        const repliesResult = await pool.query(`
          SELECT
            tr.content,
            tr.is_internal,
            tr.created_at,
            COALESCE(
              CONCAT(u.first_name, ' ', u.last_name),
              CONCAT(c.first_name, ' ', c.last_name),
              'System'
            ) as author
          FROM ticket_replies tr
          LEFT JOIN users u ON tr.user_id = u.id
          LEFT JOIN contacts c ON tr.contact_id = c.id
          WHERE tr.ticket_id = $1
          ORDER BY tr.created_at ASC
        `, [args.id])

        return {
          ticket: {
            ...ticket,
            ticket_number: `${ticket.prefix || 'TKT'}-${String(ticket.ticket_number).padStart(4, '0')}`,
          },
          replies: repliesResult.rows,
        }
      },
    },

    'aegis.tickets.create': {
      description: 'Create a new support ticket.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Ticket subject' },
          description: { type: 'string', description: 'Detailed description of the issue' },
          priority: { type: 'string', description: 'Priority: low, medium, high, or critical', enum: ['low', 'medium', 'high', 'critical'] },
          category: { type: 'string', description: 'Category name (e.g., "Hardware", "Software", "Network")' },
          contact_email: { type: 'string', description: 'Email of the person reporting the issue' },
        },
        required: ['subject', 'description'],
      },
      execute: async (args: { subject: string; description: string; priority?: string; category?: string; contact_email?: string }) => {
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { error: 'No organization found' }

        // Look up category
        let categoryId = null
        if (args.category) {
          const catResult = await pool.query(
            'SELECT id FROM ticket_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
            [orgId, args.category]
          )
          categoryId = catResult.rows[0]?.id || null
        }

        // Get default status
        const statusResult = await pool.query(
          'SELECT id FROM ticket_statuses WHERE organization_id = $1 AND is_default = true LIMIT 1',
          [orgId]
        )
        const statusId = statusResult.rows[0]?.id || null

        // Look up contact
        let contactId = null
        if (args.contact_email) {
          const contactResult = await pool.query(
            'SELECT id FROM contacts WHERE organization_id = $1 AND email = $2',
            [orgId, args.contact_email]
          )
          contactId = contactResult.rows[0]?.id || null
        }

        const result = await pool.query(`
          INSERT INTO tickets (
            organization_id, subject, description, priority,
            status_id, category_id, contact_id, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'mcp')
          RETURNING id, ticket_number, prefix
        `, [
          orgId,
          args.subject,
          args.description,
          args.priority || 'medium',
          statusId,
          categoryId,
          contactId,
        ])

        const ticket = result.rows[0]
        return {
          id: ticket.id,
          ticket_number: `${ticket.prefix || 'TKT'}-${String(ticket.ticket_number).padStart(4, '0')}`,
          message: 'Ticket created successfully',
        }
      },
    },
  }
}
