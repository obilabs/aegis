import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const createContactSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  contact_type: z.enum(['employee', 'customer', 'vendor', 'partner']),
  company_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  job_title_id: z.string().uuid().optional().nullable(),
  is_primary: z.boolean().optional(),
  is_vip: z.boolean().optional(),
  has_portal_access: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx

    const result = await pool.query(`
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.mobile,
        c.title,
        c.department_legacy as department,
        c.company_id,
        cl.name as company_name,
        c.contact_type,
        c.is_primary,
        c.is_technical,
        c.is_billing,
        c.is_vip,
        c.has_portal_access,
        c.created_at,
        COALESCE(tc.cnt, 0)::int as ticket_count,
        tc.last_ticket as last_ticket_at
      FROM contacts c
      LEFT JOIN companies cl ON c.company_id = cl.id
      LEFT JOIN (
        SELECT contact_id, COUNT(*) as cnt, MAX(created_at) as last_ticket
        FROM tickets
        WHERE organization_id = $1
        GROUP BY contact_id
      ) tc ON c.id = tc.contact_id
      WHERE c.organization_id = $1
        AND c.is_deleted = false
      ORDER BY c.first_name ASC, c.last_name ASC
    `, [orgId])

    return NextResponse.json({ contacts: result.rows })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx
    const body = await request.json()
    const parsed = createContactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Validate type-specific requirements
    if (data.contact_type === 'employee') {
      if (!data.department_id) {
        return NextResponse.json({ error: 'Employees require a department' }, { status: 400 })
      }
      if (!data.job_title_id) {
        return NextResponse.json({ error: 'Employees require a job title' }, { status: 400 })
      }
    }
    if (['customer', 'vendor', 'partner'].includes(data.contact_type) && !data.company_id) {
      return NextResponse.json({ error: `${data.contact_type} contacts require a company` }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO contacts (
        organization_id, first_name, last_name, email, phone, mobile,
        title, contact_type, company_id, location_id, department_id, job_title_id,
        is_primary, is_vip, has_portal_access, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      orgId,
      data.first_name.trim(),
      data.last_name.trim(),
      data.email?.trim() || null,
      data.phone?.trim() || null,
      data.mobile?.trim() || null,
      data.title?.trim() || null,
      data.contact_type,
      data.company_id || null,
      data.location_id || null,
      data.department_id || null,
      data.job_title_id || null,
      data.is_primary ?? false,
      data.is_vip ?? false,
      data.has_portal_access ?? false,
      data.notes?.trim() || null,
    ])

    const contact = result.rows[0]
    logAudit({
      orgId, userId, action: 'contact_created', actionCategory: 'create',
      entityType: 'contacts', entityId: contact.id,
      entityName: `${data.first_name} ${data.last_name}`,
      newValues: parsed.data,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
    }
    console.error('Error creating contact:', error)
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}
