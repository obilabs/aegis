import { describe, expect, it } from 'vitest'
import { keyTypeAllowedOnPath } from './key-type-paths'

describe('keyTypeAllowedOnPath (C4 pairing-key path scope)', () => {
  it('confines an aegis-mtp-pairing key to /api/v1/mtp/*', () => {
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/mtp/tickets')).toBe(true)
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/mtp/tickets/abc')).toBe(true)
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/mtp/handshake')).toBe(true)
  })

  it('rejects an aegis-mtp-pairing key on any non-MTP path', () => {
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/tickets')).toBe(false)
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/contacts')).toBe(false)
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/assets')).toBe(false)
    // Must not be fooled by a lookalike prefix.
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/mtptickets')).toBe(false)
    expect(keyTypeAllowedOnPath('aegis-mtp-pairing', '/api/v1/mtp')).toBe(false)
  })

  it('does not restrict other key types', () => {
    for (const kt of ['personal', 'mtp-polling', 'delegated-write', 'standard']) {
      expect(keyTypeAllowedOnPath(kt, '/api/v1/tickets')).toBe(true)
      expect(keyTypeAllowedOnPath(kt, '/api/v1/mtp/tickets')).toBe(true)
    }
  })

  it('treats undefined / unknown key types as unrestricted', () => {
    expect(keyTypeAllowedOnPath(undefined, '/api/v1/tickets')).toBe(true)
    expect(keyTypeAllowedOnPath('something-new', '/api/v1/tickets')).toBe(true)
  })
})
