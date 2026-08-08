/**
 * Job Queue System using pg-boss
 * 
 * pg-boss is a PostgreSQL-native job queue that:
 * - Uses PostgreSQL for persistence (no Redis needed)
 * - Provides automatic retries with exponential backoff
 * - Supports job scheduling and delayed execution
 * - Has built-in dead letter queue for failed jobs
 * - Is battle-tested with 10M+ downloads
 * 
 * @see https://github.com/timgit/pg-boss
 */

import { PgBoss } from 'pg-boss'

// Singleton instance
let boss: PgBoss | null = null
let isStarted = false

/**
 * Get or create the pg-boss instance
 */
export async function getQueue(): Promise<PgBoss> {
  if (boss && isStarted) {
    return boss
  }

  const connectionString = process.env.DATABASE_URL || 
    'postgresql://postgres:postgres@localhost:5432/aegis'

  boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
  })

  boss.on('error', (error: Error) => {
    console.error('[pg-boss] Queue error:', error)
  })

  await boss.start()
  isStarted = true

  console.log('[pg-boss] Queue started successfully')
  return boss
}

/**
 * Gracefully stop the queue (call on app shutdown)
 */
export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 30000 })
    isStarted = false
    boss = null
    console.log('[pg-boss] Queue stopped')
  }
}

// Job type definitions
export interface EmailJob {
  to: string
  subject: string
  html: string
  text?: string
  // Metadata for tracking
  type: 'ticket_notification' | 'ticket_reply' | 'password_reset' | 'welcome' | 'donation_thanks' | 'system'
  relatedId?: string // ticket_id, user_id, etc.
  priority?: 'low' | 'normal' | 'high' | 'critical'
  /**
   * Threading headers (email-ingest D28b/D29). When set, the worker passes
   * Message-ID/In-Reply-To/References + extras through to nodemailer so the
   * recipient's mail client threads correctly. Caller is responsible for
   * persisting `messageId` to ticket_replies.outbound_message_id.
   */
  headers?: {
    messageId?: string
    inReplyTo?: string | null
    references?: string | null
    extra?: Record<string, string>
  }
  /**
   * Source mailbox id (D31 shadow-mode check). When set, the worker checks
   * `inbound_mailboxes.shadow_mode` and SUPPRESSES the send if true. Belt
   * and suspenders for shadow-ITSM pilots — even if a persona slips through
   * to autonomous mode, no outbound email reaches the customer's users.
   */
  sourceMailboxId?: string
}

export interface NotificationJob {
  userId: string
  type: 'ticket_assigned' | 'ticket_updated' | 'ticket_reply' | 'mention' | 'sla_warning' | 'system'
  title: string
  message: string
  link?: string
  data?: Record<string, any>
}

export interface EmbeddingJob {
  table: 'kb_articles' | 'tickets' | 'contacts'
  id: string
  organizationId: string
}

// Queue names
export const QUEUES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  WEBHOOK: 'webhook',
  AI_PROCESS: 'ai-process',
  TRIAGE: 'ticket-triage',
  TELEMETRY: 'telemetry-heartbeat',
  EMBEDDING: 'embedding',
  RETENTION_PURGE: 'retention-purge',
} as const

/**
 * Register the daily telemetry heartbeat job.
 * Sends Tier 2 usage metrics for organizations that have opted in.
 * Runs daily at 3:00 AM UTC.
 */
export async function registerTelemetryJob(): Promise<void> {
  const queue = await getQueue()

  // pg-boss v12: queue must exist before schedule() (FK constraint)
  await queue.createQueue(QUEUES.TELEMETRY)

  // Schedule daily at 3:00 AM UTC
  await queue.schedule(QUEUES.TELEMETRY, '0 3 * * *', {}, {
    retryLimit: 2,
    retryDelay: 300,
  })

  await queue.work(QUEUES.TELEMETRY, { batchSize: 1 }, async () => {
    const { query: dbQuery } = await import('./db')
    const { sendUsageHeartbeat } = await import('./telemetry')

    // Find all orgs with Tier 2 telemetry
    const orgs = await dbQuery<{ id: string }>(
      'SELECT id FROM organizations WHERE telemetry_tier >= 2'
    )

    for (const org of orgs) {
      try {
        await sendUsageHeartbeat(org.id)
      } catch (err) {
        console.error(`[Telemetry] Heartbeat failed for org ${org.id}:`, err)
      }
    }
  })
}

/**
 * Register the embedding generation worker.
 * Processes content through the configured embedding model and writes vectors.
 */
export async function registerEmbeddingWorker(): Promise<void> {
  const queue = await getQueue()

  // pg-boss v12: queue must exist before work()
  await queue.createQueue(QUEUES.EMBEDDING)

  await queue.work<EmbeddingJob>(QUEUES.EMBEDDING, {
    batchSize: 1,
    pollingIntervalSeconds: 5,
  }, async ([job]) => {
    const { table, id, organizationId } = job.data
    const { pool: dbPool } = await import('./db')
    const { generateEmbedding } = await import('./embeddings')
    const { chunkText } = await import('./chunking')

    try {
      // Mark as processing
      await dbPool.query(
        `UPDATE ${table} SET embedding_status = 'processing' WHERE id = $1`,
        [id]
      )

      // Get the text content to embed
      let textContent: string | null = null

      if (table === 'kb_articles') {
        const result = await dbPool.query(
          `SELECT content_plain, title, summary FROM kb_articles WHERE id = $1`,
          [id]
        )
        if (result.rows[0]) {
          const r = result.rows[0]
          textContent = [r.title, r.summary, r.content_plain].filter(Boolean).join('\n\n')
        }
      } else if (table === 'tickets') {
        const result = await dbPool.query(
          `SELECT subject, description FROM tickets WHERE id = $1`,
          [id]
        )
        if (result.rows[0]) {
          const r = result.rows[0]
          textContent = [r.subject, r.description].filter(Boolean).join('\n\n')
        }
      } else if (table === 'contacts') {
        const result = await dbPool.query(
          `SELECT first_name, last_name, email, title, notes FROM contacts WHERE id = $1`,
          [id]
        )
        if (result.rows[0]) {
          const r = result.rows[0]
          textContent = [
            [r.first_name, r.last_name].filter(Boolean).join(' '),
            r.title, r.email, r.notes,
          ].filter(Boolean).join('\n')
        }
      }

      if (!textContent?.trim()) {
        await dbPool.query(
          `UPDATE ${table} SET embedding_status = 'complete', embedded_at = NOW() WHERE id = $1`,
          [id]
        )
        return
      }

      // Generate embedding for the content
      const embedding = await generateEmbedding(textContent, organizationId)

      if (!embedding) {
        // No embedding provider configured — skip silently
        return
      }

      // Get the model name for tracking
      const { getEmbeddingProvider } = await import('./embeddings')
      const provider = await getEmbeddingProvider(organizationId)
      const modelName = provider?.embedding_model || 'unknown'

      // Write the embedding vector
      const vectorStr = `[${embedding.join(',')}]`
      await dbPool.query(
        `UPDATE ${table}
         SET embedding = $1::vector,
             embedding_status = 'complete',
             embedding_model = $2,
             embedded_at = NOW()
         WHERE id = $3`,
        [vectorStr, modelName, id]
      )

      // For KB articles, also generate chunks and embed them
      if (table === 'kb_articles') {
        const chunks = chunkText(textContent)
        if (chunks.length > 0) {
          // Delete old chunks
          await dbPool.query(
            `DELETE FROM kb_article_chunks WHERE article_id = $1`,
            [id]
          )

          for (const chunk of chunks) {
            const chunkEmbedding = await generateEmbedding(chunk.text, organizationId)
            const chunkVectorStr = chunkEmbedding ? `[${chunkEmbedding.join(',')}]` : null

            await dbPool.query(
              `INSERT INTO kb_article_chunks
               (organization_id, article_id, chunk_index, chunk_text, token_count,
                embedding, embedding_status, embedding_model, embedded_at)
               VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9)`,
              [
                organizationId, id, chunk.index, chunk.text, chunk.tokenCount,
                chunkVectorStr, chunkEmbedding ? 'complete' : 'failed',
                modelName, chunkEmbedding ? new Date() : null,
              ]
            )
          }
        }
      }

      console.log(`[Embedding] Generated for ${table}/${id}`)
    } catch (error) {
      console.error(`[Embedding] Failed for ${table}/${id}:`, error)

      // Mark as failed
      await dbPool.query(
        `UPDATE ${table} SET embedding_status = 'failed' WHERE id = $1`,
        [id]
      ).catch(() => {})

      throw error // pg-boss will retry
    }
  })

  console.log('[pg-boss] Embedding worker registered')
}

/**
 * Publish an embedding job for a content item.
 */
export async function queueEmbeddingJob(
  table: EmbeddingJob['table'],
  id: string,
  organizationId: string
): Promise<void> {
  try {
    const queue = await getQueue()
    await queue.send(QUEUES.EMBEDDING, {
      table,
      id,
      organizationId,
    }, {
      retryLimit: 3,
      retryDelay: 30,
      expireInSeconds: 1800,
    })
  } catch (error) {
    console.error(`[Embedding] Failed to queue job for ${table}/${id}:`, error)
  }
}

/**
 * Queue embedding jobs for all content in an organization (bulk initial embedding).
 * Prioritizes KB articles first, then tickets, then contacts.
 */
export async function queueBulkEmbedding(organizationId: string): Promise<{ queued: number }> {
  const { pool: dbPool } = await import('./db')
  let queued = 0

  // KB articles first (most valuable for search)
  const articles = await dbPool.query(
    `SELECT id FROM kb_articles
     WHERE organization_id = $1
       AND is_deleted = false
       AND status = 'published'
       AND (embedding_status IS NULL OR embedding_status IN ('pending', 'failed', 'stale'))
     ORDER BY view_count DESC`,
    [organizationId]
  )
  for (const row of articles.rows) {
    await queueEmbeddingJob('kb_articles', row.id, organizationId)
    queued++
  }

  // Tickets
  const tickets = await dbPool.query(
    `SELECT id FROM tickets
     WHERE organization_id = $1
       AND is_deleted = false
       AND (embedding_status IS NULL OR embedding_status IN ('pending', 'failed', 'stale'))
     ORDER BY created_at DESC
     LIMIT 1000`,
    [organizationId]
  )
  for (const row of tickets.rows) {
    await queueEmbeddingJob('tickets', row.id, organizationId)
    queued++
  }

  // Contacts
  const contacts = await dbPool.query(
    `SELECT id FROM contacts
     WHERE organization_id = $1
       AND is_deleted = false
       AND (embedding_status IS NULL OR embedding_status IN ('pending', 'failed', 'stale'))
     ORDER BY created_at DESC
     LIMIT 1000`,
    [organizationId]
  )
  for (const row of contacts.rows) {
    await queueEmbeddingJob('contacts', row.id, organizationId)
    queued++
  }

  console.log(`[Embedding] Queued ${queued} items for bulk embedding (org: ${organizationId})`)
  return { queued }
}

/**
 * Register the New → Open age-out sweep job.
 * Finds tickets stuck in "New" for over 1 hour and transitions them to "Open".
 * Runs every 15 minutes via pg-boss cron scheduling.
 */
export async function registerSweepJobs(): Promise<void> {
  const queue = await getQueue()

  // pg-boss v12: queue must exist before schedule() (FK constraint)
  await queue.createQueue('ticket.new-age-out')

  // Schedule the sweep to run every 15 minutes
  await queue.schedule('ticket.new-age-out', '*/15 * * * *', {}, {
    retryLimit: 1,
    retryDelay: 60,
  })

  // Register the worker
  await queue.work('ticket.new-age-out', { batchSize: 1 }, async () => {
    const { pool: dbPool } = await import('./db')

    // Find all tickets in "New" status for over 1 hour
    const staleTickets = await dbPool.query(
      `SELECT t.id, t.status_id, t.organization_id
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE ts.name = 'New'
         AND ts.is_default = true
         AND t.created_at < NOW() - INTERVAL '1 hour'`
    )

    for (const ticket of staleTickets.rows) {
      // Find the "Open" status for this org
      const openStatus = await dbPool.query(
        `SELECT id FROM ticket_statuses
         WHERE organization_id = $1 AND name = 'Open'
         LIMIT 1`,
        [ticket.organization_id]
      )

      if (openStatus.rows[0]) {
        // Transition to Open (DB trigger handles SLA tracking)
        await dbPool.query(
          `UPDATE tickets SET status_id = $1, updated_at = NOW() WHERE id = $2`,
          [openStatus.rows[0].id, ticket.id]
        )

        // Log in status history
        await dbPool.query(
          `INSERT INTO ticket_status_history
           (ticket_id, from_status_id, to_status_id, reason,
            sla_paused_seconds_at_change, sla_was_paused)
           VALUES ($1, $2, $3, 'Auto-transitioned: aged out of New after 1 hour',
            COALESCE((SELECT sla_total_paused_seconds FROM tickets WHERE id = $1), 0),
            (SELECT sla_paused_at IS NOT NULL FROM tickets WHERE id = $1))`,
          [ticket.id, ticket.status_id, openStatus.rows[0].id]
        )
      }
    }
  })
}
