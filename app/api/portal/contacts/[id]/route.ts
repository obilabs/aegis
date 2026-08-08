import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateContactSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  contact_type: z.enum(['employee', 'customer', 'vendor', 'partner']).optional(),
  company_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  job_title_id: z.string().uuid().optional().nullable(),
  is_primary: z.boolean().optional(),
  is_vip: z.boolean().optional(),
  has_portal_access: z.boolean().optional(),
  notes: z.string().optional().nullable(),
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
      SELECT
        c.*,
        cl.name as company_name,
        d.name as department_name,
        jt.name as job_title_name,
        l.name as location_name,
        u.id as user_id,
        u.email as user_email,
        r.name as user_role
      FROM contacts c
      LEFT JOIN companies cl ON c.company_id = cl.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN job_titles jt ON c.job_title_id = jt.id
      LEFT JOIN locations l ON c.location_id = l.id
      LEFT JOIN users u ON u.contact_id = c.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE c.id = $1 AND c.organization_id = $2 AND c.is_deleted = false
    `, [id, orgId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 })
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

    // Authorization (audit 2026-07-23): editing a contact (people record) is a
    // user_management action — surfaced only on the /portal/contacts people
    // screens, never the ticket flow. Without this any authenticated user could.
    if (!(await hasCapabilityOrAdmin(userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateContactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fields: Record<string, any> = {
      first_name: data.first_name?.trim(),
      last_name: data.last_name?.trim(),
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      mobile: data.mobile?.trim(),
      title: data.title?.trim(),
      contact_type: data.contact_type,
      company_id: data.company_id,
      location_id: data.location_id,
      department_id: data.department_id,
      job_title_id: data.job_title_id,
      is_primary: data.is_primary,
      is_vip: data.is_vip,
      has_portal_access: data.has_portal_access,
      notes: data.notes?.trim(),
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
      `UPDATE contacts SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex} AND is_deleted = false
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const contact = result.rows[0]
    logAudit({
      orgId, userId, action: 'contact_updated', actionCategory: 'update',
      entityType: 'contacts', entityId: id,
      entityName: `${contact.first_name} ${contact.last_name}`,
      newValues: parsed.data,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json(contact)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
    }
    console.error('Error updating contact:', error)
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Authorization (audit 2026-07-23): deleting a contact is a
    // user_management action. Without this any authenticated user could.
    if (!(await hasCapabilityOrAdmin(userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    // Parse optional delete_reason from request body
    let deleteReason: string | null = null
    try {
      const body = await request.json()
      deleteReason = body?.delete_reason || null
    } catch {
      // No body is fine — delete_reason is optional
    }

    const result = await pool.query(
      `UPDATE contacts
       SET is_deleted = true, deleted_at = NOW(), deleted_by_user_id = $3,
           delete_reason = $4, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND is_deleted = false
       RETURNING id`,
      [id, orgId, userId, deleteReason]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    logAudit({
      orgId, userId, action: 'contact_deleted', actionCategory: 'delete',
      entityType: 'contacts', entityId: id,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}
