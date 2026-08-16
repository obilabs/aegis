/**
 * POST /api/v1/mtp/tickets/[id]/comment
 *
 * Spec: openspec/changes/msp-mtp-inline-ticket-actions (minimal write path).
 *
 * Adds a public comment or an internal note to a ticket on behalf of a specific
 * MSP technician, optionally combined with a status and/or assignee change in
 * the SAME transaction (the spec's "combined write" — one round trip, and more
 * importantly one atomic outcome).
 *
 * Auth, all enforced by `requireScope`:
 *   - Bearer pairing key                       → 401 if absent/invalid
 *   - `tickets:write` scope                    → 403 `insufficient_scope`
 *   - actor-assertion headers (write scope)    → 412 `missing-action-context`
 *
 * The `tickets:write` scope IS the customer's write opt-in. It is granted per
 * pairing key by the customer when they issue it, so an MSP that was given a
 * read-only key cannot write no matter what MTP sends — and the customer can
 * revoke it without revoking the pairing.
 *
 * Ticket outside the caller's organization → 404, never 403 (existence is not
 * disclosed), matching the read endpoints.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireScope } from '@/lib/require-scope'
import { writeTicketUpdate, mtpWriteContextFromRequest } from '@/lib/mtp-write'

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const bodySchema = z.object({
  body: z.string().min(1).max(50_000),
  /**
   * REQUIRED — no default, on purpose.
   *
   * `ticket_replies.is_internal` defaults to FALSE in the schema, i.e. the
   * default direction is customer-visible. If this field were optional, a
   * caller that forgot it would silently publish a staff-only note to the
   * customer. Making it required turns that into a 400 instead.
   */
  is_internal: z.boolean(),
  time_spent_minutes: z.number().int().min(0).max(10_000).optional(),
  // Optional combined write.
  status_id: z.string().uuid().optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const ctx = await requireScope(request, 'tickets:write')
  if (ctx instanceof NextResponse) return ctx

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', detail: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const input = parsed.data

  try {
    const result = await writeTicketUpdate(id, mtpWriteContextFromRequest(request, ctx), {
      comment: {
        body: input.body,
        isInternal: input.is_internal,
        timeSpentMinutes: input.time_spent_minutes,
      },
      statusId: input.status_id,
      assigneeUserId: input.assignee_user_id,
    })

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      reply_id: result.replyId,
      is_internal: input.is_internal,
      status_changed: result.statusChanged,
      assignee_changed: result.assigneeChanged,
    })
  } catch (err) {
    console.error('[mtp/tickets/:id/comment] write failed:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
