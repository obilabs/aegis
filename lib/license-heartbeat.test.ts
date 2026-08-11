/**
 * Fail-open contract for the licence heartbeat (seam-review g1/g3).
 *
 * Aegis is fully community/AGPL: a licence result must NEVER block or degrade
 * the product. These tests pin the three-state contract the heartbeat now
 * rides on via @obilabs/licensing:
 *
 *   valid   → allow, no warning
 *   unknown → allow, silent (outage is not a licence problem)
 *   invalid → allow + warn, degrade NOTHING
 *
 * ...and that validateLicense never throws (g3: the old hand-rolled fetch
 * only checked res.ok and never read the body).
 */

import { describe, it, expect } from 'vitest'
import {
  validateLicense,
  applyFailOpenPolicy,
  isPersistableStatus,
  type LicenseResult,
  type CachedLicenseSnapshot,
} from '@obilabs/licensing'
import {
  startLicenseHeartbeat,
  getLicensePlan,
  getLicenseFeatures,
  hasLicenseFeature,
  isLicensed,
} from './license-heartbeat'

function makeResult(overrides: Partial<LicenseResult>): LicenseResult {
  return {
    state: 'valid',
    reason: 'ok',
    message: '',
    product: 'aegis',
    plan: 'donor',
    features: null,
    expiresAt: null,
    // Trial lifecycle fields are part of the published LicenseResult contract;
    // a non-trial community/donor licence sets them to their inactive defaults.
    trial: false,
    trialEndsAt: null,
    daysRemaining: null,
    trialEndingSoon: false,
    checkedAt: new Date().toISOString(),
    authoritativeAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('fail-open policy (the non-negotiable contract)', () => {
  it('valid → allow, no warning', () => {
    const d = applyFailOpenPolicy(makeResult({ state: 'valid', reason: 'ok' }))
    expect(d.allow).toBe(true)
    expect(d.warn).toBe(false)
  })

  it('unknown (outage/timeout) → allow, silent', () => {
    for (const reason of ['unreachable', 'timeout', 'server_error', 'not_configured'] as const) {
      const d = applyFailOpenPolicy(makeResult({ state: 'unknown', reason, authoritativeAt: null }))
      expect(d.allow).toBe(true)
      expect(d.warn).toBe(false)
    }
  })

  it('invalid (authoritative negative) → allow + warn, degrade nothing', () => {
    for (const reason of ['revoked', 'expired', 'not_found', 'suspended'] as const) {
      const d = applyFailOpenPolicy(makeResult({ state: 'invalid', reason }))
      expect(d.allow).toBe(true) // NEVER blocks — Aegis has nothing gated to degrade
      expect(d.warn).toBe(true)
    }
  })

  it('only authoritative answers are persistable — unknown never becomes a stored verdict', () => {
    expect(isPersistableStatus(makeResult({ state: 'valid' }))).toBe(true)
    expect(isPersistableStatus(makeResult({ state: 'invalid', reason: 'revoked' }))).toBe(true)
    expect(isPersistableStatus(makeResult({ state: 'unknown', reason: 'unreachable' }))).toBe(false)
  })
})

describe('validateLicense never throws (g3 fix)', () => {
  it('unreachable control plane resolves to unknown instead of throwing', async () => {
    const result = await validateLicense('AEGIS-TEST-KEY', {
      baseUrl: 'http://127.0.0.1:9', // discard port — connection refused
      instanceId: 'Aegis_deadbeefdeadbeefdeadbeef',
      version: '0.0.0-test',
      timeoutMs: 1_000,
    })
    expect(result.state).toBe('unknown')
    expect(applyFailOpenPolicy(result).allow).toBe(true)
  })

  it('an unknown result carries the cached snapshot as its grace anchor', async () => {
    const cached: CachedLicenseSnapshot = {
      state: 'valid',
      reason: 'ok',
      product: 'aegis',
      plan: 'donor',
      expiresAt: null,
      authoritativeAt: '2026-08-01T00:00:00.000Z',
    }
    const result = await validateLicense('AEGIS-TEST-KEY', {
      baseUrl: 'http://127.0.0.1:9',
      instanceId: 'Aegis_deadbeefdeadbeefdeadbeef',
      version: '0.0.0-test',
      timeoutMs: 1_000,
      cached,
    })
    expect(result.state).toBe('unknown')
    expect(result.authoritativeAt).toBe(cached.authoritativeAt)
    expect(result.plan).toBe('donor')
  })
})

describe('null-safe accessors default to the community floor', () => {
  it('before any heartbeat has ever run', () => {
    expect(getLicensePlan()).toBe('community')
    expect(getLicenseFeatures()).toEqual({})
    expect(hasLicenseFeature('anything_at_all')).toBe(false)
    expect(isLicensed()).toBe(false)
  })
})

describe('startLicenseHeartbeat never blocks or throws', () => {
  it('returns synchronously even with no reachable database', () => {
    // No DATABASE_URL in the test env — the first fire will fail internally
    // and must be swallowed. Startup must not depend on it.
    expect(() => startLicenseHeartbeat()).not.toThrow()
    expect(() => startLicenseHeartbeat()).not.toThrow() // idempotent
    // Trigger the graceful-shutdown path so the interval doesn't keep the
    // test process alive.
    process.emit('SIGTERM' as any)
  })
})
