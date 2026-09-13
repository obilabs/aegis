/**
 * The licence plan key is never interpreted.
 *
 * Aegis is free and never gates on a licence, so whatever plan key the control
 * plane reports (a current one, a retired one, or one this build has never
 * heard of) must behave exactly like community: the community feature floor,
 * and no plan-specific write beyond the licence snapshot itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LicenseResult } from '@obilabs/licensing'

const mocks = vi.hoisted(() => ({
  query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] as unknown[] })),
  queryOne: vi.fn(),
  validateLicense: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ query: mocks.query, queryOne: mocks.queryOne }))
vi.mock('@/lib/telemetry-consent', () => ({
  getEffectiveTelemetryState: async () => ({ effective: 'on' }),
}))
vi.mock('@obilabs/licensing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@obilabs/licensing')>()),
  validateLicense: mocks.validateLicense,
}))

function result(plan: string | null): LicenseResult {
  const now = new Date().toISOString()
  return {
    state: 'valid',
    reason: 'ok',
    message: '',
    product: 'aegis',
    plan,
    features: null,
    expiresAt: null,
    trial: false,
    trialEndsAt: null,
    daysRemaining: null,
    trialEndingSoon: false,
    checkedAt: now,
    authoritativeAt: now,
  } as LicenseResult
}

describe('unknown plan keys behave like community', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.query.mockClear()
    mocks.validateLicense.mockReset()
    mocks.queryOne.mockResolvedValue({
      id: 'org-1',
      instance_id: 'Aegis_deadbeefdeadbeefdeadbeef',
      license_key: 'lic_agc_test_1_sig',
      license_state: null,
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    process.emit('SIGTERM' as any)
    vi.restoreAllMocks()
  })

  it.each(['community', 'retired_plan', 'some_future_plan'])(
    'plan %s → community floor, only the snapshot is persisted',
    async (plan) => {
      mocks.validateLicense.mockResolvedValue(result(plan))
      const hb = await import('./license-heartbeat')
      hb.startLicenseHeartbeat()
      await vi.waitFor(() => expect(mocks.query).toHaveBeenCalled())
      await new Promise((r) => setTimeout(r, 50)) // let any follow-up write land

      expect(hb.isLicensed()).toBe(true)
      expect(hb.getLicenseFeatures()).toEqual({})
      expect(hb.hasLicenseFeature('support_chat')).toBe(false)
      expect(mocks.query).toHaveBeenCalledTimes(1)
      expect(String(mocks.query.mock.calls[0]?.[0])).toContain('{license_state}')
    },
  )

  it('no plan reported → getLicensePlan() reads as community', async () => {
    mocks.validateLicense.mockResolvedValue(result(null))
    const hb = await import('./license-heartbeat')
    hb.startLicenseHeartbeat()
    await vi.waitFor(() => expect(mocks.query).toHaveBeenCalled())
    expect(hb.getLicensePlan()).toBe('community')
  })
})
