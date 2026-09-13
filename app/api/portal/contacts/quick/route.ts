import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const quickCreateSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  contact_type: z.enum(['employee', 'customer', 'vendor', 'partner']).default('employee'),
  company_id: z.string().uuid().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const body = await request.json()
    const parsed = quickCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    const result = await pool.query(`
      INSERT INTO contacts (organization_id, first_name, last_name, email, contact_type, company_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name, last_name, email, contact_type
    `, [
      orgId,
      data.first_name.trim(),
      data.last_name.trim(),
      data.email?.trim() || null,
      data.contact_type,
      data.company_id || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
    }
    console.error('Error quick-creating contact:', error)
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}
