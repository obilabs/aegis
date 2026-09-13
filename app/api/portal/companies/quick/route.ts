import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const quickCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['internal', 'client', 'customer', 'vendor', 'partner', 'prospect']).default('customer'),
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
      INSERT INTO companies (organization_id, name, type, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, type
    `, [orgId, data.name.trim(), data.type])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A company with this name already exists' }, { status: 409 })
    }
    console.error('Error creating company:', error)
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }
}
