import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ pool: { query: vi.fn() } }))
vi.mock('@/lib/queue', () => ({ getQueue: vi.fn() }))

const { emailBodyForStorage } = await import('./poller')

describe('emailBodyForStorage', () => {
  it('prefers the text part untouched', () => {
    expect(emailBodyForStorage({ text: 'a < b', html: '<p>x</p>' })).toBe('a < b')
  })

  it('sanitizes an HTML-only body', () => {
    const out = emailBodyForStorage({
      text: null,
      html: '<p>Hello</p><img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">l</a>',
    }).toLowerCase()
    expect(out).toContain('<p>hello</p>')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('javascript:')
  })

  it('returns empty string when neither part exists', () => {
    expect(emailBodyForStorage({ text: null, html: null })).toBe('')
  })
})
