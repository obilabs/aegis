import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  description_template: z.string().nullable().optional(),
  subject_prefix: z.string().max(50).nullable().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
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

    // Verify category belongs to this org
    const existing = await pool.query(
      'SELECT id FROM ticket_categories WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    const data = parsed.data
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        updates.push(`${key} = $${paramIdx++}`)
        values.push(val)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = now()`)

    const result = await pool.query(
      `UPDATE ticket_categories SET ${updates.join(', ')}
       WHERE id = $${paramIdx++} AND organization_id = $${paramIdx}
       RETURNING *`,
      [...values, id, orgId]
    )

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A category with this name already exists at this level' }, { status: 409 })
    }
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const { id } = await params

    // Check if any tickets use this category
    const ticketCount = await pool.query(
      'SELECT COUNT(*) as count FROM tickets WHERE category_id = $1',
      [id]
    )
    if (parseInt(ticketCount.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a category that has tickets. Deactivate it instead.' },
        { status: 409 }
      )
    }

    // CASCADE will remove child categories too
    const result = await pool.query(
      'DELETE FROM ticket_categories WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
