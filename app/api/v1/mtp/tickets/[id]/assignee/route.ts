/**
 * PATCH /api/v1/mtp/tickets/[id]/assignee
 *
 * Spec: openspec/changes/msp-mtp-inline-ticket-actions (minimal write path).
 *
 * Set or clear a ticket's assignee on behalf of a specific MSP technician.
 * `{"assignee_user_id": null}` unassigns; omitting the key entirely is a 400
 * rather than a silent no-op, so "unassign" can never be confused with
 * "forgot to send the field".
 *
 * Same auth contract as …/comment. Out-of-org ticket → 404, never 403.
 *
 * SCOPE NOTE: the full spec wants "an MSP may only assign to its OWN techs",
 * which keys off `users.msp_pairing_key_id`. That column ships in migration 093
 * and is NOT in `init.sql`, so a fresh install does not have it — writing the
 * check against it now would work on an upgraded database and fail on a clean
 * one. Organization membership IS enforced (you cannot assign to someone
 * outside the customer's org); the tighter check lands with the init.sql
 * migration consolidation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireScope } from '@/lib/require-scope'
import { writeTicketUpdate, mtpWriteContextFromRequest } from '@/lib/mtp-write'

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// `.nullable()` without `.optional()`: the key must be PRESENT, and may be null.
const bodySchema = z.object({
  assignee_user_id: z.string().uuid().nullable(),
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

  try {
    const result = await writeTicketUpdate(id, mtpWriteContextFromRequest(request, ctx), {
      assigneeUserId: parsed.data.assignee_user_id,
    })

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json({ ok: true, assignee_changed: result.assigneeChanged })
  } catch (err) {
    console.error('[mtp/tickets/:id/assignee] write failed:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
