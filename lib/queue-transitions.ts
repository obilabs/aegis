/**
 * Queue transition helpers.
 *
 * This module is the stable call site for anything that
 * needs to know a ticket's recent escalation history. Phase B
 * (`msp-label-scoped-visibility`) ships the
 * `ticket_queue_transitions` table + escalation workflow;
 * until then, all helpers here return null / empty / no-op so
 * callers can code against the eventual shape without
 * blocking on Phase B.
 *
 * The MTP pairing polling endpoint calls
 * `getEscalationContext()` unconditionally — before Phase B
 * ships, this returns null for every ticket, and the polled
 * `escalation_context` field is nullable in the wire format
 * per the spec.
 */

import { queryOne } from './db'

/**
 * Populated when a ticket was recently escalated INTO the
 * queue where it currently sits. Powers the "🆕 Escalated
 * from Helpdesk Heroes" indicator in receiving MSPs' queue
 * views.
 *
 * Spec: `msp-poller-extension-sla-triage` requirement "List
 * endpoint returns escalation context per recently-escalated
 * ticket." Design D5 in the same spec covers the 7-day
 * window + current-queue-match rules.
 */
export interface EscalationContext {
  from_queue_id: string
  from_queue_name: string
  reason: string | null
  escalated_at: string
  escalated_by_display: string
}

/**
 * Return the ticket's most recent queue-transition context
 * if:
 * - a transition exists
 * - the transition's target queue matches the ticket's
 *   current queue (guards against ticket having moved on)
 * - the transition happened within the last 7 days
 *
 * Otherwise null.
 *
 * Until Phase B ships the `ticket_queue_transitions` table,
 * this ALWAYS returns null. The helper exists so
 * `/api/v1/mtp/tickets` and the JIT endpoint can call it
 * unconditionally, and the null result is the wire-format
 * default that the MTP-side parser expects.
 */
export async function getEscalationContext(
  ticketId: string,
): Promise<EscalationContext | null> {
  // Guard: table exists?
  const hasTable = await queryOne<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ticket_queue_transitions'
     ) AS present`,
  )
  if (!hasTable?.present) return null

  const row = await queryOne<{
    from_queue_id: string | null
    from_queue_name: string | null
    reason: string | null
    escalated_at: Date
    escalated_by_display: string
  }>(
    `SELECT
       ttq.from_queue_id::text,
       fq.name AS from_queue_name,
       ttq.reason,
       ttq.created_at AS escalated_at,
       COALESCE(
         u.first_name || ' ' || u.last_name,
         ak.name,
         'system'
       ) AS escalated_by_display
       FROM ticket_queue_transitions ttq
       JOIN tickets t ON t.id = ttq.ticket_id
       LEFT JOIN ticket_queues fq ON fq.id = ttq.from_queue_id
       LEFT JOIN users u ON u.id = ttq.changed_by_user_id
       LEFT JOIN api_keys ak ON ak.id = ttq.changed_via_pairing_key_id
      WHERE ttq.ticket_id = $1
        AND ttq.to_queue_id = t.queue_id
        AND ttq.created_at > NOW() - INTERVAL '7 days'
      ORDER BY ttq.created_at DESC
      LIMIT 1`,
    [ticketId],
  )
  if (!row || !row.from_queue_id) return null

  return {
    from_queue_id: row.from_queue_id,
    from_queue_name: row.from_queue_name || 'unknown',
    reason: row.reason,
    escalated_at: row.escalated_at.toISOString(),
    escalated_by_display: row.escalated_by_display,
  }
}
