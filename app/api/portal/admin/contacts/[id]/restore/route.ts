import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await pool.query(
      `UPDATE contacts
       SET is_deleted = false, deleted_at = NULL, deleted_by_user_id = NULL,
           deleted_by_provider_id = NULL, deleted_by_name = NULL, delete_reason = NULL,
           restored_at = NOW(), restored_by_user_id = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND is_deleted = true
       RETURNING id, first_name, last_name, email`,
      [id, orgId, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found or not deleted' }, { status: 404 })
    }

    const contact = result.rows[0]
    logAudit({
      orgId, userId, action: 'contact_restored', actionCategory: 'update',
      entityType: 'contacts', entityId: id,
      entityName: `${contact.first_name} ${contact.last_name}`,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error restoring contact:', error)
    return NextResponse.json({ error: 'Failed to restore contact' }, { status: 500 })
  }
}
