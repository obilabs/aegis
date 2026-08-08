import { describe, expect, it } from 'vitest'
import { bodyPreview } from './text-utils'

describe('bodyPreview', () => {
  it('returns null when body is null', () => {
    expect(bodyPreview(null)).toBeNull()
  })

  it('returns null when body is undefined', () => {
    expect(bodyPreview(undefined)).toBeNull()
  })

  it('passes short bodies through unchanged', () => {
    const short = "Users report Outlook won't connect"
    expect(bodyPreview(short)).toBe(short)
  })

  it('truncates long bodies to 200 chars with ellipsis', () => {
    const long = 'A'.repeat(250)
    const result = bodyPreview(long)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(201)
    expect(result!.endsWith('…')).toBe(true)
  })

  it('does not truncate at exactly 200 chars', () => {
    const exact = 'A'.repeat(200)
    expect(bodyPreview(exact)).toBe(exact)
  })

  it('redacts email addresses', () => {
    expect(bodyPreview('Contact alice@acme.com for help')).toBe(
      'Contact ***@*** for help',
    )
  })

  it('redacts multiple emails', () => {
    expect(
      bodyPreview('Ping alice@acme.com or bob@example.co.uk'),
    ).toBe('Ping ***@*** or ***@***')
  })

  it('redacts NANP phone numbers with dashes', () => {
    expect(bodyPreview('Call 780-555-1234 asap')).toBe(
      'Call ***-***-**** asap',
    )
  })

  it('redacts phone numbers with parens', () => {
    expect(bodyPreview('Ring (780) 555-1234')).toBe(
      'Ring ***-***-****',
    )
  })

  it('does not redact bare ticket-number-like digit runs', () => {
    expect(bodyPreview('See ticket #4231 for context')).toBe(
      'See ticket #4231 for context',
    )
  })

  it('strips HTML tags', () => {
    expect(bodyPreview('<p>Users report <b>Outlook</b> down</p>')).toBe(
      'Users report Outlook down',
    )
  })

  it('collapses whitespace after tag stripping', () => {
    expect(
      bodyPreview('<div>Line 1</div>\n\n<div>Line 2</div>'),
    ).toBe('Line 1 Line 2')
  })

  it('handles mixed content: HTML + email + phone', () => {
    expect(
      bodyPreview(
        '<p>Reach out to alice@acme.com or 780-555-1234 for details</p>',
      ),
    ).toBe('Reach out to ***@*** or ***-***-**** for details')
  })

  it('handles empty string as empty', () => {
    expect(bodyPreview('')).toBe('')
  })
})
