/**
 * Retention Purge Worker
 *
 * Scheduled pg-boss job that enforces data retention policies.
 * Runs daily at 2:00 AM UTC, finds soft-deleted records past their retention
 * window, and hard-deletes them in batches of 100 per transaction.
 */

import { pool } from '@/lib/db'
import { getQueue, QUEUES } from '@/lib/queue'

const BATCH_SIZE = 100

/** Junction/child tables to clean up before deleting a contact */
const CONTACT_JUNCTION_TABLES = [
  'contact_tags', 'contact_group_members', 'dynamic_group_members',
  'contact_credentials', 'contact_files', 'email_preferences',
  'asset_contacts', 'kb_contributors', 'kb_permissions',
  'service_owners', 'software_contacts', 'team_members',
  'user_service_access', 'workspace_members',
]

interface RetentionPolicy {
  organization_id: string
  entity_type: string
  retention_days: number
  exempt_if_closed: boolean
}

/**
 * Register the retention purge cron job with pg-boss.
 * Runs daily at 2:00 AM UTC.
 */
export async function registerRetentionPurgeJob(): Promise<void> {
  const queue = await getQueue()

  await queue.createQueue(QUEUES.RETENTION_PURGE)

  await queue.schedule(QUEUES.RETENTION_PURGE, '0 2 * * *', {}, {
    retryLimit: 3,
    retryDelay: 300, // 5 min between retries
  })

  await queue.work(QUEUES.RETENTION_PURGE, { batchSize: 1 }, async () => {
    await runRetentionPurge()
  })

  console.log('[pg-boss] Retention purge job registered (daily at 2:00 AM UTC)')
}

/**
 * Main purge execution — queries all auto_purge policies and processes each.
 */
async function runRetentionPurge(): Promise<void> {
  const policies = await pool.query<RetentionPolicy>(
    `SELECT organization_id, entity_type, retention_days, exempt_if_closed
     FROM data_retention_policies
     WHERE retention_mode = 'auto_purge' AND retention_days IS NOT NULL`
  )

  if (policies.rows.length === 0) {
    return // Nothing to purge
  }

  for (const policy of policies.rows) {
    try {
      await purgeEntityType(policy)
    } catch (error) {
      console.error(
        `[Retention] Error purging ${policy.entity_type} for org ${policy.organization_id}:`,
        error
      )
      // Continue to next policy — don't let one failure block others
    }
  }
}

/**
 * Purge aged-out soft-deleted records for a single entity type and org.
 */
async function purgeEntityType(policy: RetentionPolicy): Promise<void> {
  const { organization_id, entity_type, retention_days, exempt_if_closed } = policy

  // Build the query to find purgeable records
  let query: string
  const values: any[] = [organization_id, retention_days]

  switch (entity_type) {
    case 'contacts':
      query = `
        SELECT id FROM contacts
        WHERE organization_id = $1
          AND is_deleted = true
          AND legal_hold = false
          AND deleted_at < NOW() - make_interval(days => $2)
        ORDER BY deleted_at ASC
      `
      break

    case 'tickets':
      if (exempt_if_closed) {
        query = `
          SELECT t.id FROM tickets t
          JOIN ticket_statuses ts ON t.status_id = ts.id
          WHERE t.organization_id = $1
            AND t.is_deleted = true
            AND t.legal_hold = false
            AND t.deleted_at < NOW() - make_interval(days => $2)
            AND ts.name NOT IN ('Closed', 'Resolved')
          ORDER BY t.deleted_at ASC
        `
      } else {
        query = `
          SELECT id FROM tickets
          WHERE organization_id = $1
            AND is_deleted = true
            AND legal_hold = false
            AND deleted_at < NOW() - make_interval(days => $2)
          ORDER BY deleted_at ASC
        `
      }
      break

    case 'assets':
      query = `
        SELECT id FROM assets
        WHERE organization_id = $1
          AND is_deleted = true
          AND legal_hold = false
          AND deleted_at < NOW() - make_interval(days => $2)
        ORDER BY deleted_at ASC
      `
      break

    case 'credentials':
      query = `
        SELECT id FROM credentials
        WHERE organization_id = $1
          AND is_deleted = true
          AND legal_hold = false
          AND deleted_at < NOW() - make_interval(days => $2)
        ORDER BY deleted_at ASC
      `
      break

    case 'kb_articles':
      query = `
        SELECT id FROM kb_articles
        WHERE organization_id = $1
          AND is_deleted = true
          AND legal_hold = false
          AND deleted_at < NOW() - make_interval(days => $2)
        ORDER BY deleted_at ASC
      `
      break

    case 'documents':
      query = `
        SELECT id FROM documents
        WHERE organization_id = $1
          AND is_deleted = true
          AND legal_hold = false
          AND deleted_at < NOW() - make_interval(days => $2)
        ORDER BY deleted_at ASC
      `
      break

    default:
      console.warn(`[Retention] Unknown entity type: ${entity_type}`)
      return
  }

  const result = await pool.query(query, values)
  const ids: string[] = result.rows.map((r: any) => r.id)

  if (ids.length === 0) return

  // Process in batches
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)

    try {
      await purgeBatch(organization_id, entity_type, batch)

      // Log to audit trail
      await pool.query(
        `INSERT INTO audit_log (organization_id, action, action_category, entity_type, details)
         VALUES ($1, 'retention_purge', 'delete', $2, $3)`,
        [
          organization_id,
          entity_type,
          JSON.stringify({
            count: batch.length,
            retention_days,
            batch_offset: i,
          }),
        ]
      )
    } catch (error) {
      console.error(
        `[Retention] Batch purge failed for ${entity_type} (batch at offset ${i}):`,
        error
      )
      // Continue to next batch — partial failures are acceptable
    }
  }

  console.log(
    `[Retention] Purged ${ids.length} ${entity_type} for org ${organization_id} (retention: ${retention_days} days)`
  )
}

/**
 * Hard-delete a batch of records in a single transaction.
 * Cleans up junction tables first for contacts.
 */
async function purgeBatch(
  orgId: string,
  entityType: string,
  ids: string[]
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (entityType === 'contacts') {
      // Clean up junction tables first
      for (const table of CONTACT_JUNCTION_TABLES) {
        await client.query(`DELETE FROM ${table} WHERE contact_id = ANY($1)`, [ids])
      }
    }

    // Delete the entity records
    await client.query(`DELETE FROM ${entityType} WHERE id = ANY($1)`, [ids])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
