/**
 * POST /api/v1/mtp/revoke
 *
 * MSP self-revocation: the presenting pairing key revokes ITSELF (kill switch).
 * Actor-asserted (X-Aegis-* headers, enforced by requireScope) + audited.
 * Touches ONLY api_keys (via revokePairing) + audit_log — NEVER any ITSM data
 * (design D5: revoke severs MSP access; it does not offboard/delete anything else).
 *
 * Auth: bearer aegis-mtp-pairing key. requireScope authenticates it, confines
 * it to /api/v1/mtp/*, and forces the 412 missing-action-context contract.
 * A self-revoke is inherent to ANY pairing key regardless of granted scope, so
 * this gates on the always-held 'tickets:read' scope + requireActorAssertion
 * rather than demanding a write scope the key may not carry.
 *
 * Response shape matches the platform HeliosAdapter/AegisAdapter revoke contract
 * ({ success: boolean, ... }): { success: true, revoked: <bool>, pairing_id }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/require-scope'
import { revokePairing } from '@/lib/mtp-pairings'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const ctx = await requireScope(request, 'tickets:read', { requireActorAssertion: true })
  if (ctx instanceof NextResponse) return ctx  // 401/403/412 already formed

  const actingEmail = request.headers.get('x-aegis-acting-user-email')
  const actionTicket = request.headers.get('x-aegis-action-ticket')

  const revoked = await revokePairing({
    pairingId: ctx.keyId!,          // the presenting key revokes ITSELF
    organizationId: ctx.orgId,
    reason: `MSP self-revoke by ${actingEmail} (${actionTicket})`,
  })

  logAudit({
    orgId: ctx.orgId,
    userId: ctx.userId,             // = api_keys.created_by (issuing admin)
    action: 'api_key_revoked',
    actionCategory: 'delete',
    entityType: 'api_key',
    entityId: ctx.keyId,
    newValues: { reason: 'msp_self_revoke', acting_msp_email: actingEmail, action_ticket_ref: actionTicket },
    actorIp: request.headers.get('x-real-ip'),
  })

  return NextResponse.json({ success: true, revoked, pairing_id: ctx.keyId })
}
