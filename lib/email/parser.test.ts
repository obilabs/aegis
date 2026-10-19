/**
 * parseEmail() tests, with the address-header cost tests as the point.
 *
 * `parseEmail` hands raw inbound bytes to mailparser's `simpleParser`, which
 * parses every address header with nodemailer's addressparser. That parse has
 * repeatedly been super-linear in the length of one header value, and it is
 * synchronous — so a slow parse blocks the poller's event loop rather than
 * just delaying one message. These tests pin the cost down at the parser
 * boundary (the poller itself needs a live IMAP server, so it is not
 * exercised here).
 *
 * The pathological shape is a long run of non-whitespace characters carrying a
 * word boundary at every position. The boundaries are what make it expensive:
 * a run of identical letters has only two, so the regex had only two start
 * offsets to try and stayed fast. `[x]` repeated gives one per character.
 */

import { describe, it, expect } from 'vitest'
import {
  parseEmail,
  headerSectionBytes,
  extractSubjectToken,
  MAX_HEADER_SECTION_BYTES,
} from './parser'

/** A realistically shaped inbound message with one header value substituted. */
function inboundMessage(header: string, value: string): Buffer {
  return Buffer.from(
    'Return-Path: <bounce@example.net>\r\n' +
      'Received: from mx.example.net by imap.local; Mon, 19 Oct 2026 10:00:00 +0000\r\n' +
      `${header}: ${value}\r\n` +
      (header === 'From' ? '' : 'From: Real Person <real@example.com>\r\n') +
      (header === 'To' ? '' : 'To: support@example.com\r\n') +
      'Subject: [SUP-1234] printer is jammed again\r\n' +
      'Message-ID: <abc123@example.net>\r\n' +
      'Date: Mon, 19 Oct 2026 10:00:00 +0000\r\n' +
      'MIME-Version: 1.0\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      '\r\n' +
      'The printer is jammed again.\r\n',
    'utf8',
  )
}

/** Word-boundary-dense run; see the file header for why this shape. */
const pathological = (n: number) => '[x]'.repeat(n)

describe('parseEmail — ordinary messages', () => {
  it('parses a normal inbound message', async () => {
    const parsed = await parseEmail(
      inboundMessage('From', 'Real Person <real@example.com>'),
    )
    expect(parsed.fromAddress).toBe('real@example.com')
    expect(parsed.fromName).toBe('Real Person')
    expect(parsed.toAddresses).toEqual(['support@example.com'])
    expect(parsed.subject).toBe('[SUP-1234] printer is jammed again')
    expect(parsed.messageId).toBe('<abc123@example.net>')
    expect(parsed.text?.trim()).toBe('The printer is jammed again.')
  })

  it('indexes headers lowercase', async () => {
    const parsed = await parseEmail(
      inboundMessage('From', 'Real Person <real@example.com>'),
    )
    expect(parsed.headers['message-id']).toBeDefined()
    expect(parsed.headers['subject']).toBe('[SUP-1234] printer is jammed again')
  })
})

describe('parseEmail — address-header parse cost', () => {
  // The cost was quadratic up to and including nodemailer 9.1.1: n=20000 took
  // roughly 6 s and n=40000 roughly 24 s through this exact call. Linear-time
  // addressparser lands in 10.0.6+, where the same inputs finish in ~15 ms.
  // The ceiling is deliberately loose (2 s) so the test fails on a return of
  // the quadratic behaviour, not on a slow CI runner.
  const CEILING_MS = 2000

  for (const header of ['From', 'To', 'Cc', 'Reply-To']) {
    it(`parses a 40k-run ${header} header in well under ${CEILING_MS}ms`, async () => {
      const raw = inboundMessage(header, pathological(40000))
      // Stays under the pre-parse header bound, so this really does reach
      // addressparser rather than being refused by the guard.
      expect(headerSectionBytes(raw)).toBeLessThan(MAX_HEADER_SECTION_BYTES)

      const started = performance.now()
      const parsed = await parseEmail(raw)
      const elapsed = performance.now() - started

      expect(elapsed).toBeLessThan(CEILING_MS)
      // And it still parsed: the rest of the message survives the junk header.
      expect(parsed.subject).toBe('[SUP-1234] printer is jammed again')
    })
  }

  it('scales roughly linearly rather than quadratically in run length', async () => {
    const time = async (n: number) => {
      const raw = inboundMessage('From', pathological(n))
      const started = performance.now()
      await parseEmail(raw)
      return performance.now() - started
    }
    // Warm the parser so the first-call cost does not land on the 10k sample.
    await time(1000)
    const small = await time(10000)
    const large = await time(40000)

    // 4x the input. Quadratic would be ~16x; linear ~4x. A ceiling of 8x
    // catches the quadratic return while tolerating timer noise on small
    // absolute numbers.
    const floor = Math.max(small, 1)
    expect(large / floor).toBeLessThan(8)
  })

  it('a message with every address header poisoned still parses quickly', async () => {
    const junk = pathological(10000)
    const raw = Buffer.from(
      `From: ${junk}\r\nTo: ${junk}\r\nCc: ${junk}\r\nReply-To: ${junk}\r\n` +
        'Subject: [SUP-1234] printer is jammed again\r\n' +
        'Message-ID: <abc123@example.net>\r\n\r\nbody\r\n',
      'utf8',
    )
    const started = performance.now()
    await parseEmail(raw)
    expect(performance.now() - started).toBeLessThan(CEILING_MS)
  })
})

describe('headerSectionBytes / MAX_HEADER_SECTION_BYTES', () => {
  it('measures up to the CRLF CRLF separator, excluding the body', () => {
    const raw = Buffer.from('From: a@b.com\r\n\r\n' + 'x'.repeat(5000), 'utf8')
    // The separator offset, i.e. the header text without its final CRLF.
    expect(headerSectionBytes(raw)).toBe('From: a@b.com'.length)
  })

  it('tolerates a bare LF LF separator from a lax sender', () => {
    const raw = Buffer.from('From: a@b.com\n\n' + 'x'.repeat(5000), 'utf8')
    expect(headerSectionBytes(raw)).toBe('From: a@b.com'.length)
  })

  it('falls back to the whole length when there is no separator', () => {
    const raw = Buffer.from('From: a@b.com\r\n', 'utf8')
    expect(headerSectionBytes(raw)).toBe(raw.length)
  })

  it('counts bytes, not UTF-16 code units', () => {
    // U+00E9 is two bytes in UTF-8 but one JS character, so this 4-character
    // header measures 5 bytes.
    const headerText = 'X: é'
    const raw = Buffer.from(headerText + '\r\n\r\nbody', 'utf8')
    expect(headerText.length).toBe(4)
    expect(headerSectionBytes(raw)).toBe(5)
  })

  it('refuses an over-long header section before parsing it', async () => {
    const huge = Buffer.from(
      `From: ${'[x]'.repeat(100000)}\r\n\r\nbody\r\n`,
      'utf8',
    )
    expect(headerSectionBytes(huge)).toBeGreaterThan(MAX_HEADER_SECTION_BYTES)
    // Rejected fast, and as a throw the poller already maps to failed_parse.
    const started = performance.now()
    await expect(parseEmail(huge)).rejects.toThrow(/header section/)
    expect(performance.now() - started).toBeLessThan(500)
  })

  it('admits a large but legitimate header section', async () => {
    const manyCc = Array.from(
      { length: 400 },
      (_, i) => `user${i}@example.com`,
    ).join(', ')
    const raw = inboundMessage('Cc', manyCc)
    expect(headerSectionBytes(raw)).toBeLessThan(MAX_HEADER_SECTION_BYTES)
    const parsed = await parseEmail(raw)
    expect(parsed.ccAddresses).toHaveLength(400)
  })
})

describe('extractSubjectToken', () => {
  it('pulls the ticket token out of a decoded subject', () => {
    expect(extractSubjectToken('[SUP-1234] printer jammed')).toEqual({
      prefix: 'SUP',
      number: 1234,
    })
  })

  it('returns null for a subject with no token', () => {
    expect(extractSubjectToken('printer jammed')).toBeNull()
    expect(extractSubjectToken(null)).toBeNull()
  })

  it('rejects a zero or non-positive ticket number', () => {
    expect(extractSubjectToken('[SUP-0] x')).toBeNull()
  })
})
