import { describe, expect, it } from 'vitest'
import { attachmentDisposition, buildTicketKey } from '@/lib/storage'

describe('ticket attachment storage helpers', () => {
  it('keeps ticket keys inside the org/ticket prefix whatever the file name', () => {
    const key = buildTicketKey('org-1', 'ticket-1', '../../etc/pass wd?.txt')
    expect(key.startsWith('org-1/tickets/ticket-1/')).toBe(true)
    const name = key.slice('org-1/tickets/ticket-1/'.length)
    expect(name).not.toContain('/')
    expect(name).toMatch(/^\d+-[a-zA-Z0-9._-]+$/)
  })

  it('builds a Content-Disposition that a quote or non-ASCII name cannot break', () => {
    const header = attachmentDisposition('re"porté.pdf')
    expect(header).toBe(`attachment; filename="re_port_.pdf"; filename*=UTF-8''re%22port%C3%A9.pdf`)
    expect(header).not.toMatch(/[\r\n]/)
  })
})
