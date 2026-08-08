/**
 * POST /api/v1/mtp/handshake
 *
 * Spec: openspec/changes/mtp-phase1/proposal.md (D72) + pairing-mode hardening (2026-05-06)
 *
 * Validates an MTP pairing key + binds it to the calling MTP install on the
 * first successful call. Single-use: subsequent handshake attempts on the
 * same key are refused. /api/v1/mtp/tickets does NOT gate on this — once
 * bound, the MTP keeps polling forever until the customer revokes.
 *
 * Pairing window: the customer issues a key with a 15-minute pairing
 * window (extendable). Outside the window the handshake refuses with 401
 * even with a valid key — defense in depth against leaked keys that show
 * up days later from a screenshot or backup.
 *
 * Auth: bearer-token via the pairing key. NOT session-auth, NOT a regular
 * `aegis_*` API key — this is its own credential type.
 */

import { NextRequest, NextResponse } from 'next/server'
import { completeHandshake } from '@/lib/mtp-pairings'
import { queryOne } from '@/lib/db'

function clientIp(request: NextRequest): string | null {
  // Trust X-Forwarded-For only because this route is always behind nginx.
  // Take the leftmost (originating) entry.
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || null
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  const outcome = await completeHandshake({
    rawKey: token,
    fromIp: clientIp(request),
    userAgent: request.headers.get('user-agent') || null,
  })

  if (outcome.kind === 'invalid') {
    return NextResponse.json({ error: 'Invalid or revoked pairing key' }, { status: 401 })
  }
  if (outcome.kind === 'already_paired') {
    // Don't leak the original pairing IP/UA — only the customer should see
    // that. The MSP just needs to know they need a new key.
    return NextResponse.json(
      {
        error: 'Pairing key has already been used. Single-use binding is in effect — ' +
               'ask the customer to issue a new pairing key from their MTP integrations page.',
        kind: 'already_paired',
      },
      { status: 401 },
    )
  }
  if (outcome.kind === 'window_closed') {
    return NextResponse.json(
      {
        error: 'Pairing window has closed. Ask the customer to extend it (or issue a ' +
               'new key) from their MTP integrations page.',
        kind: 'window_closed',
        window_expired_at: outcome.windowExpiresAt,
      },
      { status: 401 },
    )
  }

  // First successful handshake. paired_at, paired_from_ip, paired_user_agent
  // were just set inside completeHandshake().
  const pairing = outcome.pairing

  const org = await queryOne<{ id: string; name: string; created_at: Date }>(
    `SELECT id, name, created_at FROM organizations WHERE id = $1`,
    [pairing.organization_id],
  )
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 500 })
  }

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      created_at: org.created_at,
    },
    pairing: {
      id: pairing.id,
      display_name: pairing.display_name,
      scopes: pairing.scopes,
    },
    server: {
      api_version: 'v1',
      capabilities: ['tickets:read'],
      // Echo back the URL the MSP can use as the canonical poll endpoint.
      // MTP uses this rather than constructing it from the request URL,
      // which can be wrong when a proxy is in front (X-Forwarded-Host etc.).
      tickets_endpoint: '/api/v1/mtp/tickets',
    },
  })
}
