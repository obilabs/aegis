/**
 * GET /api/v1/mtp/tickets/[id]
 *
 * Spec: openspec/changes/mtp-poller-extension-sla-triage/ (2026-07-18) —
 * "New JIT endpoint returns full ticket detail on demand".
 *
 * The Just-In-Time (JIT) single-ticket detail endpoint. MTP-side ticket
 * detail views call this on-demand when a tech opens a ticket. Unlike the
 * list endpoint (`/api/v1/mtp/tickets`), this returns the full body + thread
 * + related-asset preview + available actions. The MTP MUST NOT persist the
 * body/thread/related_assets/available_actions — they are fetched-and-
 * forgotten (apps/mtp headlines-only invariant, design D2).
 *
 * Auth (design D2 + spec):
 *   - Bearer pairing key (via `requireScope`)
 *   - Actor-assertion headers REQUIRED even though this is a read — pulling a
 *     full body + thread is a sensitive read that must be attributable to a
 *     specific MSP tech. `requireActorAssertion: true` makes `requireScope`
 *     return 412 `missing-action-context` when the headers are absent.
 *   - `tickets:read` scope → 403 `insufficient_scope` when absent.
 *   - Ticket outside org / (Phase B) outside queue scope → 404 (never 403 —
 *     do not leak existence).
 *
 * D8 thread visibility is enforced server-side via `filterThreadForCaller`.
 * `available_actions` is computed server-side via `computeAvailableActions`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/require-scope'
import { pool } from '@/lib/db'
import { bodyPreview } from '@/lib/text-utils'
import { computeSlaStatus } from '@/lib/sla'
import { getEscalationContext } from '@/lib/queue-transitions'
import {
  filterThreadForCaller,
  type ThreadKind,
} from '@/lib/mtp-thread-filter'
import { computeAvailableActions } from '@/lib/mtp-available-actions'

const DEFAULT_THREAD_LIMIT = 20
const MAX_THREAD_LIMIT = 100

// Postgres `uuid` accepts any 8-4-4-4-12 hex string. Validate the path
// param against it so a malformed id returns the endpoint's 404 contract
// instead of reaching Postgres and raising 22P02 -> unhandled 500 (audit M8).
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Per-request check for the `ticket_queues` table (ships in Phase B,
 * `msp-label-scoped-visibility`). Mirrors the list endpoint + the
 * `getEscalationContext` helper. Kept inline (not cached) because the JIT
 * endpoint is per-open, low-frequency — one cheap information_schema lookup
 * is negligible next to the ticket + thread queries.
 */
async function hasQueuesTable(): Promise<boolean> {
  const r = await pool.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ticket_queues'
     ) AS present`,
  )
  return r.rows[0]?.present ?? false
}

interface TicketDetailRow {
  remote_ticket_id: string
  ticket_number: string | null
  title: string
  status: string | null
  base_status: string | null
  priority: string | null
  assignee_name: string | null
  updated_at: Date
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

interface ThreadRow {
  id: string
  kind: ThreadKind
  actor_type: 'user' | 'system' | 'msp'
  actor_name: string | null
  body: string | null
  is_internal_note: boolean
  created_at: Date
  via_pairing_key_id: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Auth + scope + actor-assertion. Order (412 → 403) is enforced inside
  // requireScope; a bad bearer already returned 401 there.
  const ctx = await requireScope(request, 'tickets:read', {
    requireActorAssertion: true,
  })
  if (ctx instanceof NextResponse) return ctx

  const orgId = ctx.orgId
  const callerPairingKeyId = ctx.keyId ?? ''

  // Malformed id can't match any ticket. Return the SAME ambiguous 404 as
  // out-of-scope / not-found rather than letting Postgres 22P02 bubble to a
  // 500 and break the endpoint's 404 contract (audit M8).
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  try {
    const hasQueues = await hasQueuesTable()
    const queueJoin = hasQueues
      ? `LEFT JOIN ticket_queues tq ON tq.id = t.queue_id`
      : ''
    const queueCols = hasQueues
      ? `t.queue_id::text AS queue_id, tq.name AS queue_name,`
      : `NULL::text AS queue_id, NULL::text AS queue_name,`

    // Single-ticket fetch, org-scoped. Same per-ticket shape as the list
    // endpoint (reuses computeSlaStatus / bodyPreview / getEscalationContext).
    const ticketResult = await pool.query<TicketDetailRow>(
      `SELECT
         t.id::text AS remote_ticket_id,
         t.ticket_number,
         t.subject AS title,
         ts.name AS status,
         ts.base_status,
         t.priority,
         COALESCE(u.first_name || ' ' || u.last_name, '') AS assignee_name,
         t.updated_at,
         t.description,
         t.sla_first_response_due_at,
         t.sla_first_response_at,
         t.sla_resolution_due_at,
         t.sla_resolved_at,
         tt.sla_response_minutes   AS target_response_minutes,
         tt.sla_resolution_minutes AS target_resolution_minutes,
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
       WHERE t.id = $1
         AND t.organization_id = $2`,
      [id, orgId],
    )

    const t = ticketResult.rows[0]
    // 404 (never 403) — do not leak existence of tickets outside the caller's
    // org or (Phase B) outside its queue scope. The queue-scope filter is a
    // no-op today: pairing keys carry no `allowed_queue_ids` until
    // `msp-label-scoped-visibility` ships. When it does, add the check here
    // and return the SAME 404 shape.
    if (!t) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // Thread limit: default 20, silently capped at 100.
    const rawLimit = Number(new URL(request.url).searchParams.get('thread_limit'))
    const threadLimit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_THREAD_LIMIT)
        : DEFAULT_THREAD_LIMIT

    // Thread = public comments + internal notes (ticket_replies) UNION
    // structural events (ticket_field_changes: status/assignment/queue). Take
    // the most-recent `threadLimit` entries, then present oldest-first.
    //
    // `via_pairing_key_id` is NULL for every row today — the write path
    // (Phase B') will stamp it. The D8 filter below is therefore a no-op now.
    const threadResult = await pool.query<ThreadRow>(
      `SELECT * FROM (
         SELECT
           tr.id::text AS id,
           (CASE WHEN tr.is_internal THEN 'internal_note' ELSE 'comment' END) AS kind,
           -- 'msp' once the write path stamps provenance. The ThreadRow type
           -- has always allowed it; nothing could produce it until now.
           (CASE WHEN tr.via_pairing_key_id IS NOT NULL THEN 'msp' ELSE 'user' END) AS actor_type,
           NULLIF(TRIM(COALESCE(
             u.first_name || ' ' || u.last_name,
             c.first_name || ' ' || c.last_name,
             -- Falls back to the asserted MSP technician so an MSP reply is
             -- never rendered anonymously when their tech has no local user row.
             tr.msp_actor_email,
             ''
           )), '') AS actor_name,
           tr.content AS body,
           tr.is_internal AS is_internal_note,
           tr.created_at,
           tr.via_pairing_key_id
         FROM ticket_replies tr
         LEFT JOIN users u ON u.id = tr.user_id
         LEFT JOIN contacts c ON c.id = tr.contact_id
         WHERE tr.ticket_id = $1

         UNION ALL

         SELECT
           'fc-' || tfc.id::text AS id,
           (CASE tfc.field_name
              WHEN 'status_id'   THEN 'status_change'
              WHEN 'assigned_to' THEN 'assignment_change'
              WHEN 'queue_id'    THEN 'queue_change'
            END) AS kind,
           (CASE WHEN tfc.changed_by IS NOT NULL THEN 'user' ELSE 'system' END) AS actor_type,
           NULLIF(TRIM(COALESCE(cu.first_name || ' ' || cu.last_name, '')), '') AS actor_name,
           NULL::text AS body,
           false AS is_internal_note,
           tfc.created_at,
           NULL::uuid AS via_pairing_key_id
         FROM ticket_field_changes tfc
         LEFT JOIN users cu ON cu.id = tfc.changed_by
         WHERE tfc.ticket_id = $1
           AND tfc.organization_id = $2
           AND tfc.field_name IN ('status_id', 'assigned_to', 'queue_id')
       ) merged
       ORDER BY created_at DESC
       LIMIT $3`,
      [id, orgId, threadLimit],
    )

    // D8 filter, then present oldest-first. Every current entry carries
    // via_pairing_key_id = null so nothing is filtered yet.
    const visible = filterThreadForCaller(
      threadResult.rows.map((r) => ({
        ...r,
        shares_activity_with_pairing_ids: [] as string[],
      })),
      callerPairingKeyId,
    )
    const thread = visible
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        actor_type: r.actor_type,
        actor_name: r.actor_name,
        body: r.body,
        is_internal_note: r.is_internal_note,
        created_at: r.created_at.toISOString(),
      }))

    // Related assets — up to 10, projecting only the three permitted fields.
    const assetsResult = await pool.query<{
      name: string
      warranty_expire: Date | null
      is_important: boolean
    }>(
      `SELECT a.name, a.warranty_expire, a.is_important
         FROM asset_tickets ast
         JOIN assets a ON a.id = ast.asset_id
        WHERE ast.ticket_id = $1
          AND a.organization_id = $2
        LIMIT 10`,
      [id, orgId],
    )
    const related_assets = assetsResult.rows.map((a) => ({
      name: a.name,
      warranty_expire: a.warranty_expire
        ? a.warranty_expire.toISOString().slice(0, 10)
        : null,
      is_important: a.is_important,
    }))

    // available_actions — computed server-side.
    //
    // `writeOptInEnabled: true` since the minimal write path shipped
    // (msp-mtp-inline-ticket-actions, 2026-08-16). It is NOT "always allow":
    // `computeAvailableActions` ANDs this with `hasScope(scopes,
    // 'tickets:write')`, and in the minimal path the SCOPE IS THE OPT-IN — the
    // customer grants `tickets:write` per pairing key when they issue it, and
    // can revoke just that scope without revoking the pairing. So a read-only
    // pairing still computes every write action as false.
    //
    // When Phase B ships `write_scope_enabled_by_customer` (a toggle the
    // customer can flip WITHOUT reissuing the key), replace this literal with
    // that column — the two-gate design is better, it just does not exist yet
    // and hardcoding `false` made the shipped write path invisible to the UI.
    //
    // `handoffQueueExists` stays false: escalation needs the queue model.
    const available_actions = computeAvailableActions({
      scopes: ctx.permissions,
      writeOptInEnabled: true,
      ticketBaseStatus: t.base_status ?? 'open',
      handoffQueueExists: false,
      closePermissionGranted: false,
    })

    const escalation_context = await getEscalationContext(t.remote_ticket_id)
    const sla_status = computeSlaStatus(
      {
        effectiveStartAt: t.effective_start_at,
        firstResponseDueAt: t.sla_first_response_due_at,
        firstResponseAt: t.sla_first_response_at,
        resolutionDueAt: t.sla_resolution_due_at,
        resolvedAt: t.sla_resolved_at,
        targetResponseMinutes: t.target_response_minutes,
        targetResolutionMinutes: t.target_resolution_minutes,
      },
      new Date(),
    )

    return NextResponse.json({
      // Per-ticket list-shape fields (superset of the list endpoint entry).
      remote_ticket_id: t.remote_ticket_id,
      ticket_number: t.ticket_number,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee_name: t.assignee_name || null,
      updated_at: t.updated_at.toISOString(),
      sla_first_response_deadline: t.sla_first_response_due_at
        ? t.sla_first_response_due_at.toISOString()
        : null,
      sla_resolution_deadline: t.sla_resolution_due_at
        ? t.sla_resolution_due_at.toISOString()
        : null,
      sla_status,
      triage_score: t.triage_score === null ? null : Number(t.triage_score),
      body_preview: bodyPreview(t.description),
      queue_id: t.queue_id,
      queue_name: t.queue_name,
      escalation_context,
      // JIT-only fields (never persisted MTP-side).
      body: t.description,
      thread,
      related_assets,
      available_actions,
    })
  } catch (err) {
    console.error('[mtp/tickets/:id] detail fetch failed:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
