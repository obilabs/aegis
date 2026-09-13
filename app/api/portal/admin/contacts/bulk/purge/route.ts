import { pool } from '@/lib/db'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

const JUNCTION_TABLES = [
  'contact_tags', 'contact_group_members', 'dynamic_group_members',
  'contact_credentials', 'contact_files', 'email_preferences',
  'asset_contacts', 'kb_contributors', 'kb_permissions',
  'service_owners', 'software_contacts', 'team_members',
  'user_service_access', 'workspace_members',
]

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
      `SELECT id, first_name, last_name, email, is_deleted, legal_hold
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

    // Log all purges BEFORE deleting
    for (const contact of contacts.rows) {
      logAudit({
        orgId, userId, action: 'contact_purged', actionCategory: 'delete',
        entityType: 'contacts', entityId: contact.id,
        entityName: `${contact.first_name} ${contact.last_name}`,
        oldValues: { email: contact.email },
        actorIp: getClientIp(request.headers),
      })
    }

    // Purge in a transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (const table of JUNCTION_TABLES) {
        await client.query(`DELETE FROM ${table} WHERE contact_id = ANY($1)`, [purgeableIds])
      }

      await client.query('DELETE FROM contacts WHERE id = ANY($1)', [purgeableIds])

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return NextResponse.json({ purged: purgeableIds.length })
  } catch (error) {
    console.error('Error bulk purging contacts:', error)
    return NextResponse.json({ error: 'Failed to permanently delete contacts' }, { status: 500 })
  }
}
