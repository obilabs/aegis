/**
 * GET /api/v1/mtp/tickets
 *
 * Spec: openspec/changes/mtp-phase1/proposal.md (D72) +
 * openspec/changes/mtp-poller-extension-sla-triage/ (2026-07-18)
 *
 * The poll target. Returns:
 *   - Aggregate counts: open / pending / closed_today / oldest_open_age_hours
 *   - 20 most-recent ticket headlines with extended per-ticket
 *     detail (SLA state, triage score, queue metadata,
 *     escalation context, body_preview)
 *   - asset_count + user_count for the dashboard
 *
 * Bearer-auth via MTP pairing key. Org-scoped: every query filters by
 * `pairing.organization_id`.
 *
 * WIRE-COMPAT: fields added in `mtp-poller-extension-sla-triage`
 * are additive. Legacy MTP installs that don't consume them
 * continue polling successfully. Fields are nullable when the
 * underlying source data is unavailable (no SLA policy, no
 * triage run, `ticket_queues` table absent because
 * `msp-label-scoped-visibility` hasn't shipped, no recent
 * transition, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/require-scope'
import { pool } from '@/lib/db'
import { bodyPreview } from '@/lib/text-utils'
import { computeSlaStatus, type SlaStatus } from '@/lib/sla'
import {
  getEscalationContext,
  type EscalationContext,
} from '@/lib/queue-transitions'

interface AggregateRow {
  ticket_count_open: number
  ticket_count_pending: number
  ticket_count_closed_today: number
  oldest_open_ticket_age_hours: number | null
  asset_count: number
  user_count: number
}

interface RecentTicketRow {
  remote_ticket_id: string
  ticket_number: string | null
  title: string
  status: string
  priority: string | null
  assignee_name: string | null
  updated_at: Date
  // Extended fields (Phase A)
  description: string | null
  sla_first_response_due_at: Date | null
  sla_first_response_at: Date | null
  sla_resolution_due_at: Date | null
  sla_resolved_at: Date | null
  target_response_minutes: number | null
  target_resolution_minutes: number | null
  effective_start_at: Date | null
  triage_score: number | null
  queue_id: string | null
  queue_name: string | null
}

interface RecentTicketResponse {
  remote_ticket_id: string
  ticket_number: string | null
  title: string
  status: string
  priority: string | null
  assignee_name: string | null
  updated_at: Date
  sla_first_response_deadline: string | null
  sla_resolution_deadline: string | null
  sla_status: SlaStatus
  triage_score: number | null
  body_preview: string | null
  queue_id: string | null
  queue_name: string | null
  escalation_context: EscalationContext | null
}

/**
 * Detect whether the ticket_queues table exists. Wire-compat:
 * before `msp-label-scoped-visibility` ships, we skip the
 * LEFT JOIN entirely and return NULL for queue metadata.
 * Cached per-process since the table state doesn't flip
 * during runtime except across migrations.
 */
let _hasQueuesTable: boolean | null = null
async function hasQueuesTable(): Promise<boolean> {
  if (_hasQueuesTable !== null) return _hasQueuesTable
  const result = await pool.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ticket_queues'
     ) AS present`,
  )
  _hasQueuesTable = result.rows[0]?.present ?? false
  return _hasQueuesTable
}

export async function GET(request: NextRequest) {
  // Route through the v1 chokepoint (audit C3): enforces the pairing key's
  // `tickets:read` scope — a key scoped to only e.g. `assets:read` must NOT
  // receive ticket headlines/body_preview — and writes the per-call audit row
  // that this endpoint previously skipped. Reads are header-free, so no
  // `requireActorAssertion` here (unlike the JIT detail endpoint).
  const ctx = await requireScope(request, 'tickets:read')
  if (ctx instanceof NextResponse) return ctx

  const orgId = ctx.orgId

  // Keep the pairing key's last_used_at fresh on each poll — verifyPairingKey
  // did this before auth moved to requireScope; the api_keys column drives the
  // "last active" display on the pairings admin surface. Fire-and-forget.
  if (ctx.keyId) {
    pool
      .query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [ctx.keyId])
      .catch(() => {})
  }

  // Aggregates — single query, all counts at once. base_status comes from
  // ticket_statuses joined; the workflow uses 3-state mapping.
  const aggregates = await pool.query<AggregateRow>(
    `SELECT
       COUNT(*) FILTER (WHERE ts.base_status = 'open')::int   AS ticket_count_open,
       COUNT(*) FILTER (WHERE ts.base_status = 'pending')::int AS ticket_count_pending,
       COUNT(*) FILTER (
         WHERE ts.base_status = 'closed' AND t.updated_at >= CURRENT_DATE
       )::int AS ticket_count_closed_today,
       EXTRACT(EPOCH FROM (NOW() - MIN(t.created_at) FILTER (WHERE ts.base_status = 'open')))::numeric / 3600
         AS oldest_open_ticket_age_hours,
       (SELECT COUNT(*) FROM assets WHERE organization_id = $1)::int AS asset_count,
       (SELECT COUNT(*) FROM users  WHERE organization_id = $1)::int AS user_count
     FROM tickets t
     LEFT JOIN ticket_statuses ts ON ts.id = t.status_id
     WHERE t.organization_id = $1`,
    [orgId],
  )

  // 20 most-recent tickets with extended per-ticket detail.
  //
  // Joins:
  //   - ticket_statuses: status name
  //   - users (assignee): first_name || ' ' || last_name
  //   - ticket_types: target SLA minutes (source of truth for SLA
  //     targets per Aegis's SLA model — targetResponseMinutes and
  //     targetResolutionMinutes)
  //   - ai_triage_results (most recent per ticket): priority_confidence
  //     as the triage_score signal. If a ticket has never been triaged,
  //     the LEFT JOIN yields NULL.
  //   - ticket_queues (conditional): queue metadata. Skipped entirely
  //     via the query composition below if the table doesn't exist yet
  //     (pre-Phase B).
  //
  // body_preview is computed application-side from description via
  // lib/text-utils#bodyPreview (redacts email + phone, strips HTML,
  // truncates to 200 chars). Never persisted here — the client's
  // description column stays authoritative.
  const queueJoin = (await hasQueuesTable())
    ? `LEFT JOIN ticket_queues tq ON tq.id = t.queue_id`
    : ''
  const queueCols = (await hasQueuesTable())
    ? `t.queue_id::text AS queue_id, tq.name AS queue_name,`
    : `NULL::text AS queue_id, NULL::text AS queue_name,`

  const recent = await pool.query<RecentTicketRow>(
    `SELECT
       t.id::text AS remote_ticket_id,
       t.ticket_number,
       t.subject AS title,
       ts.name AS status,
       t.priority,
       COALESCE(u.first_name || ' ' || u.last_name, '') AS assignee_name,
       t.updated_at,
       t.description,
       t.sla_first_response_due_at,
       t.sla_first_response_at,
       t.sla_resolution_due_at,
       t.sla_resolved_at,
       COALESCE(tt.sla_response_minutes,   NULL) AS target_response_minutes,
       COALESCE(tt.sla_resolution_minutes, NULL) AS target_resolution_minutes,
       COALESCE(t.scheduling_active_from, t.created_at) AS effective_start_at,
       (
         SELECT atr.priority_confidence
           FROM ai_triage_results atr
          WHERE atr.ticket_id = t.id
          ORDER BY atr.triaged_at DESC
          LIMIT 1
       ) AS triage_score,
       ${queueCols}
       ''::text AS _placeholder
     FROM tickets t
     LEFT JOIN ticket_statuses ts ON ts.id = t.status_id
     LEFT JOIN users u ON u.id = t.assigned_to
     LEFT JOIN ticket_types tt ON tt.id = t.type_id
     ${queueJoin}
     WHERE t.organization_id = $1
     ORDER BY t.updated_at DESC
     LIMIT 20`,
    [orgId],
  )

  const agg = aggregates.rows[0] || {
    ticket_count_open: 0,
    ticket_count_pending: 0,
    ticket_count_closed_today: 0,
    oldest_open_ticket_age_hours: null,
    asset_count: 0,
    user_count: 0,
  }

  // Escalation context per ticket — one lookup per ticket to keep
  // the code path simple. Returns null when
  // ticket_queue_transitions doesn't exist yet or no recent
  // transition matches the current queue. For the 20-ticket cap
  // this is negligible; if the LIMIT ever grows past ~100, revisit
  // as a single grouped subquery.
  const recentMapped: RecentTicketResponse[] = await Promise.all(
    recent.rows.map(async (r): Promise<RecentTicketResponse> => {
      const escCtx = await getEscalationContext(r.remote_ticket_id)
      const slaStatus = computeSlaStatus(
        {
          effectiveStartAt: r.effective_start_at,
          firstResponseDueAt: r.sla_first_response_due_at,
          firstResponseAt: r.sla_first_response_at,
          resolutionDueAt: r.sla_resolution_due_at,
          resolvedAt: r.sla_resolved_at,
          targetResponseMinutes: r.target_response_minutes,
          targetResolutionMinutes: r.target_resolution_minutes,
        },
        new Date(),
      )
      return {
        remote_ticket_id: r.remote_ticket_id,
        ticket_number: r.ticket_number,
        title: r.title,
        status: r.status,
        priority: r.priority,
        assignee_name: r.assignee_name || null,
        updated_at: r.updated_at,
        sla_first_response_deadline: r.sla_first_response_due_at
          ? r.sla_first_response_due_at.toISOString()
          : null,
        sla_resolution_deadline: r.sla_resolution_due_at
          ? r.sla_resolution_due_at.toISOString()
          : null,
        sla_status: slaStatus,
        triage_score: r.triage_score === null ? null : Number(r.triage_score),
        body_preview: bodyPreview(r.description),
        queue_id: r.queue_id,
        queue_name: r.queue_name,
        escalation_context: escCtx,
      }
    }),
  )

  return NextResponse.json({
    organization_id: orgId,
    polled_at: new Date().toISOString(),
    aggregates: {
      ticket_count_open: agg.ticket_count_open,
      ticket_count_pending: agg.ticket_count_pending,
      ticket_count_closed_today: agg.ticket_count_closed_today,
      oldest_open_ticket_age_hours:
        agg.oldest_open_ticket_age_hours !== null
          ? Number(Number(agg.oldest_open_ticket_age_hours).toFixed(2))
          : null,
      asset_count: agg.asset_count,
      user_count: agg.user_count,
    },
    recent_tickets: recentMapped,
  })
}
