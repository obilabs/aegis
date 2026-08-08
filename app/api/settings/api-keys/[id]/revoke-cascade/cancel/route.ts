/**
 * POST /api/settings/api-keys/[id]/revoke-cascade/cancel
 *
 * Cancel a queued cascade during the 60-second undo window. Route
 * body: { queue_id }. If the queue row is state='queued', mark it
 * cancelled. If already committed/failed/cancelled, refuse with 409
 * so the UI can update its state accordingly.
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getOrgId } from '@/lib/org'
import { pool } from '@/lib/db'
import { cancelCascade } from '@/lib/cascade-revoke'
import { logAudit, getClientIp } from '@/lib/audit'

const CancelSchema = z.object({
  queue_id: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { id: pairingKeyId } = await params
  const orgId = await getOrgId()

  const body = await request.json().catch(() => ({}))
  const parsed = CancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'queue_id is required (uuid)' },
      { status: 400 },
    )
  }

  const result = await cancelCascade({
    queueId: parsed.data.queue_id,
    orgId,
  })

  if (result.cancelled) {
    const actor = await pool.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email],
    )
    const actorUserId = actor.rows[0]?.id
    if (actorUserId) {
      logAudit({
        orgId,
        userId: actorUserId,
        action: 'cascade_revoke_cancelled',
        actionCategory: 'settings',
        entityType: 'api_key',
        entityId: pairingKeyId,
        newValues: { queue_id: parsed.data.queue_id },
        actorIp: getClientIp(request.headers),
      })
    }
    return NextResponse.json({ cancelled: true, state: 'cancelled' })
  }

  return NextResponse.json(
    {
      cancelled: false,
      state: result.state,
      error: `Cannot cancel — cascade is ${result.state}`,
    },
    { status: 409 },
  )
}
