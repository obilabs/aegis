/**
 * Triage Worker — pg-boss Job Handlers
 *
 * Registers three job types:
 * 1. ticket.triage         — score a single ticket (triggered by events)
 * 2. ticket.triage.sweep   — re-score all open tickets (cron: every 15 min)
 * 3. ticket.sla.check      — check for SLA breaches (cron: every 5 min)
 *
 * The triage job flow:
 * 1. Fetch ticket + status + last 5 replies + SLA config
 * 2. If status.base_status == 'open' → classify via AI (or heuristic fallback)
 * 3. If status.base_status == 'pending' → derive action_state from status
 * 4. Compute all score factors
 * 5. Upsert ticket_queue_scores
 */

import { getQueue, QUEUES } from './queue'
import { getSlaData, computeSlaActiveSeconds, getSlaRemaining, checkSlaBreach } from './sla'
import {
  triageTicket,
  upsertQueueScore,
  computeScoreFactors,
  deriveActionStateFromStatus,
  getTicketStatusInfo,
  getTicketForTriage,
  getLastContactReplyAt,
} from './triage'
import { classifyActionStateAI } from './triage-ai'

// ─── Job Data Types ──────────────────────────────────────────────────────────

export interface TriageJobData {
  ticketId: string
  organizationId: string
  trigger: 'ticket_created' | 'reply_added' | 'status_changed' | 'agent_viewed' | 'manual' | 'sweep'
}

// ─── Triage Job Handler ──────────────────────────────────────────────────────

async function handleTriageJob(data: TriageJobData): Promise<void> {
  const { ticketId, organizationId, trigger } = data

  const ticket = await getTicketForTriage(ticketId)
  if (!ticket) return

  const statusInfo = await getTicketStatusInfo(ticketId)
  if (!statusInfo) return

  // Skip truly closed tickets (but keep 'resolved' for resolution_candidate)
  if (
    statusInfo.baseStatus === 'closed' &&
    !statusInfo.statusName.toLowerCase().includes('resolved')
  ) {
    return
  }

  // Get SLA data
  const slaData = await getSlaData(ticketId)
  const slaActiveSeconds = await computeSlaActiveSeconds(ticketId)
  const slaRemaining = await getSlaRemaining(ticketId, 'resolution')
  const lastContactReplyAt = await getLastContactReplyAt(ticketId)

  // For pending/closed statuses, use deterministic classification
  if (statusInfo.baseStatus !== 'open') {
    const derived = deriveActionStateFromStatus(
      statusInfo.statusName,
      statusInfo.baseStatus,
      statusInfo.isDefault
    )
    if (derived) {
      const factors = computeScoreFactors(
        ticket.priority,
        derived,
        slaRemaining,
        statusInfo.slaPaused,
        slaActiveSeconds,
        lastContactReplyAt
      )
      await upsertQueueScore(
        ticketId,
        organizationId,
        derived,
        0.95,
        factors,
        `Deterministic: status "${statusInfo.statusName}" → ${derived}`,
        'heuristic'
      )
      return
    }
  }

  // For open statuses, try AI classification first
  let usedAI = false
  try {
    // Check if AI triage feature is enabled for this org
    const { query: dbQuery } = await import('./db')
    const featureRow = await dbQuery<{ enabled: boolean }>(
      `SELECT enabled FROM organization_feature_flags
       WHERE organization_id = $1 AND feature_key = 'ai_triage'`,
      [organizationId]
    )
    const aiEnabled = featureRow.length > 0 && featureRow[0].enabled === true

    if (aiEnabled) {
      const aiResult = await classifyActionStateAI(ticketId, organizationId)
      if (aiResult) {
        const factors = computeScoreFactors(
          ticket.priority,
          aiResult.actionState,
          slaRemaining,
          statusInfo.slaPaused,
          slaActiveSeconds,
          lastContactReplyAt
        )
        await upsertQueueScore(
          ticketId,
          organizationId,
          aiResult.actionState,
          aiResult.confidence,
          factors,
          aiResult.reasoning,
          'ai'
        )
        usedAI = true
      }
    }
  } catch (err) {
    console.error(`[triage-worker] AI classification failed for ticket ${ticketId}:`, err)
  }

  // Fall back to heuristic if AI wasn't used
  if (!usedAI) {
    await triageTicket(ticketId, slaData, slaActiveSeconds, slaRemaining)
  }
}

// ─── Sweep Job Handler ───────────────────────────────────────────────────────

async function handleTriageSweep(): Promise<void> {
  const { query: dbQuery } = await import('./db')

  // Find all open/pending tickets that need scoring
  const tickets = await dbQuery<{ id: string; organization_id: string }>(
    `SELECT t.id, t.organization_id
     FROM tickets t
     JOIN ticket_statuses ts ON t.status_id = ts.id
     WHERE ts.base_status IN ('open', 'pending')
       AND COALESCE(t.is_deleted, false) = false
     ORDER BY t.updated_at DESC
     LIMIT 500`
  )

  let scored = 0
  for (const ticket of tickets) {
    try {
      await handleTriageJob({
        ticketId: ticket.id,
        organizationId: ticket.organization_id,
        trigger: 'sweep',
      })
      scored++
    } catch (err) {
      console.error(`[triage-sweep] Failed to score ticket ${ticket.id}:`, err)
    }
  }

  if (scored > 0) {
    console.log(`[triage-sweep] Scored ${scored}/${tickets.length} tickets`)
  }
}

// ─── SLA Check Job Handler ───────────────────────────────────────────────────

async function handleSlaCheck(): Promise<void> {
  const { query: dbQuery } = await import('./db')

  // Find tickets with SLA targets that haven't been breached yet
  const tickets = await dbQuery<{
    id: string
    ticket_number: number
    prefix: string | null
    subject: string
    assigned_email: string | null
  }>(
    `SELECT t.id, t.ticket_number, t.prefix, t.subject,
            u.email as assigned_email
     FROM tickets t
     JOIN ticket_statuses ts ON t.status_id = ts.id
     LEFT JOIN ticket_types tt ON t.type_id = tt.id
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE ts.base_status IN ('open', 'pending')
       AND COALESCE(t.is_deleted, false) = false
       AND (tt.sla_response_minutes IS NOT NULL OR tt.sla_resolution_minutes IS NOT NULL)
       AND COALESCE(t.sla_breached, false) = false`
  )

  let breached = 0
  for (const ticket of tickets) {
    try {
      const isBreach = await checkSlaBreach(ticket.id)
      if (isBreach) {
        breached++

        // Send SLA warning email to assigned user (non-blocking)
        if (ticket.assigned_email) {
          try {
            const { sendSLAWarningEmail } = await import('./email-queue')
            const ticketNumber = `${ticket.prefix || ''}${ticket.ticket_number}`
            await sendSLAWarningEmail({
              to: ticket.assigned_email,
              ticketNumber,
              ticketSubject: ticket.subject,
              ticketId: ticket.id,
              slaType: 'resolution',
              timeRemaining: 'Breached',
            })
          } catch {
            // Email failure should not block SLA processing
          }
        }
      }
    } catch (err) {
      console.error(`[sla-check] Failed for ticket ${ticket.id}:`, err)
    }
  }

  if (breached > 0) {
    console.log(`[sla-check] Detected ${breached} new SLA breaches`)
  }
}

// ─── Worker Registration ─────────────────────────────────────────────────────

/**
 * Register all triage-related pg-boss workers and schedules.
 * Called during app startup.
 */
export async function registerTriageWorker(): Promise<void> {
  const queue = await getQueue()

  // pg-boss v12: queue must exist before work()
  await queue.createQueue(QUEUES.TRIAGE)

  // 1. Single ticket triage (event-driven)
  await queue.work<TriageJobData>(
    QUEUES.TRIAGE,
    { batchSize: 1, pollingIntervalSeconds: 3 },
    async ([job]) => {
      await handleTriageJob(job.data)
    }
  )

  // 2. Sweep job — re-score all open tickets every 15 minutes
  // pg-boss v12: queue must exist before schedule() (FK constraint)
  await queue.createQueue('ticket.triage.sweep')
  await queue.schedule('ticket.triage.sweep', '*/15 * * * *', {}, {
    retryLimit: 1,
    retryDelay: 120,
  })
  await queue.work('ticket.triage.sweep', { batchSize: 1 }, async () => {
    await handleTriageSweep()
  })

  // 3. SLA check — check for breaches every 5 minutes (runs regardless of AI feature flag)
  await queue.createQueue('ticket.sla.check')
  await queue.schedule('ticket.sla.check', '*/5 * * * *', {}, {
    retryLimit: 1,
    retryDelay: 60,
  })
  await queue.work('ticket.sla.check', { batchSize: 1 }, async () => {
    await handleSlaCheck()
  })

  console.log('[pg-boss] Triage worker registered (triage + sweep + SLA check)')
}

// ─── Job Enqueue Helper ──────────────────────────────────────────────────────

/**
 * Enqueue a triage job for a ticket. Non-blocking — failures are logged, not thrown.
 */
export async function queueTriageJob(
  ticketId: string,
  organizationId: string,
  trigger: TriageJobData['trigger']
): Promise<void> {
  try {
    const queue = await getQueue()
    await queue.send(QUEUES.TRIAGE, {
      ticketId,
      organizationId,
      trigger,
    } satisfies TriageJobData, {
      retryLimit: 2,
      retryDelay: 30,
      expireInSeconds: 300,
      // Deduplicate: only one triage job per ticket at a time
      singletonKey: `triage-${ticketId}`,
      singletonSeconds: 10,
    })
  } catch (err) {
    console.error(`[triage-worker] Failed to queue triage for ${ticketId}:`, err)
  }
}
