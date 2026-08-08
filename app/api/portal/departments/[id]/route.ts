import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { id } = await params

    // Authorization (audit 2026-07-23): editing a department is a settings action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
      return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 3

    if (parsed.data.name !== undefined) {
      updates.push(`name = $${paramIndex}`)
      values.push(parsed.data.name.trim())
      paramIndex++
    }

    if (parsed.data.code !== undefined) {
      updates.push(`code = $${paramIndex}`)
      values.push(parsed.data.code?.trim() || null)
      paramIndex++
    }

    if (parsed.data.description !== undefined) {
      updates.push(`description = $${paramIndex}`)
      values.push(parsed.data.description?.trim() || null)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = now()')

    const result = await pool.query(
      `UPDATE departments SET ${updates.join(', ')}
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, code, description, parent_id, employee_count`,
      [id, orgId, ...values]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
        { status: 409 }
      )
    }
    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { id } = await params

    // Authorization (audit 2026-07-23): deleting a department is a settings action.
    const ctx = await getAuthContext(request)
    if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
      return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
    }

    // Check for child departments
    const children = await pool.query(
      'SELECT id FROM departments WHERE parent_id = $1 AND organization_id = $2 AND is_active = true',
      [id, orgId]
    )

    if (children.rows.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a department that has sub-departments. Remove or reassign them first.' },
        { status: 409 }
      )
    }

    // Soft delete by setting is_active = false
    const result = await pool.query(
      `UPDATE departments SET is_active = false, updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}
