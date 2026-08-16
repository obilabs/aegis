/**
 * PATCH /api/v1/mtp/tickets/[id]/status
 *
 * Spec: openspec/changes/msp-mtp-inline-ticket-actions (minimal write path).
 *
 * Transition a ticket's status on behalf of a specific MSP technician, with an
 * optional note attached in the same transaction (status changes without an
 * explanation are the thing customers complain about in QBRs).
 *
 * Same auth contract as …/comment — `requireScope(req, 'tickets:write')`
 * enforces bearer + scope + actor-assertion headers. Out-of-org → 404.
 *
 * Queue changes are deliberately NOT reachable here: per design D14/D15 a
 * routing change goes through the escalation workflow, never a field patch.
 * That endpoint ships with the queue model (Phase B) and is out of scope for
 * the minimal write path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireScope } from '@/lib/require-scope'
import { writeTicketUpdate, mtpWriteContextFromRequest } from '@/lib/mtp-write'

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const bodySchema = z.object({
  status_id: z.string().uuid(),
  /** Optional note recorded with the transition. `is_internal` required if present. */
  note: z
    .object({
      body: z.string().min(1).max(50_000),
      is_internal: z.boolean(),
    })
    .optional(),
})

export async function PATCH(
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
      statusId: input.status_id,
      comment: input.note
        ? { body: input.note.body, isInternal: input.note.is_internal }
        : undefined,
    })

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      status_changed: result.statusChanged,
      reply_id: result.replyId,
    })
  } catch (err) {
    console.error('[mtp/tickets/:id/status] write failed:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
