import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { z } from 'zod'

const searchSchema = z.object({
  type: z.enum(['contact', 'asset', 'ticket', 'credential', 'document', 'service', 'kb_article']),
  q: z.string().optional(),
  exclude: z.string().optional(), // comma-separated IDs to exclude
  limit: z.coerce.number().min(1).max(50).optional().default(20),
})

const QUERIES: Record<string, { sql: string; searchFields: string[] }> = {
  contact: {
    sql: `SELECT c.id, c.first_name || ' ' || COALESCE(c.last_name, '') AS name,
            c.email AS subtitle, c.contact_type AS type, c.status
          FROM contacts c
          WHERE c.organization_id = $1 AND c.is_deleted = false`,
    searchFields: ["c.first_name || ' ' || COALESCE(c.last_name, '')", 'c.email'],
  },
  asset: {
    sql: `SELECT a.id, a.name, a.asset_tag AS subtitle,
            at.name AS type, a.status
          FROM assets a
          LEFT JOIN asset_types at ON a.type_id = at.id
          WHERE a.organization_id = $1 AND a.is_deleted = false`,
    searchFields: ['a.name', 'a.asset_tag', 'a.serial_number'],
  },
  ticket: {
    sql: `SELECT t.id, 'TKT-' || LPAD(t.ticket_number::text, 4, '0') AS name,
            t.subject AS subtitle, tt.name AS type, ts.name AS status
          FROM tickets t
          LEFT JOIN ticket_types tt ON t.type_id = tt.id
          LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
          WHERE t.organization_id = $1`,
    searchFields: ['t.subject', "CAST(t.ticket_number AS TEXT)"],
  },
  credential: {
    sql: `SELECT cr.id, cr.name, cr.username AS subtitle,
            cr.credential_type AS type, cr.status
          FROM credentials cr
          WHERE cr.organization_id = $1 AND cr.is_deleted = false`,
    searchFields: ['cr.name', 'cr.username'],
  },
  document: {
    sql: `SELECT d.id, d.title AS name, NULL AS subtitle,
            NULL AS type, NULL AS status
          FROM documents d
          WHERE d.organization_id = $1`,
    searchFields: ['d.title'],
  },
  service: {
    sql: `SELECT s.id, s.name, s.description AS subtitle,
            s.category AS type, s.status
          FROM services s
          WHERE s.organization_id = $1`,
    searchFields: ['s.name', 's.description'],
  },
  kb_article: {
    sql: `SELECT a.id, a.title AS name, kc.name AS subtitle,
            CASE WHEN a.is_system THEN 'System' ELSE 'Custom' END AS type, a.status
          FROM kb_articles a
          LEFT JOIN kb_categories kc ON a.category_id = kc.id
          WHERE a.organization_id = $1 AND a.is_deleted = false AND a.status = 'published'`,
    searchFields: ['a.title', 'a.summary'],
  },
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = searchSchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten() }, { status: 400 })
  }

  const { type, q, exclude, limit } = parsed.data
  const queryDef = QUERIES[type]

  if (!queryDef) {
    return NextResponse.json({ entities: [] })
  }

  try {
    let sql = queryDef.sql
    const queryParams: (string | number)[] = [orgId]
    let paramIndex = 2

    // Search filter
    if (q && q.trim()) {
      const searchClauses = queryDef.searchFields.map(f => `${f} ILIKE $${paramIndex}`)
      sql += ` AND (${searchClauses.join(' OR ')})`
      queryParams.push(`%${q.trim()}%`)
      paramIndex++
    }

    // Exclude already-linked IDs
    if (exclude) {
      const excludeIds = exclude.split(',').filter(Boolean)
      if (excludeIds.length > 0) {
        const placeholders = excludeIds.map((_, i) => `$${paramIndex + i}`).join(',')
        const idColumn = type === 'ticket' ? 't.id' : type === 'credential' ? 'cr.id' : type === 'service' ? 's.id' : type === 'kb_article' ? 'a.id' : type === 'asset' ? 'a.id' : 'c.id'
        sql += ` AND ${idColumn} NOT IN (${placeholders})`
        queryParams.push(...excludeIds)
        paramIndex += excludeIds.length
      }
    }

    sql += ` ORDER BY name LIMIT $${paramIndex}`
    queryParams.push(limit)

    const result = await pool.query(sql, queryParams)

    return NextResponse.json({
      entities: result.rows.map((row: any) => ({
        id: row.id,
        name: row.name?.trim() || 'Unnamed',
        subtitle: row.subtitle || undefined,
        type: row.type || undefined,
        status: row.status || undefined,
      })),
    })
  } catch (error) {
    console.error(`Entity search failed for type ${type}:`, error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
