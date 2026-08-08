import { describe, expect, it } from 'vitest'
import { computeAvailableActions, type AvailableActionsInput } from './mtp-available-actions'

function input(overrides: Partial<AvailableActionsInput> = {}): AvailableActionsInput {
  return {
    scopes: ['tickets:read'],
    writeOptInEnabled: false,
    ticketBaseStatus: 'open',
    handoffQueueExists: false,
    closePermissionGranted: false,
    ...overrides,
  }
}

describe('computeAvailableActions (D4)', () => {
  it('returns all false for a read-only pairing key', () => {
    expect(computeAvailableActions(input({ scopes: ['tickets:read'] }))).toEqual({
      comment: false,
      status: false,
      escalate: false,
      assign: false,
      resolve: false,
      close: false,
    })
  })

  it('returns all false when write scope is present but the customer has not enabled write opt-in', () => {
    // This is the current-reality wiring until Phase B' ships the opt-in.
    expect(
      computeAvailableActions(input({ scopes: ['tickets:read', 'tickets:write'], writeOptInEnabled: false })),
    ).toEqual({
      comment: false,
      status: false,
      escalate: false,
      assign: false,
      resolve: false,
      close: false,
    })
  })

  it('grants comment/status/assign/resolve on an open ticket for a write-enabled, opted-in key', () => {
    const actions = computeAvailableActions(
      input({
        scopes: ['tickets:read', 'tickets:write'],
        writeOptInEnabled: true,
        ticketBaseStatus: 'open',
        handoffQueueExists: true,
      }),
    )
    expect(actions).toEqual({
      comment: true,
      status: true,
      escalate: true, // handoff queue exists
      assign: true,
      resolve: true,
      close: false, // no delete scope, no customer grant
    })
  })

  it('gates close behind the write opt-in even for a delete-scoped key (audit M9)', () => {
    // Before the fix a delete-scoped key returned close:true today, before
    // any write path exists — bypassing the customer's per-pairing opt-in.
    const actions = computeAvailableActions(
      input({
        scopes: ['tickets:read', 'tickets:delete'],
        writeOptInEnabled: false,
        ticketBaseStatus: 'open',
      }),
    )
    expect(actions.close).toBe(false)
  })

  it('grants close when the pairing key has tickets:delete', () => {
    const actions = computeAvailableActions(
      input({
        scopes: ['tickets:read', 'tickets:write', 'tickets:delete'],
        writeOptInEnabled: true,
        ticketBaseStatus: 'open',
      }),
    )
    expect(actions.close).toBe(true)
  })

  it('grants close via an explicit customer grant even without tickets:delete', () => {
    const actions = computeAvailableActions(
      input({
        scopes: ['tickets:read', 'tickets:write'],
        writeOptInEnabled: true,
        ticketBaseStatus: 'open',
        closePermissionGranted: true,
      }),
    )
    expect(actions.close).toBe(true)
  })

  it('disables resolve and close on a terminal (closed) ticket even with write+delete', () => {
    const actions = computeAvailableActions(
      input({
        scopes: ['tickets:read', 'tickets:write', 'tickets:delete'],
        writeOptInEnabled: true,
        ticketBaseStatus: 'closed',
        handoffQueueExists: true,
        closePermissionGranted: true,
      }),
    )
    expect(actions.resolve).toBe(false)
    expect(actions.close).toBe(false)
    // Non-terminal-gated actions remain available.
    expect(actions.comment).toBe(true)
    expect(actions.status).toBe(true)
    expect(actions.assign).toBe(true)
  })

  it('disables escalate when no handoff queue exists', () => {
    const actions = computeAvailableActions(
      input({
        scopes: ['tickets:read', 'tickets:write'],
        writeOptInEnabled: true,
        handoffQueueExists: false,
      }),
    )
    expect(actions.escalate).toBe(false)
  })

  it('treats admin:full as granting write and delete', () => {
    const actions = computeAvailableActions(
      input({ scopes: ['admin:full'], writeOptInEnabled: true, ticketBaseStatus: 'open' }),
    )
    expect(actions.comment).toBe(true)
    expect(actions.close).toBe(true)
  })
})
