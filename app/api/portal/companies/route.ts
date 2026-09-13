import { pool } from '@/lib/db'
import { requireStaff } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['internal', 'client', 'customer', 'vendor', 'partner', 'prospect']).default('customer'),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx

    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.abbreviation,
        c.type,
        c.website,
        c.phone,
        c.email,
        c.city,
        c.state,
        c.country,
        c.industry,
        c.employee_count,
        c.is_active,
        c.created_at,
        COALESCE(contact_counts.cnt, 0)::int as contact_count,
        COALESCE(asset_counts.cnt, 0)::int as asset_count,
        COALESCE(ticket_counts.cnt, 0)::int as open_tickets
      FROM companies c
      LEFT JOIN (
        SELECT company_id, COUNT(*) as cnt
        FROM contacts
        WHERE organization_id = $1 AND is_deleted = false
        GROUP BY company_id
      ) contact_counts ON c.id = contact_counts.company_id
      LEFT JOIN (
        SELECT company_id, COUNT(*) as cnt
        FROM assets
        WHERE organization_id = $1 AND is_deleted = false
        GROUP BY company_id
      ) asset_counts ON c.id = asset_counts.company_id
      LEFT JOIN (
        SELECT t.contact_id, COUNT(*) as cnt
        FROM tickets t
        JOIN ticket_statuses ts ON t.status_id = ts.id
        WHERE t.organization_id = $1 AND ts.base_status != 'closed'
        GROUP BY t.contact_id
      ) ticket_counts ON ticket_counts.contact_id IN (
        SELECT co.id FROM contacts co WHERE co.company_id = c.id
      )
      WHERE c.organization_id = $1
      ORDER BY c.name ASC
    `, [orgId])

    return NextResponse.json({ companies: result.rows })
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx
    const body = await request.json()
    const parsed = createCompanySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    const result = await pool.query(`
      INSERT INTO companies (
        organization_id, name, type, email, phone, website,
        address, city, state, zip, country, industry, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      orgId,
      data.name.trim(),
      data.type,
      data.email?.trim() || null,
      data.phone?.trim() || null,
      data.website?.trim() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.zip?.trim() || null,
      data.country?.trim() || null,
      data.industry?.trim() || null,
      data.notes?.trim() || null,
    ])

    const company = result.rows[0]
    logAudit({
      orgId, userId, action: 'company_created', actionCategory: 'create',
      entityType: 'companies', entityId: company.id, entityName: data.name,
      newValues: parsed.data,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json(company, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A company with this name already exists' }, { status: 409 })
    }
    console.error('Error creating company:', error)
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }
}
