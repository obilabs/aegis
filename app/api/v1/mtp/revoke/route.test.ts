import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/require-scope', () => ({ requireScope: vi.fn() }))
vi.mock('@/lib/mtp-pairings', () => ({ revokePairing: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { requireScope } from '@/lib/require-scope'
import { revokePairing } from '@/lib/mtp-pairings'
import { logAudit } from '@/lib/audit'
import { POST } from './route'

function req(headers: Record<string, string> = {}) {
  return new Request('https://aegis.example/api/v1/mtp/revoke', {
    method: 'POST',
    headers: {
      'x-aegis-acting-user-email': 'tech@msp.example',
      'x-aegis-action-ticket': 'MTP-123',
      ...headers,
    },
  }) as any
}
const CTX = {
  userId: 'u-admin',
  orgId: 'org-1',
  keyId: 'key-1',
  permissions: ['tickets:read'],
  keyType: 'aegis-mtp-pairing',
  authMethod: 'aegis_bearer',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/v1/mtp/revoke — MSP self-revoke', () => {
  it('revokes the presenting key and returns { success, revoked, pairing_id }', async () => {
    vi.mocked(requireScope).mockResolvedValue(CTX as any)
    vi.mocked(revokePairing).mockResolvedValue(true)
    const res = await POST(req())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, revoked: true, pairing_id: 'key-1' })
    // self-revoke: the presenting key's OWN id + org, never a caller-supplied target
    expect(revokePairing).toHaveBeenCalledWith(
      expect.objectContaining({ pairingId: 'key-1', organizationId: 'org-1' }),
    )
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'api_key_revoked', actionCategory: 'delete', entityId: 'key-1' }),
    )
  })

  it('passes through the requireScope response (401/403/412) unchanged', async () => {
    const denied = NextResponse.json({ error: 'missing-action-context' }, { status: 412 })
    vi.mocked(requireScope).mockResolvedValue(denied as any)
    const res = await POST(req({}))
    expect(res.status).toBe(412)
    expect(revokePairing).not.toHaveBeenCalled() // gate fired before any revoke
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('reports revoked:false on the idempotent no-op race (revokePairing → false)', async () => {
    vi.mocked(requireScope).mockResolvedValue(CTX as any)
    vi.mocked(revokePairing).mockResolvedValue(false)
    const res = await POST(req())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.revoked).toBe(false)
  })
})
