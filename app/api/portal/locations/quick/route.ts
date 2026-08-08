import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const quickCreateSchema = z.object({
  name: z.string().min(1).max(200),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
})

export async function POST(request: NextRequest) {
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
      INSERT INTO locations (organization_id, name, city, country)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, city, country
    `, [orgId, data.name.trim(), data.city?.trim() || null, data.country?.trim() || null])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A location with this name already exists' }, { status: 409 })
    }
    console.error('Error creating location:', error)
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}
