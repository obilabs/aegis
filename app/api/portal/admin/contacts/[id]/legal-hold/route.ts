import { pool } from '@/lib/db'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const legalHoldSchema = z.object({
  legal_hold: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx
    const { id } = await params

    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = legalHoldSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const result = await pool.query(
      `UPDATE contacts SET legal_hold = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, first_name, last_name, legal_hold`,
      [id, orgId, parsed.data.legal_hold]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const contact = result.rows[0]
    logAudit({
      orgId, userId,
      action: parsed.data.legal_hold ? 'legal_hold_enabled' : 'legal_hold_disabled',
      actionCategory: 'update',
      entityType: 'contacts', entityId: id,
      entityName: `${contact.first_name} ${contact.last_name}`,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error updating legal hold:', error)
    return NextResponse.json({ error: 'Failed to update legal hold' }, { status: 500 })
  }
}
