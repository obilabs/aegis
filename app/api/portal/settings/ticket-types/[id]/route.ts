import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { z } from 'zod'

const updateSchema = z.object({
  description_template: z.string().nullable().optional(),
  default_priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  requires_approval: z.boolean().optional(),
  sla_response_minutes: z.number().int().positive().nullable().optional(),
  sla_resolution_minutes: z.number().int().positive().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const { id } = await params
    const body = await request.json()

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Verify the ticket type belongs to this org
    const existing = await pool.query(
      'SELECT id FROM ticket_types WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    const data = parsed.data
    if (data.description_template !== undefined) {
      updates.push(`description_template = $${paramIdx++}`)
      values.push(data.description_template)
    }
    if (data.default_priority !== undefined) {
      updates.push(`default_priority = $${paramIdx++}`)
      values.push(data.default_priority)
    }
    if (data.requires_approval !== undefined) {
      updates.push(`requires_approval = $${paramIdx++}`)
      values.push(data.requires_approval)
    }
    if (data.sla_response_minutes !== undefined) {
      updates.push(`sla_response_minutes = $${paramIdx++}`)
      values.push(data.sla_response_minutes)
    }
    if (data.sla_resolution_minutes !== undefined) {
      updates.push(`sla_resolution_minutes = $${paramIdx++}`)
      values.push(data.sla_resolution_minutes)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = now()`)

    const result = await pool.query(
      `UPDATE ticket_types SET ${updates.join(', ')}
       WHERE id = $${paramIdx++} AND organization_id = $${paramIdx}
       RETURNING *`,
      [...values, id, orgId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating ticket type:', error)
    return NextResponse.json({ error: 'Failed to update ticket type' }, { status: 500 })
  }
}
