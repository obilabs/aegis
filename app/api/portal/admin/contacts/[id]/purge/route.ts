import { pool } from '@/lib/db'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { logAuditOnClient, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Permanently delete one soft-deleted contact.
 *
 * The audit row is written INSIDE the delete transaction, on the same client,
 * after the DELETE — the pattern `lib/retention-purge.ts`,
 * `lib/cascade-revoke.ts` and `lib/mtp-write.ts` already hold. A purge that
 * cannot be recorded does not happen, and the caller is told so (500) rather
 * than being handed a 204 for a deletion with no trail.
 *
 * It used to call fire-and-forget `logAudit` without `await` before opening the
 * transaction. That had a failure in each direction: an audit write that failed
 * was swallowed into a console line while the contact was destroyed and the
 * route answered 204, and a DELETE that failed left a committed `contact_purged`
 * row describing a purge that never happened (reproducible today — a contact
 * named on an `access_requests` row cannot be deleted, because that FK is
 * ON DELETE SET NULL against a NOT NULL column).
 */

/**
 * Junction/child tables cleaned up before the contact row goes.
 *
 * NOTE: this list does not cover every table with a NOT NULL FK to `contacts`
 * (`access_requests`, `asset_requests` and `offboarding_requests` are missing,
 * so a contact referenced by one of those cannot be purged at all — the
 * ON DELETE SET NULL fires against a NOT NULL column and Postgres refuses).
 * That is a separate bug and is left to its own change; what matters here is
 * that the failure can no longer produce an audit row claiming the purge
 * happened.
 */
const JUNCTION_TABLES = [
  'contact_tags', 'contact_group_members', 'dynamic_group_members',
  'contact_credentials', 'contact_files', 'email_preferences',
  'asset_contacts', 'kb_contributors', 'kb_permissions',
  'service_owners', 'software_contacts', 'team_members',
  'user_service_access', 'workspace_members',
]

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

    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check contact exists, is deleted, and not under legal hold
    const contactCheck = await pool.query(
      `SELECT id, first_name, last_name, email, contact_type, is_deleted, legal_hold
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

    // Clean up orphaned junction rows, delete the contact, and record it — all
    // in one transaction. All FKs are SET NULL, so these rows just have null
    // contact_id.
    const client = await pool.connect()
    let deleted = 0
    try {
      await client.query('BEGIN')

      // Clean up junction/child tables with null-safe deletes
      let junctionRows = 0
      for (const table of JUNCTION_TABLES) {
        const j = await client.query(`DELETE FROM ${table} WHERE contact_id = $1`, [id])
        junctionRows += j.rowCount ?? 0
      }

      // Delete the contact
      const del = await client.query('DELETE FROM contacts WHERE id = $1', [id])
      deleted = del.rowCount ?? 0

      if (deleted === 0) {
        // Someone else purged it between the check above and this statement.
        // Nothing was destroyed by us, so there is nothing to record.
        throw new ContactVanished()
      }

      // Record it, in this transaction, after the DELETE — so the row reports
      // what actually happened. The chain columns are migration 099's trigger's
      // to set, and a zero-rowCount INSERT is a failure (see logAuditOnClient).
      await logAuditOnClient(client, {
        orgId, userId, action: 'contact_purged', actionCategory: 'delete',
        entityType: 'contacts', entityId: id,
        entityName: `${contact.first_name} ${contact.last_name}`,
        actorName: session.user.name ?? session.user.email ?? null,
        actorEmail: session.user.email ?? null,
        newValues: {
          email: contact.email,
          first_name: contact.first_name,
          last_name: contact.last_name,
          contact_type: contact.contact_type,
          junction_rows: junctionRows,
        },
        actorIp: getClientIp(request.headers),
      })

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      if (err instanceof ContactVanished) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      throw err
    } finally {
      client.release()
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error purging contact:', error)
    // Nothing was deleted: the transaction above rolled back as a unit, so a
    // failed audit write is not a partial purge. The caller is told the contact
    // is still there rather than being given a success it cannot trust.
    return NextResponse.json(
      {
        error: 'Failed to permanently delete contact. Nothing was deleted — the contact is unchanged.',
      },
      { status: 500 }
    )
  }
}

/** The contact was already gone when the DELETE ran — a 404, not a failure. */
class ContactVanished extends Error {}
