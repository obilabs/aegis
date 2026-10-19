import { pool } from '@/lib/db'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { logAuditOnClient, getClientIp } from '@/lib/audit'
import { countContactAnonymisations, purgeContactLinkRows } from '@/lib/contact-purge'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Permanently delete up to 100 soft-deleted contacts.
 *
 * Same guarantee as the single-contact route, and for the same reason: the
 * audit rows are written INSIDE the delete transaction, on the same client,
 * after the DELETE. One row per contact (so the trail stays queryable by
 * `entity_id`, as it was before), all in the one transaction — so the batch is
 * all-or-nothing in both directions. There is no state in which a contact is
 * gone and its row is missing, and no state in which a row claims a purge that
 * did not happen.
 *
 * This used to call fire-and-forget `logAudit` in a loop, un-awaited, before
 * the transaction opened: up to 100 rows written on other connections whose
 * failures were swallowed into console lines, while the route answered
 * `{ purged: n }` regardless.
 */

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

    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    // Verify all contacts are soft-deleted and not under legal hold
    const contacts = await pool.query(
      `SELECT id, first_name, last_name, email, contact_type, is_deleted, legal_hold
       FROM contacts WHERE id = ANY($1) AND organization_id = $2`,
      [parsed.data.ids, orgId]
    )

    const blocked = contacts.rows.filter((c: any) => !c.is_deleted || c.legal_hold)
    if (blocked.length > 0) {
      return NextResponse.json({
        error: 'Some contacts cannot be purged',
        blocked: blocked.map((c: any) => ({
          id: c.id,
          reason: !c.is_deleted ? 'not deleted' : 'legal hold',
        })),
      }, { status: 400 })
    }

    const purgeableIds = contacts.rows.map((c: any) => c.id)
    if (purgeableIds.length === 0) {
      return NextResponse.json({ purged: 0 })
    }

    // Purge and record, in one transaction
    const client = await pool.connect()
    let deleted = 0
    try {
      await client.query('BEGIN')

      // The same definition of "purge" the single-contact route uses — one
      // list, in lib/contact-purge.ts, so the two paths cannot drift.
      const junctionRows = await purgeContactLinkRows(client, purgeableIds)

      // Counted before the DELETE, for the same reason as the single route: the
      // records that are anonymised rather than destroyed are the half of the
      // story the trail used to leave out.
      const anonymised = await countContactAnonymisations(client, purgeableIds)

      const del = await client.query('DELETE FROM contacts WHERE id = ANY($1)', [purgeableIds])
      deleted = del.rowCount ?? 0

      // One row per contact, after the DELETE, on this client. Each INSERT is
      // awaited and a zero rowCount is a failure (see logAuditOnClient), so a
      // single unwritten row aborts the whole batch.
      for (const contact of contacts.rows) {
        await logAuditOnClient(client, {
          orgId, userId, action: 'contact_purged', actionCategory: 'delete',
          entityType: 'contacts', entityId: contact.id,
          entityName: `${contact.first_name} ${contact.last_name}`,
          actorName: session.user.name ?? session.user.email ?? null,
          actorEmail: session.user.email ?? null,
          newValues: {
            email: contact.email,
            first_name: contact.first_name,
            last_name: contact.last_name,
            contact_type: contact.contact_type,
            batch_size: purgeableIds.length,
            batch_deleted: deleted,
            batch_junction_rows: junctionRows,
            batch_anonymised_rows: anonymised.total,
            batch_anonymised_by_column: anonymised.byColumn,
          },
          actorIp: getClientIp(request.headers),
        })
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return NextResponse.json({ purged: deleted })
  } catch (error) {
    console.error('Error bulk purging contacts:', error)
    // The transaction rolled back as a unit, so this is never a partial purge:
    // every contact in the request is still there.
    return NextResponse.json(
      {
        error: 'Failed to permanently delete contacts. Nothing was deleted — all of the contacts are unchanged.',
      },
      { status: 500 }
    )
  }
}
