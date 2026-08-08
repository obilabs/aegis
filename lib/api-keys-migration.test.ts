/**
 * Translation helper tests — fixed mapping, pass-through, warnings.
 */

import { describe, expect, it } from 'vitest'
import { translateLegacyPermissions, LEGACY_TO_CANONICAL } from './api-keys-migration'

describe('translateLegacyPermissions', () => {
  it('maps all four legacy strings to their canonical scopes', () => {
    const result = translateLegacyPermissions([
      'ai_chat', 'kb_search', 'ticket_read', 'ticket_create',
    ])
    expect(result.scopes).toEqual([
      'ai:chat', 'kb:read', 'tickets:read', 'tickets:write',
    ].sort())
    expect(result.warnings).toEqual([])
  })

  it('passes through already-canonical scope strings', () => {
    const result = translateLegacyPermissions([
      'tickets:read', 'assets:write', 'kb:delete', 'admin:full',
    ])
    expect(result.scopes).toEqual([
      'admin:full', 'assets:write', 'kb:delete', 'tickets:read',
    ])
    expect(result.warnings).toEqual([])
  })

  it('handles mixed legacy + canonical input without duplicates', () => {
    const result = translateLegacyPermissions([
      'ticket_read', 'tickets:read', 'kb_search', 'kb:read',
    ])
    expect(result.scopes).toEqual(['kb:read', 'tickets:read'])
    expect(result.warnings).toEqual([])
  })

  it('surfaces unknown strings as warnings and drops them from scopes', () => {
    const result = translateLegacyPermissions([
      'tickets:read', 'unknown-thing', 'fake:scope',
    ])
    expect(result.scopes).toEqual(['tickets:read'])
    expect(result.warnings).toEqual(['unknown-thing', 'fake:scope'])
  })

  it('returns empty result for empty input', () => {
    expect(translateLegacyPermissions([])).toEqual({ scopes: [], warnings: [] })
  })

  it('returns empty result for non-array input', () => {
    expect(translateLegacyPermissions(null)).toEqual({ scopes: [], warnings: [] })
    expect(translateLegacyPermissions({} as unknown)).toEqual({ scopes: [], warnings: [] })
    expect(translateLegacyPermissions('ticket_read' as unknown)).toEqual({ scopes: [], warnings: [] })
  })

  it('coerces non-string elements into warnings', () => {
    const result = translateLegacyPermissions(['ticket_read', 42 as unknown, null as unknown])
    expect(result.scopes).toEqual(['tickets:read'])
    expect(result.warnings).toEqual(['42', 'null'])
  })

  it('trims whitespace from input strings', () => {
    const result = translateLegacyPermissions(['  ticket_read  ', '\nai_chat\n'])
    expect(result.scopes).toEqual(['ai:chat', 'tickets:read'])
    expect(result.warnings).toEqual([])
  })

  it('drops empty strings without warning', () => {
    const result = translateLegacyPermissions(['', 'ticket_read', '   '])
    expect(result.scopes).toEqual(['tickets:read'])
    expect(result.warnings).toEqual([])
  })

  it('exposes the LEGACY_TO_CANONICAL mapping for inspection', () => {
    expect(LEGACY_TO_CANONICAL).toEqual({
      ai_chat: 'ai:chat',
      kb_search: 'kb:read',
      ticket_read: 'tickets:read',
      ticket_create: 'tickets:write',
    })
  })
})
