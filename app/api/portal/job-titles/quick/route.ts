import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const quickCreateSchema = z.object({
  name: z.string().min(1).max(200),
  department: z.string().max(200).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()
    const parsed = quickCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    const result = await pool.query(`
      INSERT INTO job_titles (organization_id, name, department, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, department
    `, [orgId, data.name.trim(), data.department?.trim() || null])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A job title with this name already exists' }, { status: 409 })
    }
    console.error('Error creating job title:', error)
    return NextResponse.json({ error: 'Failed to create job title' }, { status: 500 })
  }
}
