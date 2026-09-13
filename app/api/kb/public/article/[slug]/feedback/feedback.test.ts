import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const inserts: unknown[][] = []
vi.mock('@/lib/db', () => ({
  pool: {
    query: async (sql: string, params: unknown[]) => {
      if (/SELECT id FROM kb_articles/.test(sql)) return { rows: [{ id: 'art-1' }] }
      if (/SELECT id FROM kb_article_feedback/.test(sql)) return { rows: [] }
      if (/INSERT INTO kb_article_feedback/.test(sql)) inserts.push(params)
      return { rows: [] }
    },
  },
}))
vi.mock('@/lib/org', () => ({ getOrgId: async () => 'org-1' }))

const { POST } = await import('./route')

let ipSeq = 0
function send(body: unknown, ip = `198.51.100.${++ipSeq}`) {
  const req = new NextRequest('http://localhost/api/kb/public/article/vpn/feedback', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-real-ip': ip, 'user-agent': `ua-${Math.random()}` },
  })
  return POST(req, { params: Promise.resolve({ slug: 'vpn' }) })
}

beforeEach(() => {
  inserts.length = 0
})

describe('POST /api/kb/public/article/[slug]/feedback', () => {
  it('accepts valid feedback', async () => {
    const res = await send({ is_helpful: true, feedback_text: 'Clear steps' })
    expect(res.status).toBe(200)
    expect(inserts).toHaveLength(1)
  })

  it('rejects over-long feedback text', async () => {
    const res = await send({ is_helpful: false, feedback_text: 'x'.repeat(2001) })
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('rejects an over-long category', async () => {
    const res = await send({ is_helpful: false, feedback_category: 'c'.repeat(51) })
    expect(res.status).toBe(400)
  })

  it('rejects a missing / non-boolean is_helpful and malformed JSON', async () => {
    expect((await send({ feedback_text: 'hi' })).status).toBe(400)
    expect((await send({ is_helpful: 'yes' })).status).toBe(400)
    expect((await send('{not json')).status).toBe(400)
  })

  it('rate-limits a single IP', async () => {
    const ip = '203.0.113.77'
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) statuses.push((await send({ is_helpful: true }, ip)).status)
    expect(statuses.slice(0, 20).every((s) => s !== 429)).toBe(true)
    expect(statuses.slice(20).every((s) => s === 429)).toBe(true)
    // Another IP is unaffected.
    expect((await send({ is_helpful: true }, '203.0.113.78')).status).toBe(200)
  })
})
