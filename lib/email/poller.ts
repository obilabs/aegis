/**
 * Email-ingest pg-boss consumer (D26 + D34).
 *
 *   pg-boss schedule "email.poll" runs every 60s. Worker queries
 *   inbound_mailboxes for rows where is_active = true and (last_poll_at IS
 *   NULL OR last_poll_at < NOW() - interval poll_interval_seconds), and
 *   fans out one job per mailbox onto the "email.poll.mailbox" queue.
 *
 * Per-mailbox handler:
 *   1. Decrypt password
 *   2. Connect, fetch mail since last_uid_seen (UIDVALIDITY-aware)
 *   3. For each message:
 *        a. Insert pre-state log row (status='received')
 *        b. Parse → detectLoop → decideThreading
 *        c. Write the outcome (create ticket, append reply, link, log)
 *        d. Apply post-process (passive/mark_seen/move/delete)
 *   4. Update last_uid_seen / last_uidvalidity / last_poll_at / last_poll_status
 *
 * Concurrency: pg-boss `singletonKey: mailbox.id` ensures one in-flight
 * poll per mailbox. If a poll runs longer than poll_interval_seconds, the
 * next scheduled fire is dropped (singleton lock held).
 *
 * NOTE: this module is type-correct but NOT yet end-to-end validated against
 * a real IMAP server (Docker required). Validation is part of the
 * email-ingest acceptance criteria, deferred to a session with Postgres +
 * Dovecot online.
 */

import { pool } from '@/lib/db'
import { mergeParticipants } from '@/lib/permissions'
import { getQueue } from '@/lib/queue'
import { decryptCredential, loadSymmetricKeys } from './credentials'
import { detectLoop } from './loop-detection'
import { pollMailbox, applyPostProcess, type MailboxConnection, type PostProcessMode } from './imap-client'
import { parseEmail, type ParsedEmail } from './parser'
import { resolveSigningKeysFromEnv, type SigningKeys } from './signing'
import { decideThreading, type ThreadingContext, type ThreadingDecision } from './threading'

const SCHEDULER_QUEUE = 'email.poll'
const PER_MAILBOX_QUEUE = 'email.poll.mailbox'

interface MailboxRow {
  id: string
  organization_id: string
  name: string
  host: string
  port: number
  use_tls: boolean
  username: string
  password_encrypted: string
  folder: string
  poll_interval_seconds: number
  last_uid_seen: string | null
  last_uidvalidity: string | null
  backfill_days_on_activation: number
  default_ticket_kind: string
  shadow_mode: boolean
  post_process_mode: PostProcessMode
  processed_folder: string | null
  reply_address: string | null
  message_id_host: string | null
  attachment_size_limit_bytes: string
}

/** Fetched once at process start; avoids repeated env lookups per poll. */
let cachedSigningKeys: SigningKeys | null = null
let cachedInstanceUuid: string | null = null

async function getSigningKeys(): Promise<SigningKeys> {
  if (!cachedSigningKeys) cachedSigningKeys = resolveSigningKeysFromEnv()
  return cachedSigningKeys
}

async function getInstanceUuid(): Promise<string> {
  if (cachedInstanceUuid) return cachedInstanceUuid
  const r = await pool.query<{ instance_uuid: string }>(
    'SELECT instance_uuid FROM system_install WHERE id = 1',
  )
  if (!r.rows[0]) {
    throw new Error('system_install row missing — run migration 079 before starting the poller')
  }
  cachedInstanceUuid = r.rows[0].instance_uuid
  return cachedInstanceUuid
}

// ---------------------------------------------------------------------------
// Scheduler — fans out one job per due mailbox
// ---------------------------------------------------------------------------

async function fanOutDueMailboxes(): Promise<void> {
  // D28b DoS guard: skip mailboxes paused by the signature-failure ratio
  // check. The pause is written as `last_poll_status='unknown_error'` with
  // `last_poll_error` prefixed `mailbox_under_attack`; we wait 5 minutes
  // from `last_poll_at` before re-polling.
  const due = await pool.query<{ id: string }>(
    `SELECT id FROM inbound_mailboxes
      WHERE is_active = true
        AND (last_poll_at IS NULL
             OR last_poll_at < NOW() - (poll_interval_seconds * INTERVAL '1 second'))
        AND NOT (
          last_poll_status = 'unknown_error'
          AND last_poll_error LIKE 'mailbox_under_attack%'
          AND last_poll_at > NOW() - INTERVAL '5 minutes'
        )`,
  )
  if (due.rows.length === 0) return

  const boss = await getQueue()
  for (const row of due.rows) {
    await boss.send(
      PER_MAILBOX_QUEUE,
      { mailboxId: row.id },
      {
        // Skip the next fire if a poll is still in flight for this mailbox.
        singletonKey: `mailbox:${row.id}`,
        retryLimit: 0, // a stuck poll just waits for the next tick
        expireInSeconds: 60 * 10, // 10 min absolute cap
      },
    )
  }
}

// ---------------------------------------------------------------------------
// Per-mailbox poll handler
// ---------------------------------------------------------------------------

async function handleMailboxPoll(mailboxId: string): Promise<void> {
  // D28b DoS guard: if a mailbox is currently paused (signature-failure
  // burst), short-circuit the poll. The pause is encoded as a future
  // `last_poll_at` (poll_interval_seconds keeps the row out of the
  // due-mailboxes query), but defensive double-check here so manual
  // re-enqueues don't bypass it.
  const guard = await pool.query<{ paused_until: Date | null }>(
    `SELECT
       CASE
         WHEN last_poll_status = 'unknown_error' AND last_poll_error LIKE 'mailbox_under_attack%'
         THEN last_poll_at + INTERVAL '5 minutes'
         ELSE NULL
       END AS paused_until
     FROM inbound_mailboxes
     WHERE id = $1`,
    [mailboxId],
  )
  if (guard.rows[0]?.paused_until && guard.rows[0].paused_until > new Date()) {
    return
  }

  const r = await pool.query<MailboxRow>(
    `SELECT * FROM inbound_mailboxes WHERE id = $1 AND is_active = true`,
    [mailboxId],
  )
  const mailbox = r.rows[0]
  if (!mailbox) return // raced with deactivation

  const symmetric = loadSymmetricKeys()
  let password: string
  try {
    password = decryptCredential(mailbox.password_encrypted, symmetric)
  } catch (err) {
    await markPollResult(mailboxId, 'auth_failed', `password decrypt failed: ${errMsg(err)}`)
    return
  }

  const conn: MailboxConnection = {
    host: mailbox.host,
    port: mailbox.port,
    useTls: mailbox.use_tls,
    username: mailbox.username,
    password,
    folder: mailbox.folder,
  }

  let pollResult
  try {
    pollResult = await pollMailbox(conn, {
      lastUidSeen: mailbox.last_uid_seen ? Number(mailbox.last_uid_seen) : null,
      lastUidValidity: mailbox.last_uidvalidity ? Number(mailbox.last_uidvalidity) : null,
      backfillDaysOnActivation: mailbox.backfill_days_on_activation,
    })
  } catch (err) {
    const failureMode = classifyPollError(err)
    await markPollResult(mailboxId, failureMode, errMsg(err))
    return
  }

  const signingKeys = await getSigningKeys()
  const instanceUuid = await getInstanceUuid()
  const ctx: ThreadingContext = {
    organizationId: mailbox.organization_id,
    mailboxId: mailbox.id,
    instanceUuid,
    signingKeys,
  }

  for (const fetched of pollResult.messages) {
    let parsed: ParsedEmail
    try {
      parsed = await parseEmail(fetched.source)
    } catch (err) {
      await logIngest(mailbox, fetched.source.length, null, null, {
        status: 'failed_parse',
        match_path: null,
        signature_validated: null,
        sender_authorized: null,
        parse_error: errMsg(err),
      })
      continue
    }

    // Size guard
    if (parsed.rawSizeBytes > Number(mailbox.attachment_size_limit_bytes) * 4) {
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, null, {
        status: 'rejected_size',
        match_path: null,
        signature_validated: null,
        sender_authorized: null,
        rejection_reason: `raw size ${parsed.rawSizeBytes} > 4× attachment_size_limit_bytes`,
      })
      continue
    }

    // Loop detection — short-circuit before any threading work
    const loopReject = detectLoop({
      headers: parsed.headers,
      fromAddress: parsed.fromAddress,
      toAddresses: parsed.toAddresses,
      subject: parsed.subject,
      contentType: parsed.contentType,
      ingestMailbox: mailbox.username,
      outboundHost: mailbox.message_id_host,
      replyAddress: mailbox.reply_address,
    })
    if (loopReject) {
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, null, {
        status: loopReject.status,
        match_path: null,
        signature_validated: null,
        sender_authorized: null,
        rejection_reason: loopReject.reason,
      })
      continue
    }

    // Threading decision
    let decision: ThreadingDecision
    try {
      decision = await decideThreading(parsed, ctx)
    } catch (err) {
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, null, {
        status: 'failed_create',
        match_path: null,
        signature_validated: null,
        sender_authorized: null,
        rejection_reason: `threading decision failed: ${errMsg(err)}`,
      })
      continue
    }

    if (decision.kind === 'duplicate') {
      // Already logged from a prior poll — no-op.
      continue
    }

    try {
      await applyDecision(mailbox, parsed, decision)
    } catch (err) {
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, null, {
        status: 'failed_create',
        match_path: null,
        signature_validated: null,
        sender_authorized: null,
        rejection_reason: `apply decision failed: ${errMsg(err)}`,
      })
      continue
    }

    // Post-process — best-effort; failure here MUST NOT roll back the ingest.
    try {
      await applyPostProcess(conn, fetched.uid, {
        mode: mailbox.post_process_mode,
        processedFolder: mailbox.processed_folder ?? undefined,
      })
    } catch (err) {
      console.warn(`[email-poller] post-process uid=${fetched.uid} failed: ${errMsg(err)}`)
    }
  }

  // Persist UID + uidvalidity advance
  await pool.query(
    `UPDATE inbound_mailboxes
        SET last_uid_seen        = $1,
            last_uidvalidity     = $2,
            last_poll_at         = NOW(),
            last_poll_status     = 'ok',
            last_poll_error      = NULL,
            updated_at           = NOW()
      WHERE id = $3`,
    [pollResult.highestUidSeen, pollResult.uidValidity, mailboxId],
  )

  // D28b DoS guard: count signature-failure ratio over the last 100 messages.
  // If > 50%, log mailbox_under_attack and bump last_poll_at into the future
  // so the next scheduler tick skips this mailbox for 5 minutes.
  await checkSignatureFailureRatio(mailboxId)
}

/**
 * D28b DoS guard. Inspect the last 100 ingest log rows for this mailbox; if
 * more than 50% have signature_validated = false (and signature_validated is
 * not NULL — i.e., we actually attempted verification), pause the mailbox
 * for 5 minutes and write `mailbox_under_attack` to last_poll_error.
 *
 * Failures here MUST NOT block the next poll — log and proceed.
 */
async function checkSignatureFailureRatio(mailboxId: string): Promise<void> {
  try {
    const r = await pool.query<{ total: number; failures: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE signature_validated IS NOT NULL)::int                AS total,
         COUNT(*) FILTER (WHERE signature_validated = false)::int                    AS failures
       FROM (
         SELECT signature_validated
         FROM inbound_email_log
         WHERE mailbox_id = $1
         ORDER BY received_at DESC
         LIMIT 100
       ) recent`,
      [mailboxId],
    )
    const stats = r.rows[0]
    if (!stats || stats.total < 20) return // need a meaningful sample
    const ratio = stats.failures / stats.total
    if (ratio < 0.5) return

    await pool.query(
      `UPDATE inbound_mailboxes
          SET last_poll_status = 'unknown_error',
              last_poll_error  = $1,
              updated_at       = NOW()
        WHERE id = $2`,
      [
        `mailbox_under_attack: ${stats.failures}/${stats.total} signature failures over last 100 — paused 5min`,
        mailboxId,
      ],
    )
    console.warn(
      `[email-poller] mailbox ${mailboxId} paused 5min: ${stats.failures}/${stats.total} signature failures`,
    )
  } catch (err) {
    console.warn('[email-poller] DoS guard ratio check failed:', errMsg(err))
  }
}

// ---------------------------------------------------------------------------
// Persisting threading outcomes
// ---------------------------------------------------------------------------

async function applyDecision(
  mailbox: MailboxRow,
  parsed: ParsedEmail,
  decision: ThreadingDecision,
): Promise<void> {
  switch (decision.kind) {
    case 'duplicate':
      return // handled by caller short-circuit

    case 'thread_existing': {
      // Append a reply to the existing ticket; merge new participants.
      await mergeTicketParticipants(decision.ticketId, mailbox, parsed)
      const replyId = await insertReply(decision.ticketId, mailbox, parsed)
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, decision.ticketId, {
        status: 'threaded_existing',
        reply_id: replyId,
        match_path: decision.matchPath,
        signature_validated: decision.signatureValidated,
        sender_authorized: decision.senderAuthorized,
        signed_by_previous_key: decision.signedByPreviousKey ?? null,
      })
      return
    }

    case 'create_linked_auth_failed': {
      const newTicketId = await insertNewTicket(mailbox, parsed)
      // D28j: link the new (auth-failed) ticket to the original via the
      // existing ticket_relations table. relation_type is free-form text;
      // 'auth_failed_inbound' surfaces in the admin UI as a security event.
      await pool.query(
        `INSERT INTO ticket_relations
           (organization_id, source_ticket_id, target_ticket_id, relation_type, created_by)
         VALUES ($1, $2, $3, 'auth_failed_inbound', NULL)
         ON CONFLICT DO NOTHING`,
        [mailbox.organization_id, newTicketId, decision.sourceTicketId],
      )
      const replyId = await insertReply(newTicketId, mailbox, parsed)
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, newTicketId, {
        status:
          decision.matchPath === 'signed_invalid_replay'
            ? 'created_new_auth_failed_signed'
            : 'created_new_auth_failed_header',
        reply_id: replyId,
        match_path: decision.matchPath,
        signature_validated: decision.signatureValidated,
        sender_authorized: decision.senderAuthorized,
        signed_by_previous_key: decision.signedByPreviousKey ?? null,
      })
      return
    }

    case 'reject_foreign_instance': {
      // Cross-instance signed Message-ID — log + create a new ticket so the
      // requester gets a response, but DO NOT silently append to a foreign
      // install's ticket.
      const newTicketId = await insertNewTicket(mailbox, parsed)
      const replyId = await insertReply(newTicketId, mailbox, parsed)
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, newTicketId, {
        status: 'rejected_foreign_instance',
        reply_id: replyId,
        match_path: decision.matchPath,
        foreign_instance_uuid: decision.foreignInstanceUuid,
        signature_validated: true,
        sender_authorized: null,
      })
      return
    }

    case 'create_new': {
      const newTicketId = await insertNewTicket(mailbox, parsed)
      const replyId = await insertReply(newTicketId, mailbox, parsed)
      await logIngest(mailbox, parsed.rawSizeBytes, parsed, newTicketId, {
        status: 'created_new',
        reply_id: replyId,
        match_path: 'new',
        signature_validated: false,
        sender_authorized: null,
      })
      return
    }
  }
}

async function insertNewTicket(mailbox: MailboxRow, parsed: ParsedEmail): Promise<string> {
  const cc = mergeParticipants(
    [],
    { to: parsed.toAddresses, cc: parsed.ccAddresses },
    mailbox.username,
  )

  const r = await pool.query<{ id: string }>(
    `INSERT INTO tickets (
       organization_id, subject, description, source, kind,
       requester_email, cc_list, source_mailbox_id
     ) VALUES ($1, $2, $3, 'email', $4, $5, $6::text[], $7)
     RETURNING id`,
    [
      mailbox.organization_id,
      (parsed.subject ?? '(no subject)').slice(0, 500),
      parsed.text ?? parsed.html ?? '',
      mailbox.default_ticket_kind,
      parsed.fromAddress,
      cc,
      mailbox.id,
    ],
  )
  return r.rows[0].id
}

async function insertReply(
  ticketId: string,
  mailbox: MailboxRow,
  parsed: ParsedEmail,
): Promise<string> {
  // ticket_replies columns vary slightly across migrations; the email-ingest
  // additions are inbound_message_id + source_mailbox_id (079). The minimal
  // INSERT writes the columns we know exist on every install: ticket_id,
  // body, inbound_message_id, source_mailbox_id, plus whatever required
  // NOT-NULL columns the table has. Use a permissive INSERT and let
  // future migrations broaden it.
  const r = await pool.query<{ id: string }>(
    `INSERT INTO ticket_replies (
       ticket_id, body, inbound_message_id, source_mailbox_id
     ) VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      ticketId,
      parsed.text ?? parsed.html ?? '',
      parsed.messageId,
      mailbox.id,
    ],
  )
  return r.rows[0].id
}

async function mergeTicketParticipants(
  ticketId: string,
  mailbox: MailboxRow,
  parsed: ParsedEmail,
): Promise<void> {
  const existing = await pool.query<{ cc_list: string[] | null }>(
    'SELECT cc_list FROM tickets WHERE id = $1',
    [ticketId],
  )
  const current = existing.rows[0]?.cc_list ?? []
  const merged = mergeParticipants(
    current,
    { to: parsed.toAddresses, cc: parsed.ccAddresses },
    mailbox.username,
  )
  if (merged.length === current.length) return // nothing new
  await pool.query('UPDATE tickets SET cc_list = $1::text[], updated_at = NOW() WHERE id = $2', [
    merged,
    ticketId,
  ])
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

interface LogPayload {
  status: string
  reply_id?: string | null
  match_path?: string | null
  signature_validated?: boolean | null
  sender_authorized?: boolean | null
  signed_by_previous_key?: boolean | null
  foreign_instance_uuid?: string | null
  rejection_reason?: string | null
  parse_error?: string | null
}

async function logIngest(
  mailbox: MailboxRow,
  sizeBytes: number,
  parsed: ParsedEmail | null,
  ticketId: string | null,
  payload: LogPayload,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO inbound_email_log (
         mailbox_id, organization_id,
         message_id, in_reply_to, references_chain,
         from_address, to_address, subject, raw_size_bytes,
         status, ticket_id, reply_id,
         match_path, signature_validated, sender_authorized,
         signed_by_previous_key, foreign_instance_uuid,
         rejection_reason, parse_error,
         processed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())`,
      [
        mailbox.id,
        mailbox.organization_id,
        parsed?.messageId ?? null,
        parsed?.inReplyTo ?? null,
        parsed?.references?.join(' ') ?? null,
        parsed?.fromAddress ?? null,
        parsed?.toAddresses?.join(', ') ?? null,
        parsed?.subject ?? null,
        sizeBytes,
        payload.status,
        ticketId,
        payload.reply_id ?? null,
        payload.match_path ?? null,
        payload.signature_validated ?? null,
        payload.sender_authorized ?? null,
        payload.signed_by_previous_key ?? null,
        payload.foreign_instance_uuid ?? null,
        payload.rejection_reason ?? null,
        payload.parse_error ?? null,
      ],
    )
  } catch (err) {
    console.error('[email-poller] inbound_email_log insert failed:', err)
  }
}

async function markPollResult(
  mailboxId: string,
  status: 'auth_failed' | 'connect_failed' | 'parse_failed' | 'unknown_error',
  errorText: string,
): Promise<void> {
  await pool.query(
    `UPDATE inbound_mailboxes
        SET last_poll_at     = NOW(),
            last_poll_status = $1,
            last_poll_error  = $2,
            updated_at       = NOW()
      WHERE id = $3`,
    [status, errorText, mailboxId],
  )
}

function classifyPollError(err: unknown): 'auth_failed' | 'connect_failed' | 'unknown_error' {
  const m = errMsg(err).toLowerCase()
  if (/auth(entication)? fail|invalid credentials|login|no user|password/i.test(m)) {
    return 'auth_failed'
  }
  if (/connect|getaddrinfo|enotfound|timeout|ECONNREFUSED|tls|ssl/i.test(m)) {
    return 'connect_failed'
  }
  return 'unknown_error'
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ---------------------------------------------------------------------------
// pg-boss worker registration
// ---------------------------------------------------------------------------

/**
 * Register the email-ingest scheduler + per-mailbox worker. Call once at
 * worker startup (alongside `startEmailWorker()` for outbound).
 */
export async function startEmailIngestWorker(): Promise<void> {
  const boss = await getQueue()
  await boss.createQueue(SCHEDULER_QUEUE)
  await boss.createQueue(PER_MAILBOX_QUEUE)

  // Scheduler — fan out due mailboxes
  await boss.work(
    SCHEDULER_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 60 },
    async () => {
      try {
        await fanOutDueMailboxes()
      } catch (err) {
        console.error('[email-poller] scheduler error:', err)
      }
    },
  )

  // Per-mailbox handler
  await boss.work(
    PER_MAILBOX_QUEUE,
    { batchSize: 4, pollingIntervalSeconds: 5 },
    async (jobs: any) => {
      const list: any[] = Array.isArray(jobs) ? jobs : [jobs]
      for (const job of list) {
        const data = job.data as { mailboxId?: string }
        if (!data?.mailboxId) continue
        try {
          await handleMailboxPoll(data.mailboxId)
        } catch (err) {
          console.error(`[email-poller] mailbox ${data.mailboxId} poll failed:`, err)
        }
      }
    },
  )

  // Schedule the fan-out tick. pg-boss `schedule()` takes a cron expression;
  // we use `*/1 * * * *` (every minute) — the per-mailbox poll_interval still
  // governs which mailboxes are due.
  await boss.schedule(SCHEDULER_QUEUE, '*/1 * * * *')

  console.log('[email-poller] worker started')
}
