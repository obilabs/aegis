/**
 * Retention Purge Worker
 *
 * Scheduled pg-boss job that enforces data retention policies.
 * Runs daily at 2:00 AM UTC, finds soft-deleted records past their retention
 * window, and hard-deletes them in batches of 100 per transaction.
 *
 * ## The audit row is part of the purge, not a notification about it
 *
 * A retention purge is the one operation in Aegis that destroys customer data
 * on a timer, with no human in the loop and nothing left to inspect
 * afterwards. Its audit row is therefore the only surviving record that the
 * deletion happened, what it covered and under which policy. "We deleted it
 * but cannot tell you what" is precisely the outcome the audit log exists to
 * prevent, so this module holds two rules:
 *
 *   1. The audit row is written INSIDE the same transaction as the DELETE
 *      (the pattern `lib/cascade-revoke.ts` and `lib/mtp-write.ts` already
 *      use). Either the rows are gone and the trail records it, or neither
 *      happened. A separate follow-up INSERT — what this module did before —
 *      can fail after the DELETE has committed, and then the data is gone with
 *      no trail and no way to reconstruct one.
 *   2. A failed purge is never reduced to a console line. The batch aborts,
 *      the entity type aborts, and `runRetentionPurge` throws, which fails the
 *      pg-boss job and leaves a durable, queryable record in the job table
 *      that does not depend on `audit_log` being writable — because the thing
 *      that failed may BE the audit write.
 */

import { pool } from '@/lib/db'
import { getQueue, QUEUES } from '@/lib/queue'

const BATCH_SIZE = 100

/**
 * Entity types this worker may hard-delete, and the only values ever
 * interpolated into `DELETE FROM <table>`. `purgeEntityType` already gates on
 * the same set via its switch; this constant is the second, explicit gate so
 * the interpolation in `purgeBatch` is safe on its own terms rather than by
 * reading a caller.
 */
const PURGEABLE_ENTITY_TYPES = [
  'contacts', 'tickets', 'assets', 'credentials', 'kb_articles', 'documents',
] as const

type PurgeableEntityType = (typeof PURGEABLE_ENTITY_TYPES)[number]

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
 *
 * One policy's failure does not stop the others: the policies are independent,
 * and a schema problem with `documents` is no reason to stop expiring
 * `tickets`. But the run as a whole then FAILS. pg-boss records the throw
 * against the job (retryLimit 3), so a purge that could not be recorded is
 * visible in the job table and in the worker's exit path — not only in a
 * console log.
 *
 * Exported for the tests in `retention-purge.test.ts`, which exercise this
 * loudness rather than assuming it.
 */
export async function runRetentionPurge(): Promise<void> {
  const policies = await pool.query<RetentionPolicy>(
    `SELECT organization_id, entity_type, retention_days, exempt_if_closed
     FROM data_retention_policies
     WHERE retention_mode = 'auto_purge' AND retention_days IS NOT NULL`
  )

  if (policies.rows.length === 0) {
    return // Nothing to purge
  }

  const failures: string[] = []

  for (const policy of policies.rows) {
    try {
      await purgeEntityType(policy)
    } catch (error) {
      const label = `${policy.entity_type} (org ${policy.organization_id})`
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${label}: ${message}`)

      console.error(`[Retention] Error purging ${label}:`, error)

      // Best effort, in its own transaction, and explicitly not the thing that
      // makes this failure visible — see recordPurgeFailure.
      await recordPurgeFailure(policy, message)
      // Continue to the next policy; the throw below reports the whole run.
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `[Retention] ${failures.length} of ${policies.rows.length} retention ` +
      `policies failed; data was NOT purged for them. ${failures.join(' | ')}`
    )
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

  // Process in batches.
  //
  // No try/catch around the batch. A batch that fails has deleted nothing (the
  // transaction rolled back), and whatever broke it — the audit chain, a lock,
  // a schema drift — will break the next batches too. Continuing would turn one
  // recorded failure into a long, partially-purged run whose extent nobody can
  // reconstruct. The throw propagates to runRetentionPurge, which records it
  // and fails the job.
  let purged = 0

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    purged += await purgeBatch({
      orgId: organization_id,
      entityType: entity_type as PurgeableEntityType,
      ids: batch,
      retentionDays: retention_days,
      batchOffset: i,
    })
  }

  console.log(
    `[Retention] Purged ${purged} ${entity_type} for org ${organization_id} (retention: ${retention_days} days)`
  )
}

/**
 * Hard-delete a batch of records AND record it, in a single transaction.
 * Cleans up junction tables first for contacts.
 *
 * Returns the number of entity rows actually deleted.
 *
 * The audit INSERT runs on the same client, inside the same transaction, after
 * the DELETE — so the row records what actually happened (the real row count,
 * not the intended one) and cannot outlive or be outlived by it. If the audit
 * write fails for any reason the transaction rolls back and nothing is
 * deleted: a purge that cannot be recorded does not happen.
 */
async function purgeBatch(args: {
  orgId: string
  entityType: PurgeableEntityType
  ids: string[]
  retentionDays: number
  batchOffset: number
}): Promise<number> {
  const { orgId, entityType, ids, retentionDays, batchOffset } = args

  // `entityType` is interpolated below, so gate it here rather than trusting
  // the caller's switch.
  if (!PURGEABLE_ENTITY_TYPES.includes(entityType)) {
    throw new Error(`[Retention] Refusing to purge unknown entity type: ${entityType}`)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let junctionRows = 0
    if (entityType === 'contacts') {
      // Clean up junction tables first
      for (const table of CONTACT_JUNCTION_TABLES) {
        const j = await client.query(`DELETE FROM ${table} WHERE contact_id = ANY($1)`, [ids])
        junctionRows += j.rowCount ?? 0
      }
    }

    // Delete the entity records
    const deleted = await client.query(`DELETE FROM ${entityType} WHERE id = ANY($1)`, [ids])
    const deletedCount = deleted.rowCount ?? 0

    // Record it, in this transaction. Same shape as every other audit write in
    // the codebase: actor_type 'system' (no human asked for this; the policy
    // did), payload in `new_values`. The chain columns (chain_seq,
    // hash_version, previous_hash, record_hash) are the database's to set —
    // migration 099's BEFORE INSERT trigger fills them.
    const audited = await client.query(
      `INSERT INTO audit_log (
         organization_id, actor_type, action, action_category,
         entity_type, new_values, success
       ) VALUES ($1, 'system', 'retention_purge', 'delete', $2, $3::jsonb, true)`,
      [
        orgId,
        entityType,
        JSON.stringify({
          count: deletedCount,
          requested: ids.length,
          retention_days: retentionDays,
          batch_offset: batchOffset,
          junction_rows: junctionRows,
          // Which rows, not just how many. Reconstructing "what did the 2am job
          // destroy" from a count alone is not possible.
          entity_ids: ids,
        }),
      ]
    )

    // An INSERT that affects no rows is the silent-failure shape migration 099
    // was written to avoid (a rule or trigger that swallows the write and
    // reports success). Treat it as the failure it is.
    if (audited.rowCount !== 1) {
      throw new Error(
        `[Retention] Audit row for the ${entityType} purge was not written ` +
        `(INSERT affected ${audited.rowCount} rows); rolling back the purge.`
      )
    }

    await client.query('COMMIT')
    return deletedCount
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Append a `retention_purge_failed` row for a policy that could not be purged.
 *
 * Best effort by necessity, and deliberately not the mechanism that makes the
 * failure visible: the most likely reason a purge failed is that `audit_log`
 * could not be written, in which case this write fails too. The visibility
 * guarantee is the throw in `runRetentionPurge` (which fails the pg-boss job);
 * this row is what puts the failure in front of the compliance reader when the
 * audit log IS healthy. It never throws, because throwing here would mask the
 * original error.
 */
async function recordPurgeFailure(policy: RetentionPolicy, message: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (
         organization_id, actor_type, action, action_category,
         entity_type, new_values, success, error_message
       ) VALUES ($1, 'system', 'retention_purge_failed', 'delete', $2, $3::jsonb, false, $4)`,
      [
        policy.organization_id,
        policy.entity_type,
        JSON.stringify({
          retention_days: policy.retention_days,
          exempt_if_closed: policy.exempt_if_closed,
        }),
        message,
      ]
    )
  } catch (err) {
    console.error(
      '[Retention] Could not record the purge failure in audit_log either ' +
      '(the run still fails loudly via the job):',
      err
    )
  }
}
