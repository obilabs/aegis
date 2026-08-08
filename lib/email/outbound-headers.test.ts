import { describe, expect, it } from 'vitest'
import { buildOutboundHeaders } from './outbound-headers'
import type { SigningKeys } from './signing'

const KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
const KEYS: SigningKeys = { currentKey: KEY, previousKey: null }

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const TICKET = '22222222-2222-4222-8222-222222222222'
const REPLY = '33333333-3333-4333-8333-333333333333'

function defaultArgs() {
  return {
    instanceUuid: INSTANCE,
    ticketId: TICKET,
    replyId: REPLY,
    messageIdHost: 'aegis.example.com',
    signingKeys: KEYS,
    parentMessageId: null,
    threadReferences: [],
    ticketPrefix: 'TKT',
    ticketNumber: 12345,
    originalSubject: 'Login problem',
    replyAddress: 'replies@aegis.example.com',
    origin: 'human_reply' as const,
  }
}

describe('buildOutboundHeaders — Message-ID', () => {
  it('produces a signed Message-ID at the configured host', () => {
    const h = buildOutboundHeaders(defaultArgs())
    expect(h.messageId).toMatch(
      new RegExp(
        `^aegis-${INSTANCE}-${TICKET}-${REPLY}-[0-9a-f]{24}@aegis\\.example\\.com$`,
      ),
    )
  })
})

describe('buildOutboundHeaders — subject normalization', () => {
  it('prepends `Re: [PREFIX-NUMBER] ` when subject has no token', () => {
    const h = buildOutboundHeaders(defaultArgs())
    expect(h.subject).toBe('Re: [TKT-12345] Login problem')
  })

  it('uses the ticket prefix verbatim, NOT a hardcoded AEGIS', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      ticketPrefix: 'INC',
      ticketNumber: 42,
      originalSubject: 'Disk full',
    })
    expect(h.subject).toBe('Re: [INC-42] Disk full')
    expect(h.subject).not.toContain('AEGIS')
  })

  it('strips a leading Re:/Fwd: from the original subject before prefixing', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      originalSubject: 'Re: Login problem',
    })
    expect(h.subject).toBe('Re: [TKT-12345] Login problem')
  })

  it('does not double-prefix when the token is already present', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      originalSubject: 'Re: [TKT-12345] Login problem',
    })
    expect(h.subject).not.toMatch(/\[TKT-12345\].*\[TKT-12345\]/)
  })
})

describe('buildOutboundHeaders — In-Reply-To', () => {
  it('null when there is no parent', () => {
    const h = buildOutboundHeaders(defaultArgs())
    expect(h.inReplyTo).toBeNull()
  })

  it('wraps a bare parent ID in angle brackets', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      parentMessageId: 'parent@example.com',
    })
    expect(h.inReplyTo).toBe('<parent@example.com>')
  })

  it('preserves existing angle brackets', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      parentMessageId: '<parent@example.com>',
    })
    expect(h.inReplyTo).toBe('<parent@example.com>')
  })
})

describe('buildOutboundHeaders — References', () => {
  it('null when chain is empty and no parent', () => {
    const h = buildOutboundHeaders(defaultArgs())
    expect(h.references).toBeNull()
  })

  it('joins chain entries (de-duped) with the parent appended last', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      threadReferences: ['<a@x>', '<b@x>', '<a@x>'],
      parentMessageId: '<c@x>',
    })
    expect(h.references).toBe('<a@x> <b@x> <c@x>')
  })

  it('wraps bare IDs in angle brackets', () => {
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      threadReferences: ['a@x', 'b@x'],
      parentMessageId: 'c@x',
    })
    expect(h.references).toBe('<a@x> <b@x> <c@x>')
  })

  it('trims at 30KB retaining root + tail', () => {
    // Build a chain that exceeds 30KB.
    const big: string[] = []
    for (let i = 0; i < 2000; i++) {
      big.push(`<msg-${i}@x>`)
    }
    const h = buildOutboundHeaders({
      ...defaultArgs(),
      threadReferences: big,
      parentMessageId: '<final@x>',
    })
    expect(h.references).not.toBeNull()
    expect(Buffer.byteLength(h.references!, 'utf8')).toBeLessThanOrEqual(30_000)
    // Root preserved
    expect(h.references!).toMatch(/^<msg-0@x>/)
    // Tail (final parent) preserved
    expect(h.references!).toContain('<final@x>')
  })
})

describe('buildOutboundHeaders — scope-aware protective headers (D28e)', () => {
  it('auto_notification → full set including Precedence: bulk', () => {
    const h = buildOutboundHeaders({ ...defaultArgs(), origin: 'auto_notification' })
    expect(h.extraHeaders['Auto-Submitted']).toBe('auto-generated')
    expect(h.extraHeaders['X-Auto-Response-Suppress']).toBe('All')
    expect(h.extraHeaders['Precedence']).toBe('bulk')
    expect(h.extraHeaders['X-Loop']).toBe('replies@aegis.example.com')
  })

  it('ai_reply → Auto-Submitted only, no Precedence: bulk (delivery on M365 EOP)', () => {
    const h = buildOutboundHeaders({ ...defaultArgs(), origin: 'ai_reply' })
    expect(h.extraHeaders['Auto-Submitted']).toBe('auto-generated')
    expect(h.extraHeaders['X-Loop']).toBe('replies@aegis.example.com')
    expect(h.extraHeaders['Precedence']).toBeUndefined()
    expect(h.extraHeaders['X-Auto-Response-Suppress']).toBeUndefined()
  })

  it('human_reply → only X-Loop, no Auto-Submitted, no Precedence: bulk', () => {
    const h = buildOutboundHeaders({ ...defaultArgs(), origin: 'human_reply' })
    expect(h.extraHeaders['X-Loop']).toBe('replies@aegis.example.com')
    expect(h.extraHeaders['Auto-Submitted']).toBeUndefined()
    expect(h.extraHeaders['Precedence']).toBeUndefined()
    expect(h.extraHeaders['X-Auto-Response-Suppress']).toBeUndefined()
  })
})
