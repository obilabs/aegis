/**
 * requireScope — single enforcement wrapper for /api/v1/* routes.
 *
 * Every external (API-key) v1 handler MUST go through this. Inline
 * `permissions.includes(...)` checks elsewhere are forbidden — the wildcard
 * resolution (`admin:full`) lives in `hasScope` only. Helios shipped a bug
 * where they reimplemented the check and dropped the wildcard; we don't repeat
 * that here.
 *
 * Session-cookie auth (UI requests) bypasses scope enforcement: the UI is the
 * gate for those calls. Only API-key / bearer auth flows through `hasScope`.
 *
 * For `delegated-write` keys, this is ALSO the chokepoint that enforces the
 * per-call audit headers (`X-Aegis-Action-Ticket`, `X-Aegis-Acting-User-
 * Email`) on write/delete scope calls. Spec: openspec/changes/api-keys-typed-
 * scoped/specs/api-keys/spec.md.
 *
 * Usage:
 *   export async function GET(req: NextRequest) {
 *     const ctx = await requireScope(req, 'tickets:read')
 *     if (ctx instanceof NextResponse) return ctx
 *     // ctx.userId / ctx.orgId / ctx.permissions are now available
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { hasScope, type ApiScope } from '@obilabs/api-scopes'
import { validateApiRequest, logApiKeyCall, type ApiAuthContext } from '@/lib/api-auth'

function requestIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  )
}

// ---------------------------------------------------------------------------
// Delegated-write header validation
// ---------------------------------------------------------------------------
//
// Two assertion headers are required on every write/delete call made with a
// delegated-write key. Both are shape-validated (not authenticated): the
// bearer key auths the MSP firm; the headers are the firm's assertion about
// which of its own users took the action. Audit captures both verbatim.

const ACTING_USER_EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const ACTION_TICKET_RE = /^[A-Z0-9]+-\d+$/

/**
 * Decide whether the scope being enforced is a write or delete operation
 * (in which case delegated-write keys must supply both headers). Reads
 * don't require an actor assertion — the bearer key alone is sufficient
 * for read auth and the asset isn't being mutated.
 */
function scopeRequiresActorAssertion(scope: ApiScope): boolean {
  // admin:full is treated as write because it grants every write/delete.
  if (scope === 'admin:full') return true
  return scope.endsWith(':write') || scope.endsWith(':delete')
}

interface ActorAssertion {
  email: string | null
  ticketRef: string | null
  missing: string[]
  invalid: string[]
}

function readActorAssertion(request: NextRequest): ActorAssertion {
  const emailHeader = request.headers.get('x-aegis-acting-user-email')
  const ticketHeader = request.headers.get('x-aegis-action-ticket')
  const missing: string[] = []
  const invalid: string[] = []

  if (!emailHeader) missing.push('X-Aegis-Acting-User-Email')
  else if (!ACTING_USER_EMAIL_RE.test(emailHeader)) invalid.push('X-Aegis-Acting-User-Email')

  if (!ticketHeader) missing.push('X-Aegis-Action-Ticket')
  else if (!ACTION_TICKET_RE.test(ticketHeader)) invalid.push('X-Aegis-Action-Ticket')

  return {
    email: emailHeader ?? null,
    ticketRef: ticketHeader ?? null,
    missing,
    invalid,
  }
}

export interface RequireScopeOptions {
  /**
   * Force actor-assertion header enforcement even for a read scope.
   *
   * By default the assertion headers (`X-Aegis-Action-Ticket` +
   * `X-Aegis-Acting-User-Email`) are only required on write/delete scopes
   * (see `scopeRequiresActorAssertion`). The MTP JIT single-ticket endpoint
   * (`GET /api/v1/mtp/tickets/{id}`) is the one read that DOES require them:
   * pulling a full ticket body + thread is a sensitive read that must be
   * attributable to a specific MSP tech for audit forensics. Spec:
   * mtp-poller-extension-sla-triage — "New JIT endpoint returns full ticket
   * detail on demand" (missing headers → 412 missing-action-context).
   */
  requireActorAssertion?: boolean
}

export async function requireScope(
  request: NextRequest,
  required: ApiScope,
  opts?: RequireScopeOptions,
): Promise<ApiAuthContext | NextResponse> {
  const ctx = await validateApiRequest(request)
  if (ctx instanceof NextResponse) return ctx

  // Session-cookie auth (no API key) bypasses scope checks. The UI grants
  // permissions through its own gate; API-key flows are the only ones that
  // need scope enforcement and per-call audit.
  if (ctx.authMethod === 'session') {
    return ctx
  }

  const url = new URL(request.url)
  const ip = requestIp(request)
  const ua = request.headers.get('user-agent')

  // -------------------------------------------------------------------------
  // Actor-assertion header enforcement (BEFORE scope check)
  //
  // Two key types require per-call actor headers on write/delete calls:
  //   - delegated-write: original audit-friendly contract
  //   - aegis-mtp-pairing: extended to pairing keys per
  //     pairing-keys-actor-assertion (2026-06-10). The MSP firm's
  //     bearer key auths the firm; the headers carry the specific
  //     MSP tech identity for audit forensics.
  //
  // We intentionally validate the assertion headers before checking scopes
  // so an integration that sends well-formed assertion headers but is
  // missing the right scope gets a coherent 403 (insufficient_scope),
  // while one that has the scope but forgot the headers gets a coherent
  // 412 (missing-action-context). Both audit rows are written.
  // -------------------------------------------------------------------------
  // Key types that carry the actor-assertion contract. Normally the two
  // firm-held write-capable types. When an endpoint opts into
  // `requireActorAssertion` (the JIT ticket-detail read), org-owned
  // `mtp-polling` keys are included too: a firm-held key must still assert
  // WHICH human pulled a full ticket body/thread, or the JIT read's "sensitive
  // read must be attributable" invariant is only aspirational (audit M11).
  // Personal keys are excluded — they already ARE a specific user.
  const actorHeaderKeyTypes: readonly string[] =
    opts?.requireActorAssertion === true
      ? ['delegated-write', 'aegis-mtp-pairing', 'mtp-polling']
      : ['delegated-write', 'aegis-mtp-pairing']
  const keyTypeRequiresActorHeaders =
    ctx.keyType !== undefined && actorHeaderKeyTypes.includes(ctx.keyType)
  const actorAssertionRequired =
    scopeRequiresActorAssertion(required) || opts?.requireActorAssertion === true
  if (keyTypeRequiresActorHeaders && actorAssertionRequired) {
    const assertion = readActorAssertion(request)
    if (assertion.missing.length > 0 || assertion.invalid.length > 0) {
      if (ctx.keyId) {
        logApiKeyCall({
          apiKeyId: ctx.keyId,
          organizationId: ctx.orgId,
          userId: ctx.userId,
          method: request.method,
          path: url.pathname,
          requiredScope: required,
          scopeGranted: false,
          requestIp: ip,
          userAgent: ua,
          statusCode: 412,
          actingUserEmail: assertion.email,
          actionTicketRef: assertion.ticketRef,
        })
      }
      return NextResponse.json(
        {
          error: 'missing-action-context',
          message:
            `This ${ctx.keyType} key requires X-Aegis-Action-Ticket and ` +
            'X-Aegis-Acting-User-Email headers on every write/delete call. ' +
            'Reads do not require them. For MTP keys, the acting MSP tech ' +
            'identity sources from your MTP session; for ticket-less actions ' +
            'use a synthetic ref like MTP-<unix-seconds>.',
          required_headers: ['X-Aegis-Action-Ticket', 'X-Aegis-Acting-User-Email'],
          missing: assertion.missing,
          invalid: assertion.invalid,
        },
        { status: 412 },
      )
    }
  }

  const granted = hasScope(ctx.permissions, required)

  // Capture assertion headers for audit when present. Read for both
  // key types that support the contract — delegated-write (existing)
  // and aegis-mtp-pairing (added by pairing-keys-actor-assertion).
  // For non-actor-asserting types (personal, mtp-polling), the
  // headers are ignored; the audit columns stay NULL.
  const assertion =
    keyTypeRequiresActorHeaders ? readActorAssertion(request) : null

  if (ctx.keyId) {
    logApiKeyCall({
      apiKeyId: ctx.keyId,
      organizationId: ctx.orgId,
      userId: ctx.userId,
      method: request.method,
      path: url.pathname,
      requiredScope: required,
      scopeGranted: granted,
      requestIp: ip,
      userAgent: ua,
      statusCode: granted ? null : 403,
      actingUserEmail: assertion?.email ?? null,
      actionTicketRef: assertion?.ticketRef ?? null,
    })
  }

  if (!granted) {
    return NextResponse.json(
      {
        error: 'insufficient_scope',
        message: `This API key is missing required scope: ${required}`,
        required_scope: required,
      },
      { status: 403 },
    )
  }

  return ctx
}
