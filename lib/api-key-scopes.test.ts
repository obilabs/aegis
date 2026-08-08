/**
 * Tests for intersectScopes — pure function, no DB.
 *
 * userMaxScopes and personalKeysForUser hit the database and are covered
 * by integration tests (Section 12.1 in tasks.md). Here we cover the
 * scope-capping math because that's where the security boundary lives.
 */

import { describe, expect, it } from 'vitest'
import { intersectScopes, PERSONAL_KEY_QUOTA } from './api-key-scopes'

describe('intersectScopes', () => {
  it('returns only scopes the user has', () => {
    const result = intersectScopes(
      ['tickets:read', 'users:write'],
      ['tickets:read'],
    )
    expect(result.granted).toEqual(['tickets:read'])
    expect(result.dropped).toEqual(['users:write'])
  })

  it('returns everything requested when user has admin:full', () => {
    const result = intersectScopes(
      ['tickets:read', 'tickets:write', 'users:delete'],
      ['admin:full'],
    )
    expect(result.granted).toEqual(['tickets:read', 'tickets:write', 'users:delete'])
    expect(result.dropped).toEqual([])
  })

  it('returns empty granted when user has no relevant scopes', () => {
    const result = intersectScopes(
      ['tickets:write'],
      ['kb:read'],
    )
    expect(result.granted).toEqual([])
    expect(result.dropped).toEqual(['tickets:write'])
  })

  it('handles empty requested list', () => {
    const result = intersectScopes([], ['tickets:read'])
    expect(result.granted).toEqual([])
    expect(result.dropped).toEqual([])
  })

  it('handles empty allowed list', () => {
    const result = intersectScopes(['tickets:read'], [])
    expect(result.granted).toEqual([])
    expect(result.dropped).toEqual(['tickets:read'])
  })

  it('preserves order of requested scopes in granted output', () => {
    const result = intersectScopes(
      ['users:write', 'tickets:read', 'kb:read'],
      ['kb:read', 'tickets:read', 'users:write'],
    )
    // Order preserved from the requested array
    expect(result.granted).toEqual(['users:write', 'tickets:read', 'kb:read'])
  })

  it('does not deduplicate within granted (caller responsibility)', () => {
    const result = intersectScopes(
      ['tickets:read', 'tickets:read'],
      ['tickets:read'],
    )
    expect(result.granted).toEqual(['tickets:read', 'tickets:read'])
  })
})

describe('PERSONAL_KEY_QUOTA', () => {
  it('is 5 (matches design D4)', () => {
    expect(PERSONAL_KEY_QUOTA).toBe(5)
  })
})
