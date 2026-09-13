import { describe, expect, it } from 'vitest'
import { toSafeHtml } from './article-render'

describe('toSafeHtml — rich-text sanitizer', () => {
  const cases: Array<[string, string, string[]]> = [
    ['img onerror', '<p>hi</p><img src=x onerror="alert(1)">', ['onerror', 'alert(1)']],
    ['script tag', '<p>hi</p><script>alert(document.cookie)</script>', ['<script', 'document.cookie']],
    ['javascript: href', '<a href="javascript:alert(1)">click</a>', ['javascript:']],
    ['mixed-case javascript: href', '<a href="JaVaScRiPt:alert(1)">click</a>', ['javascript:']],
    ['iframe', '<iframe src="https://example.com"></iframe><p>after</p>', ['<iframe']],
    ['inline handler on div', '<div onclick="alert(1)">x</div>', ['onclick']],
  ]

  for (const [name, input, banned] of cases) {
    it(`strips ${name}`, () => {
      const out = toSafeHtml(input).toLowerCase()
      for (const b of banned) expect(out).not.toContain(b.toLowerCase())
    })
  }

  it('keeps ordinary formatting and safe links', () => {
    const out = toSafeHtml('<p><strong>Printer</strong> is <a href="https://example.com">down</a></p>')
    expect(out).toContain('<strong>Printer</strong>')
    expect(out).toContain('href="https://example.com"')
  })

  it('keeps link text when stripping a javascript: href', () => {
    expect(toSafeHtml('<a href="javascript:alert(1)">click</a>')).toContain('click')
  })

  it('returns empty string for null / empty input', () => {
    expect(toSafeHtml(null)).toBe('')
    expect(toSafeHtml(undefined)).toBe('')
    expect(toSafeHtml('')).toBe('')
  })

  it('is idempotent (safe to apply on write and again at render)', () => {
    const once = toSafeHtml('<p>a</p><img src=x onerror=alert(1)><a href="https://e.x">l</a>')
    expect(toSafeHtml(once)).toBe(once)
  })

  it('renders markdown then sanitizes', () => {
    const out = toSafeHtml('**bold** <script>alert(1)</script>', 'markdown')
    expect(out).toContain('<strong>bold</strong>')
    expect(out.toLowerCase()).not.toContain('<script')
  })
})
