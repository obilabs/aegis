import { Pool } from 'pg'

export function createContactTools(pool: Pool) {
  return {
    'aegis.contacts.search': {
      description: 'Search contacts by name or email. Returns contact details, company, and recent ticket count.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search by name or email' },
          limit: { type: 'number', description: 'Max results (default 10, max 25)' },
        },
        required: ['query'],
      },
      execute: async (args: { query: string; limit?: number }) => {
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { contacts: [] }

        const limit = Math.min(args.limit || 10, 25)
        const result = await pool.query(`
          SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.title as job_title,
            cl.name as company_name,
            (SELECT COUNT(*) FROM tickets t WHERE t.contact_id = c.id) as ticket_count
          FROM contacts c
          LEFT JOIN companies cl ON c.company_id = cl.id
          WHERE c.organization_id = $1
            AND (
              c.first_name ILIKE '%' || $2 || '%'
              OR c.last_name ILIKE '%' || $2 || '%'
              OR c.email ILIKE '%' || $2 || '%'
              OR CONCAT(c.first_name, ' ', c.last_name) ILIKE '%' || $2 || '%'
            )
          ORDER BY c.last_name, c.first_name
          LIMIT $3
        `, [orgId, args.query, limit])

        return {
          contacts: result.rows.map(c => ({
            ...c,
            name: `${c.first_name} ${c.last_name}`,
          })),
          total: result.rows.length,
        }
      },
    },

    'aegis.assets.search': {
      description: 'Search IT assets by name, asset tag, or serial number.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search by name, tag, or serial number' },
          status: { type: 'string', description: 'Filter by status (deployed, available, maintenance, retired)' },
          limit: { type: 'number', description: 'Max results (default 10, max 25)' },
        },
        required: ['query'],
      },
      execute: async (args: { query: string; status?: string; limit?: number }) => {
        const orgResult = await pool.query(`SELECT id FROM organizations LIMIT 1`)
        const orgId = orgResult.rows[0]?.id
        if (!orgId) return { assets: [] }

        const limit = Math.min(args.limit || 10, 25)
        const conditions: string[] = [
          'a.organization_id = $1',
          `(a.name ILIKE '%' || $2 || '%' OR a.asset_tag ILIKE '%' || $2 || '%' OR a.serial_number ILIKE '%' || $2 || '%')`,
        ]
        const values: any[] = [orgId, args.query]
        let idx = 3

        if (args.status) {
          conditions.push(`a.status = $${idx++}`)
          values.push(args.status)
        }

        values.push(limit)

        const result = await pool.query(`
          SELECT
            a.id,
            a.name,
            a.asset_tag,
            a.serial_number,
            a.status,
            a.manufacturer,
            a.model,
            at.name as type_name,
            CONCAT(c.first_name, ' ', c.last_name) as assigned_to,
            c.email as assigned_email
          FROM assets a
          LEFT JOIN asset_types at ON a.type_id = at.id
          LEFT JOIN contacts c ON a.assigned_to = c.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY a.name
          LIMIT $${idx}
        `, values)

        return {
          assets: result.rows,
          total: result.rows.length,
        }
      },
    },
  }
}
