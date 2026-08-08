import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
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

    // Check contact exists, is deleted, and not under legal hold
    const contactCheck = await pool.query(
      `SELECT id, first_name, last_name, email, is_deleted, legal_hold
       FROM contacts WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (contactCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const contact = contactCheck.rows[0]

    if (!contact.is_deleted) {
      return NextResponse.json(
        { error: 'Contact must be soft-deleted before permanent deletion' },
        { status: 400 }
      )
    }

    if (contact.legal_hold) {
      return NextResponse.json(
        { error: 'Contact is under legal hold and cannot be permanently deleted' },
        { status: 403 }
      )
    }

    // Log BEFORE deleting (audit trail is append-only)
    logAudit({
      orgId, userId, action: 'contact_purged', actionCategory: 'delete',
      entityType: 'contacts', entityId: id,
      entityName: `${contact.first_name} ${contact.last_name}`,
      oldValues: { email: contact.email },
      actorIp: getClientIp(request.headers),
    })

    // Clean up orphaned junction rows then delete contact
    // All FKs are SET NULL, so these rows just have null contact_id
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Clean up junction/child tables with null-safe deletes
      await client.query('DELETE FROM contact_tags WHERE contact_id = $1', [id])
      await client.query('DELETE FROM contact_group_members WHERE contact_id = $1', [id])
      await client.query('DELETE FROM dynamic_group_members WHERE contact_id = $1', [id])
      await client.query('DELETE FROM contact_credentials WHERE contact_id = $1', [id])
      await client.query('DELETE FROM contact_files WHERE contact_id = $1', [id])
      await client.query('DELETE FROM email_preferences WHERE contact_id = $1', [id])
      await client.query('DELETE FROM asset_contacts WHERE contact_id = $1', [id])
      await client.query('DELETE FROM kb_contributors WHERE contact_id = $1', [id])
      await client.query('DELETE FROM kb_permissions WHERE contact_id = $1', [id])
      await client.query('DELETE FROM service_owners WHERE contact_id = $1', [id])
      await client.query('DELETE FROM software_contacts WHERE contact_id = $1', [id])
      await client.query('DELETE FROM team_members WHERE contact_id = $1', [id])
      await client.query('DELETE FROM user_service_access WHERE contact_id = $1', [id])
      await client.query('DELETE FROM workspace_members WHERE contact_id = $1', [id])

      // Delete the contact
      await client.query('DELETE FROM contacts WHERE id = $1', [id])

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error purging contact:', error)
    return NextResponse.json({ error: 'Failed to permanently delete contact' }, { status: 500 })
  }
}
