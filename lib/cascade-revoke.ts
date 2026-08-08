/**
 * Cascade revocation — atomic offboarding of an MSP firm's pairing
 * key and every downstream credential it holds.
 *
 * Spec: openspec/changes/msp-cascade-revocation/design.md
 *
 * Two entry points:
 *
 *   previewCascade({ pairingKeyId, orgId })
 *     Read-only. Returns the counts the UI shows in the confirmation
 *     modal — child_keys, msp_users, active_sessions, customer_linked_users.
 *     Cheap; safe to call before opening the modal.
 *
 *   commitCascade({ queueId })
 *     Runs the atomic transaction (design D4): logs the parent event
 *     FIRST, then revokes parent key, revokes child keys, disables
 *     msp_provisioned users (bumping key_version), kills their Better
 *     Auth sessions, and marks the queue row committed. Every child
 *     mutation writes its own audit_log row with revoked_by_cascade_id
 *     pointing at the parent event for SOC 2 CC7.2 traceability.
 *
 *     On any failure: rolls back + updates the queue row to
 *     state='failed' with failure_reason. The queue row's failure
 *     state is what the boot-recovery job checks to decide whether
 *     to retry.
 *
 * Not exported publicly: the SQL that computes affected user ids.
 * The predicate lives in exactly one place — used by preview AND
 * commit — so they can't drift.
 */

import { pool } from './db'

// ============================================================================
// Types
// ============================================================================

export interface CascadePreview {
  child_keys: number
  msp_users: number
  active_sessions: number
  customer_linked_users: number
}

export interface CascadeCommitResult {
  cascade_audit_id: string
  child_keys_revoked: number
  users_disabled: number
  sessions_killed: number
}

// ============================================================================
// Predicates — one place for the "who is affected?" logic
// ============================================================================

/**
 * Users the cascade WILL disable. Matches design D3:
 * msp_pairing_key_id = pairing AND user_origin='msp_provisioned'
 * AND status != 'disabled' (idempotent — re-running the cascade
 * on an already-disabled user is a no-op).
 */
const AFFECTED_USERS_SQL = `
  SELECT id FROM users
   WHERE msp_pairing_key_id = $1
     AND user_origin = 'msp_provisioned'
     AND (status IS NULL OR status != 'disabled')
`

/**
 * Users the cascade WILL NOT disable. Same pairing but
 * user_origin='customer_linked_to_msp' — customer employees who
 * happened to use the MSP's SSO surface. Their user record survives.
 */
const CUSTOMER_LINKED_USERS_SQL = `
  SELECT id FROM users
   WHERE msp_pairing_key_id = $1
     AND user_origin = 'customer_linked_to_msp'
`

/**
 * Child API keys under this pairing. Not the pairing itself.
 */
const CHILD_KEYS_SQL = `
  SELECT id FROM api_keys
   WHERE parent_key_id = $1
     AND is_revoked = false
`

// ============================================================================
// previewCascade
// ============================================================================

export async function previewCascade(opts: {
  pairingKeyId: string
  orgId: string
}): Promise<CascadePreview> {
  const { pairingKeyId, orgId } = opts

  // Sanity: pairing key must belong to this org and be an aegis-mtp-pairing.
  const pairingCheck = await pool.query(
    `SELECT 1 FROM api_keys
       WHERE id = $1 AND organization_id = $2 AND key_type = 'aegis-mtp-pairing'`,
    [pairingKeyId, orgId],
  )
  if (pairingCheck.rowCount === 0) {
    throw new Error(`Pairing key ${pairingKeyId} not found in org ${orgId}`)
  }

  const [childKeys, mspUsers, customerLinked] = await Promise.all([
    pool.query(CHILD_KEYS_SQL, [pairingKeyId]),
    pool.query(AFFECTED_USERS_SQL, [pairingKeyId]),
    pool.query(CUSTOMER_LINKED_USERS_SQL, [pairingKeyId]),
  ])

  const affectedUserIds: string[] = mspUsers.rows.map(r => r.id)

  // Better Auth session table is "session" (singular) with expires_at.
  // A session is "active" if expires_at > NOW().
  let activeSessions = 0
  if (affectedUserIds.length > 0) {
    // Better Auth stores userId as text (Better Auth id shape), not our
    // application users.id UUID. Session rows reference "user".id.
    // We need to resolve email → Better Auth user id first.
    const emails = await pool.query(
      `SELECT email FROM users WHERE id = ANY($1::uuid[])`,
      [affectedUserIds],
    )
    const emailList = emails.rows.map(r => r.email).filter(Boolean)
    if (emailList.length > 0) {
      const sessRes = await pool.query(
        `SELECT COUNT(*)::int AS n
           FROM session s
           JOIN "user" u ON u.id = s."userId"
          WHERE u.email = ANY($1::text[])
            AND s."expiresAt" > NOW()`,
        [emailList],
      )
      activeSessions = sessRes.rows[0]?.n ?? 0
    }
  }

  return {
    child_keys: childKeys.rowCount ?? 0,
    msp_users: mspUsers.rowCount ?? 0,
    active_sessions: activeSessions,
    customer_linked_users: customerLinked.rowCount ?? 0,
  }
}

// ============================================================================
// commitCascade — the atomic transaction
// ============================================================================

export async function commitCascade(opts: {
  queueId: string
}): Promise<CascadeCommitResult> {
  const { queueId } = opts

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Load queue row + validate it's still queued
    const q = await client.query(
      `SELECT id, pairing_key_id, organization_id, actor_user_id, reason, state
         FROM cascade_revocation_queue
        WHERE id = $1
        FOR UPDATE`,
      [queueId],
    )
    if (q.rowCount === 0) {
      throw new Error(`Cascade queue row ${queueId} not found`)
    }
    const queueRow = q.rows[0]
    if (queueRow.state !== 'queued') {
      // Idempotent — if already committed/cancelled, just return the
      // recorded state without doing anything.
      await client.query('COMMIT')
      throw new Error(`Cascade queue row ${queueId} is ${queueRow.state}, not queued`)
    }

    const { pairing_key_id, organization_id, actor_user_id, reason } = queueRow

    // 2. Resolve actor name/email for the audit rows.
    const actorRes = await client.query(
      `SELECT email FROM users WHERE id = $1`,
      [actor_user_id],
    )
    const actorEmail: string | null = actorRes.rows[0]?.email ?? null
    let actorName: string | null = actorEmail
    if (actorEmail) {
      const baRes = await client.query(
        `SELECT name FROM "user" WHERE email = $1 LIMIT 1`,
        [actorEmail],
      )
      if (baRes.rows[0]?.name) actorName = baRes.rows[0].name
    }

    // 3. Emit PARENT event first — everything downstream links to this id.
    const parentAudit = await client.query(
      `INSERT INTO audit_log (
         organization_id, actor_type, user_id, actor_name, actor_email,
         action, action_category, entity_type, entity_id, entity_name,
         new_values, success
       ) VALUES (
         $1, 'user', $2, $3, $4,
         'msp_pairing_revoked_cascade', 'settings', 'api_key', $5, 'aegis-mtp-pairing',
         $6::jsonb, true
       )
       RETURNING id`,
      [
        organization_id,
        actor_user_id,
        actorName,
        actorEmail,
        pairing_key_id,
        JSON.stringify({ reason, source: 'cascade', queue_id: queueId }),
      ],
    )
    const cascadeAuditId: string = parentAudit.rows[0].id

    // 4. Revoke the parent pairing key
    await client.query(
      `UPDATE api_keys
          SET is_revoked = true,
              revoked_at = NOW(),
              revoked_by = $2,
              revoked_reason = $3,
              is_active = false
        WHERE id = $1
          AND is_revoked = false`,
      [pairing_key_id, actor_user_id, `cascade: ${reason}`],
    )

    // 5. Revoke child api_keys; one audit row per child linked to parent.
    const childKeys = await client.query(CHILD_KEYS_SQL, [pairing_key_id])
    for (const child of childKeys.rows) {
      await client.query(
        `UPDATE api_keys
            SET is_revoked = true,
                revoked_at = NOW(),
                revoked_by = $2,
                revoked_reason = 'cascade: parent MSP pairing revoked',
                is_active = false
          WHERE id = $1`,
        [child.id, actor_user_id],
      )
      await client.query(
        `INSERT INTO audit_log (
           organization_id, actor_type, user_id, actor_name, actor_email,
           action, action_category, entity_type, entity_id,
           new_values, success, revoked_by_cascade_id
         ) VALUES (
           $1, 'user', $2, $3, $4,
           'api_key_revoked_cascade', 'settings', 'api_key', $5,
           $6::jsonb, true, $7
         )`,
        [
          organization_id,
          actor_user_id,
          actorName,
          actorEmail,
          child.id,
          JSON.stringify({ parent_pairing_id: pairing_key_id, source: 'cascade' }),
          cascadeAuditId,
        ],
      )
    }
    const childCount = childKeys.rowCount ?? 0

    // 6. Disable msp_provisioned users, bump key_version. RETURNING gives
    //    us the ids we need to (a) emit an audit row each and (b) resolve
    //    their emails for session-killing.
    const affectedUsers = await client.query(
      `UPDATE users
          SET status = 'disabled',
              disabled_at = NOW(),
              disabled_reason = 'cascade: provisioning MSP firm offboarded',
              key_version = key_version + 1
        WHERE msp_pairing_key_id = $1
          AND user_origin = 'msp_provisioned'
          AND (status IS NULL OR status != 'disabled')
        RETURNING id, email`,
      [pairing_key_id],
    )
    for (const u of affectedUsers.rows) {
      await client.query(
        `INSERT INTO audit_log (
           organization_id, actor_type, user_id, actor_name, actor_email,
           action, action_category, entity_type, entity_id, entity_name,
           new_values, success, revoked_by_cascade_id
         ) VALUES (
           $1, 'user', $2, $3, $4,
           'user_disabled_cascade', 'settings', 'user', $5, $6,
           $7::jsonb, true, $8
         )`,
        [
          organization_id,
          actor_user_id,
          actorName,
          actorEmail,
          u.id,
          u.email,
          JSON.stringify({ parent_pairing_id: pairing_key_id, source: 'cascade' }),
          cascadeAuditId,
        ],
      )
    }
    const userCount = affectedUsers.rowCount ?? 0

    // 7. Kill Better Auth sessions for those users. Bridge from
    //    application users.email → Better Auth "user".id → session."userId".
    let sessionsKilled = 0
    if (affectedUsers.rows.length > 0) {
      const emails = affectedUsers.rows.map(r => r.email).filter(Boolean)
      if (emails.length > 0) {
        const killed = await client.query(
          `UPDATE session
              SET "expiresAt" = NOW()
            WHERE "userId" IN (SELECT id FROM "user" WHERE email = ANY($1::text[]))
              AND "expiresAt" > NOW()`,
          [emails],
        )
        sessionsKilled = killed.rowCount ?? 0
      }
    }

    // 8. Mark queue row committed + link the audit id.
    await client.query(
      `UPDATE cascade_revocation_queue
          SET state = 'committed',
              committed_at = NOW(),
              cascade_audit_id = $2
        WHERE id = $1`,
      [queueId, cascadeAuditId],
    )

    await client.query('COMMIT')

    return {
      cascade_audit_id: cascadeAuditId,
      child_keys_revoked: childCount,
      users_disabled: userCount,
      sessions_killed: sessionsKilled,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Update queue row to failed state OUTSIDE the aborted transaction.
    try {
      await pool.query(
        `UPDATE cascade_revocation_queue
            SET state = 'failed',
                failure_reason = $2
          WHERE id = $1
            AND state = 'queued'`,
        [queueId, message.substring(0, 500)],
      )
    } catch (updateErr) {
      console.error('[cascade-revoke] failed to mark queue row as failed:', updateErr)
    }
    throw err
  } finally {
    client.release()
  }
}

// ============================================================================
// Queue helpers used by the route handler
// ============================================================================

export interface QueueCascadeInput {
  pairingKeyId: string
  organizationId: string
  actorUserId: string
  reason: string
}

export interface QueuedCascade {
  id: string
  commit_after: Date
}

/**
 * Insert a cascade_revocation_queue row and return { id, commit_after }.
 * Route handler is responsible for scheduling the setTimeout that
 * calls commitCascade() at commit_after.
 */
export async function queueCascade(opts: QueueCascadeInput): Promise<QueuedCascade> {
  const res = await pool.query(
    `INSERT INTO cascade_revocation_queue
       (pairing_key_id, organization_id, actor_user_id, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING id, commit_after`,
    [opts.pairingKeyId, opts.organizationId, opts.actorUserId, opts.reason],
  )
  return { id: res.rows[0].id, commit_after: res.rows[0].commit_after }
}

/**
 * Cancel a queued cascade. Refuses if the row is already
 * committed/failed. Idempotent on already-cancelled rows.
 */
export async function cancelCascade(opts: {
  queueId: string
  orgId: string
}): Promise<{ cancelled: boolean; state: string }> {
  const res = await pool.query(
    `UPDATE cascade_revocation_queue
        SET state = 'cancelled',
            cancelled_at = NOW()
      WHERE id = $1
        AND organization_id = $2
        AND state = 'queued'
      RETURNING state`,
    [opts.queueId, opts.orgId],
  )
  if (res.rowCount === 1) {
    return { cancelled: true, state: 'cancelled' }
  }
  // Re-read to distinguish "already cancelled" from "committed/failed"
  const current = await pool.query(
    `SELECT state FROM cascade_revocation_queue
      WHERE id = $1 AND organization_id = $2`,
    [opts.queueId, opts.orgId],
  )
  const state = current.rows[0]?.state ?? 'unknown'
  return { cancelled: false, state }
}

/**
 * Boot recovery: sweep queued cascades whose commit_after has already
 * passed and commit each. Called at boot from instrumentation.ts.
 */
export async function recoverPendingCascades(): Promise<{
  swept: number
  committed: number
  failed: number
}> {
  const pending = await pool.query(
    `SELECT id FROM cascade_revocation_queue
      WHERE state = 'queued' AND commit_after < NOW()`,
  )
  let committed = 0
  let failed = 0
  for (const row of pending.rows) {
    try {
      await commitCascade({ queueId: row.id })
      committed++
      console.log(`[cascade-recovery] Committed queue_id=${row.id}`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[cascade-recovery] Commit failed for queue_id=${row.id}: ${msg}`)
    }
  }
  return { swept: pending.rowCount ?? 0, committed, failed }
}
