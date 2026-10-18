import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { verifyAuditChain } from '@/lib/audit-chain'

/**
 * GET /api/settings/audit-log/verify
 *
 * Walks the audit_log hash chain (migration 098) and reports the first break
 * with its row id. Read-only; it cannot repair anything, because a repairable
 * audit trail is not evidence.
 *
 * Admin-only: the response tells an operator exactly where the trail stops
 * being trustworthy, which is also exactly what someone covering their tracks
 * would want to know.
 *
 * Returns 200 with `ok: false` when the chain is broken — a broken chain is a
 * successful verification with a bad answer, not a request failure.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isAdmin(ctx.userId))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const fromParam = new URL(request.url).searchParams.get('fromSeq')
  const fromSeq = fromParam === null ? undefined : Number(fromParam)
  if (fromSeq !== undefined && (!Number.isInteger(fromSeq) || fromSeq < 1)) {
    return NextResponse.json({ error: 'fromSeq must be a positive integer' }, { status: 400 })
  }

  try {
    const verification = await verifyAuditChain(fromSeq)
    return NextResponse.json(verification)
  } catch (error) {
    console.error('[audit-chain] Verification failed:', error)
    return NextResponse.json({ error: 'Failed to verify audit chain' }, { status: 500 })
  }
}
