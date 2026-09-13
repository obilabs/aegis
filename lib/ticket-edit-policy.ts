/**
 * Who may change a ticket, and how.
 *
 * - Triage (or admin) may make any edit, including (re)assignment.
 * - Staff whose role sees tickets beyond their own (ticket_access team/all) may
 *   work a ticket that is inside that scope: status, priority, category,
 *   subject, description and resolution fields. Reassigning stays a triage
 *   action (same gate as POST .../assign).
 * - End users (ticket_access "own") do not edit tickets; they reply.
 * - A ticket outside the caller's scope reads as not found.
 *
 * Replies: only to tickets inside the caller's scope, and internal notes are
 * staff-only.
 *
 * Pure functions so the policy is unit-tested directly (ticket-edit-policy.test.ts);
 * the routes resolve the facts and call them.
 */

import type { TicketAccess } from '@/lib/permissions'

export type TicketDecision = { ok: true } | { ok: false; status: 403 | 404; error: string }

const ALLOW: TicketDecision = { ok: true }
const NOT_FOUND: TicketDecision = { ok: false, status: 404, error: 'Ticket not found' }

export function decideTicketEdit(input: {
  canTriage: boolean
  ticketAccess: TicketAccess
  /** the ticket is visible under the caller's ticket_access scope */
  inScope: boolean
  /** assigned_to or assigned_team is part of the update */
  changesAssignment: boolean
}): TicketDecision {
  if (input.canTriage) return ALLOW
  if (input.ticketAccess === 'own') {
    return { ok: false, status: 403, error: 'Requires triage capability' }
  }
  if (!input.inScope) return NOT_FOUND
  if (input.changesAssignment) {
    return { ok: false, status: 403, error: 'Reassigning a ticket requires triage capability' }
  }
  return ALLOW
}

export function decideReply(input: {
  adminAccess: boolean
  ticketAccess: TicketAccess
  inScope: boolean
  isInternal: boolean
}): TicketDecision {
  if (!input.adminAccess && !input.inScope) return NOT_FOUND
  if (input.isInternal && !input.adminAccess && input.ticketAccess === 'own') {
    return { ok: false, status: 403, error: 'Internal notes are for staff only' }
  }
  return ALLOW
}
