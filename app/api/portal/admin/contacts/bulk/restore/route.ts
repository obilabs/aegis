import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const result = await pool.query(
      `UPDATE contacts
       SET is_deleted = false, deleted_at = NULL, deleted_by_user_id = NULL,
           deleted_by_provider_id = NULL, deleted_by_name = NULL, delete_reason = NULL,
           restored_at = NOW(), restored_by_user_id = $3, updated_at = NOW()
       WHERE id = ANY($1) AND organization_id = $2 AND is_deleted = true
       RETURNING id, first_name, last_name`,
      [parsed.data.ids, orgId, userId]
    )

    for (const contact of result.rows) {
      logAudit({
        orgId, userId, action: 'contact_restored', actionCategory: 'update',
        entityType: 'contacts', entityId: contact.id,
        entityName: `${contact.first_name} ${contact.last_name}`,
        actorIp: getClientIp(request.headers),
      })
    }

    return NextResponse.json({ restored: result.rows.length })
  } catch (error) {
    console.error('Error bulk restoring contacts:', error)
    return NextResponse.json({ error: 'Failed to restore contacts' }, { status: 500 })
  }
}
