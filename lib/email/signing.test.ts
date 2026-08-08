import { describe, expect, it } from 'vitest'
import {
  buildSignedMessageId,
  resolveSigningKeysFromEnv,
  verifyMessageId,
  type SigningKeys,
} from './signing'

const KEY_A = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
const KEY_B = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100'

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const TICKET = '22222222-2222-4222-8222-222222222222'
const REPLY = '33333333-3333-4333-8333-333333333333'
const HOST = 'aegis.example.com'

const KEYS_CURRENT_ONLY: SigningKeys = { currentKey: KEY_A, previousKey: null }
const KEYS_BOTH: SigningKeys = { currentKey: KEY_A, previousKey: KEY_B }
const KEYS_ROTATED: SigningKeys = { currentKey: KEY_B, previousKey: KEY_A }

describe('buildSignedMessageId', () => {
  it('produces the documented format aegis-{instance}-{ticket}-{reply}-{24hex}@{host}', () => {
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    expect(mid).toMatch(
      new RegExp(
        `^aegis-${INSTANCE}-${TICKET}-${REPLY}-[0-9a-f]{24}@${HOST.replace('.', '\\.')}$`,
      ),
    )
  })

  it('is deterministic for the same inputs + key', () => {
    const a = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    const b = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    expect(a).toBe(b)
  })

  it('different inputs produce different signatures', () => {
    const base = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    const otherTicket = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: '99999999-9999-4999-8999-999999999999',
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    expect(base).not.toBe(otherTicket)
  })
})

describe('verifyMessageId — happy path', () => {
  it('round-trips a freshly built Message-ID', () => {
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    const result = verifyMessageId(mid, KEYS_CURRENT_ONLY)
    expect(result.signed).toBe(true)
    if (result.signed) {
      expect(result.instanceUuid).toBe(INSTANCE)
      expect(result.ticketId).toBe(TICKET)
      expect(result.replyId).toBe(REPLY)
      expect(result.host).toBe(HOST)
      expect(result.signedByPreviousKey).toBe(false)
    }
  })

  it('strips angle brackets transparently', () => {
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    const result = verifyMessageId(`<${mid}>`, KEYS_CURRENT_ONLY)
    expect(result.signed).toBe(true)
  })
})

describe('verifyMessageId — failure modes', () => {
  it('returns signed:false for non-Aegis-format strings', () => {
    const r = verifyMessageId('<random@example.com>', KEYS_CURRENT_ONLY)
    expect(r.signed).toBe(false)
    if (!r.signed) {
      expect(r.structurallyAegis).toBe(false)
    }
  })

  it('rejects a tampered signature (right format, wrong hex)', () => {
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    // Flip the last hex char of the HMAC tag.
    const tampered = mid.replace(/([0-9a-f])(@[^@]+)$/, (_, last, tail) => {
      const flipped = last === 'f' ? '0' : 'f'
      return flipped + tail
    })
    const r = verifyMessageId(tampered, KEYS_CURRENT_ONLY)
    expect(r.signed).toBe(false)
    if (!r.signed) {
      // Looked like our format → tells caller not to fall through to legacy path.
      expect(r.structurallyAegis).toBe(true)
    }
  })

  it('rejects a Message-ID signed under a different key', () => {
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: { currentKey: KEY_B, previousKey: null },
    })
    const r = verifyMessageId(mid, KEYS_CURRENT_ONLY) // we have KEY_A
    expect(r.signed).toBe(false)
  })

  it('returns signed:false on malformed (too few components)', () => {
    const r = verifyMessageId('aegis-not-a-uuid@host', KEYS_CURRENT_ONLY)
    expect(r.signed).toBe(false)
  })
})

describe('verifyMessageId — D28h dual-key fallback', () => {
  it('still verifies under the previous key during a rotation window', () => {
    // Sign under the OLD key (KEY_B is old once we rotate).
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: { currentKey: KEY_A, previousKey: null },
    })
    // Now rotate: current = KEY_B, previous = KEY_A.
    const r = verifyMessageId(mid, KEYS_ROTATED)
    expect(r.signed).toBe(true)
    if (r.signed) {
      expect(r.signedByPreviousKey).toBe(true)
    }
  })

  it('current-key match takes precedence over previous-key match', () => {
    // Sign under CURRENT key.
    const mid = buildSignedMessageId({
      instanceUuid: INSTANCE,
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_BOTH,
    })
    const r = verifyMessageId(mid, KEYS_BOTH)
    expect(r.signed).toBe(true)
    if (r.signed) {
      expect(r.signedByPreviousKey).toBe(false)
    }
  })
})

describe('verifyMessageId — instance UUID surfaces in result', () => {
  it('returns the embedded instance_uuid (caller compares to its own)', () => {
    // Different instance signs a Message-ID with same key (compromised key
    // scenario, or two installs share keys via misconfiguration).
    const mid = buildSignedMessageId({
      instanceUuid: '99999999-9999-4999-8999-999999999999',
      ticketId: TICKET,
      replyId: REPLY,
      host: HOST,
      keys: KEYS_CURRENT_ONLY,
    })
    const r = verifyMessageId(mid, KEYS_CURRENT_ONLY)
    expect(r.signed).toBe(true)
    if (r.signed) {
      // Caller (threading.ts Step 2) compares this to ctx.instanceUuid and
      // routes to 'reject_foreign_instance'. The verifier itself just
      // surfaces the field.
      expect(r.instanceUuid).toBe('99999999-9999-4999-8999-999999999999')
    }
  })
})

describe('resolveSigningKeysFromEnv', () => {
  it('throws when neither AEGIS_SECRETS_KEY_FILE nor AEGIS_SECRETS_KEY is set', () => {
    expect(() => resolveSigningKeysFromEnv({} as NodeJS.ProcessEnv)).toThrow(
      /AEGIS_SECRETS_KEY missing/,
    )
  })

  it('reads the bare env var when no FILE is set', () => {
    const keys = resolveSigningKeysFromEnv({ AEGIS_SECRETS_KEY: KEY_A } as unknown as NodeJS.ProcessEnv)
    expect(keys.currentKey).toBe(KEY_A)
    expect(keys.previousKey).toBeNull()
  })

  it('reads the previous-key env var alongside the current', () => {
    const keys = resolveSigningKeysFromEnv({
      AEGIS_SECRETS_KEY: KEY_A,
      AEGIS_SECRETS_KEY_PREVIOUS: KEY_B,
    } as unknown as NodeJS.ProcessEnv)
    expect(keys.currentKey).toBe(KEY_A)
    expect(keys.previousKey).toBe(KEY_B)
  })
})
