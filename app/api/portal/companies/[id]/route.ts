import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['internal', 'client', 'customer', 'vendor', 'partner', 'prospect']).optional(),
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
  is_active: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { orgId } = ctx

    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM contacts WHERE company_id = c.id AND is_deleted = false) as contact_count,
        (SELECT COUNT(*)::int FROM assets WHERE company_id = c.id AND is_deleted = false) as asset_count
      FROM companies c
      WHERE c.id = $1 AND c.organization_id = $2
    `, [id, orgId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { userId, orgId } = ctx
    const body = await request.json()
    const parsed = updateCompanySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fields: Record<string, any> = {
      name: data.name?.trim(),
      type: data.type,
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      website: data.website?.trim(),
      address: data.address?.trim(),
      city: data.city?.trim(),
      state: data.state?.trim(),
      zip: data.zip?.trim(),
      country: data.country?.trim(),
      industry: data.industry?.trim(),
      notes: data.notes?.trim(),
      is_active: data.is_active,
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`)
        values.push(value ?? null)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    const result = await pool.query(
      `UPDATE companies SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const company = result.rows[0]
    logAudit({
      orgId, userId, action: 'company_updated', actionCategory: 'update',
      entityType: 'companies', entityId: id, entityName: company.name,
      newValues: parsed.data,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json(company)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A company with this name already exists' }, { status: 409 })
    }
    console.error('Error updating company:', error)
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 })
  }
}
