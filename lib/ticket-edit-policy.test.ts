import { describe, expect, it } from 'vitest'
import { decideReply, decideTicketEdit } from '@/lib/ticket-edit-policy'

describe('decideTicketEdit', () => {
  const base = { canTriage: false, ticketAccess: 'team' as const, inScope: true, changesAssignment: false }

  it('lets triage make any edit, assignment included, in or out of scope', () => {
    expect(decideTicketEdit({ ...base, canTriage: true, changesAssignment: true, inScope: false })).toEqual({ ok: true })
  })

  it('lets a technician work (status, priority, resolution) a ticket in their scope', () => {
    expect(decideTicketEdit(base)).toEqual({ ok: true })
    expect(decideTicketEdit({ ...base, ticketAccess: 'all' })).toEqual({ ok: true })
  })

  it('keeps reassignment a triage action', () => {
    expect(decideTicketEdit({ ...base, changesAssignment: true })).toMatchObject({ ok: false, status: 403 })
  })

  it('hides tickets outside the technician scope', () => {
    expect(decideTicketEdit({ ...base, inScope: false })).toMatchObject({ ok: false, status: 404 })
  })

  it('never lets an end user edit a ticket, even their own', () => {
    expect(decideTicketEdit({ ...base, ticketAccess: 'own' })).toMatchObject({ ok: false, status: 403 })
  })
})

describe('decideReply', () => {
  const base = { adminAccess: false, ticketAccess: 'own' as const, inScope: true, isInternal: false }

  it('lets an end user reply publicly to a ticket they can see', () => {
    expect(decideReply(base)).toEqual({ ok: true })
  })

  it('refuses replies to tickets outside the caller scope as not found', () => {
    expect(decideReply({ ...base, inScope: false })).toMatchObject({ ok: false, status: 404 })
  })

  it('keeps internal notes staff-only', () => {
    expect(decideReply({ ...base, isInternal: true })).toMatchObject({ ok: false, status: 403 })
    expect(decideReply({ ...base, isInternal: true, ticketAccess: 'team' })).toEqual({ ok: true })
    expect(decideReply({ ...base, isInternal: true, adminAccess: true, inScope: false })).toEqual({ ok: true })
  })
})
