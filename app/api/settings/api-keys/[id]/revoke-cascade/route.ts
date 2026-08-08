/**
 * POST /api/settings/api-keys/[id]/revoke-cascade
 *
 * Spec: openspec/changes/msp-cascade-revocation/design.md
 *
 * Cascade-revoke an MSP firm's pairing key. All downstream child
 * api_keys are revoked, all msp_provisioned users under the pairing
 * are disabled with a key_version bump, and every Better Auth session
 * for those users is expired. The whole thing runs as one atomic
 * audit-traceable transaction (see lib/cascade-revoke.ts).
 *
 * Two modes:
 *
 *   * Default — 60-second undo window. Endpoint enqueues the cascade,
 *     returns 202 with { queue_id, commit_after, preview }. UI shows
 *     a countdown banner; user can call /cancel within the window.
 *     commitCascade() fires at commit_after via setTimeout OR the
 *     boot-recovery job if the process dies before then.
 *
 *   * skip_undo: true — synchronous commit. Endpoint calls
 *     commitCascade() inline, returns 200 with the post-commit result.
 *     Use only when the operator explicitly opts in (design D8
 *     modal's second confirmation), e.g. mid-incident-response where
 *     60s is an eternity.
 *
 * Guards enforced here (design D6):
 *   * Target must be key_type='aegis-mtp-pairing'
 *   * Self-DoS guard: refuse with 409 self-dos-guard if the caller's
 *     own user record is msp_provisioned under this pairing
 *   * Admin-only
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { pool, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import {
  previewCascade,
  queueCascade,
  commitCascade,
} from '@/lib/cascade-revoke'
import { logAudit, getClientIp } from '@/lib/audit'

const RequestSchema = z.object({
  reason: z.string().min(3).max(500),
  skip_undo: z.boolean().optional().default(false),
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
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { reason, skip_undo } = parsed.data

  // Resolve session user → application users.id UUID.
  const actor = await pool.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [session.user.email],
  )
  const actorUserId: string | undefined = actor.rows[0]?.id
  if (!actorUserId) {
    return NextResponse.json(
      { error: 'Actor user not found in application users table' },
      { status: 500 },
    )
  }

  // Guard 1: target must exist, belong to this org, and be aegis-mtp-pairing.
  const target = await queryOne<{
    id: string
    key_type: string
    is_revoked: boolean
    name: string
  }>(
    `SELECT id, key_type, is_revoked, name
       FROM api_keys
      WHERE id = $1 AND organization_id = $2`,
    [pairingKeyId, orgId],
  )
  if (!target) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }
  if (target.key_type !== 'aegis-mtp-pairing') {
    return NextResponse.json(
      {
        error: 'Cascade revoke only applies to aegis-mtp-pairing keys',
        key_type: target.key_type,
      },
      { status: 400 },
    )
  }
  if (target.is_revoked) {
    return NextResponse.json(
      { error: 'Pairing key is already revoked', kind: 'already_revoked' },
      { status: 409 },
    )
  }

  // Guard 2: self-DoS. Would the caller's own user record be cascade-disabled?
  const selfCheck = await pool.query(
    `SELECT 1
       FROM users
      WHERE id = $1
        AND msp_pairing_key_id = $2
        AND user_origin = 'msp_provisioned'`,
    [actorUserId, pairingKeyId],
  )
  if ((selfCheck.rowCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: 'self-dos-guard',
        message:
          'Your current user account was provisioned by this MSP pairing. ' +
          'Revoking it would disable your own account. Re-authenticate as a ' +
          'customer-native admin first, then retry.',
      },
      { status: 409 },
    )
  }

  // Preview counts — for the response body regardless of mode.
  const preview = await previewCascade({ pairingKeyId, orgId })

  // Skip-undo path — synchronous commit.
  if (skip_undo) {
    const queued = await queueCascade({
      pairingKeyId,
      organizationId: orgId,
      actorUserId,
      reason,
    })
    let result
    try {
      result = await commitCascade({ queueId: queued.id })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'commit failed'
      return NextResponse.json(
        { error: `Cascade commit failed: ${msg}`, queue_id: queued.id },
        { status: 500 },
      )
    }
    logAudit({
      orgId,
      userId: actorUserId,
      action: 'cascade_revoke_immediate',
      actionCategory: 'settings',
      entityType: 'api_key',
      entityId: pairingKeyId,
      entityName: target.name,
      newValues: { reason, skip_undo: true, ...result },
      actorIp: getClientIp(request.headers),
    })
    return NextResponse.json({
      committed: true,
      queue_id: queued.id,
      preview,
      ...result,
    })
  }

  // Default path — enqueue + schedule commit.
  const queued = await queueCascade({
    pairingKeyId,
    organizationId: orgId,
    actorUserId,
    reason,
  })

  // Schedule the commit at commit_after. If the process dies before
  // then, recoverPendingCascades() at boot picks it up.
  const delayMs = Math.max(
    0,
    new Date(queued.commit_after).getTime() - Date.now(),
  )
  setTimeout(() => {
    commitCascade({ queueId: queued.id }).catch(err => {
      console.error(
        `[cascade-scheduled] commit failed for queue_id=${queued.id}:`,
        err instanceof Error ? err.message : err,
      )
    })
  }, delayMs).unref?.()

  logAudit({
    orgId,
    userId: actorUserId,
    action: 'cascade_revoke_queued',
    actionCategory: 'settings',
    entityType: 'api_key',
    entityId: pairingKeyId,
    entityName: target.name,
    newValues: { reason, queue_id: queued.id, preview },
    actorIp: getClientIp(request.headers),
  })

  return NextResponse.json(
    {
      queued: true,
      queue_id: queued.id,
      commit_after: queued.commit_after,
      preview,
    },
    { status: 202 },
  )
}
