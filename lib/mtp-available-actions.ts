/**
 * D4 available-actions computation for the MTP JIT ticket-detail endpoint.
 *
 * Spec: mtp-poller-extension-sla-triage — "JIT endpoint reports available
 * actions". Design D4.
 *
 * MTP renders ticket-detail action buttons (reply, set status, escalate,
 * assign, resolve, close). Rather than have MTP duplicate the permission
 * logic — or render buttons the client will 403 — the client computes which
 * actions the caller's pairing key may actually perform and returns them.
 * The customer's install stays the single source of truth.
 *
 * Current reality: the write path (Phase B', `msp-mtp-inline-ticket-actions`)
 * and the queue/handoff model (Phase B, `msp-label-scoped-visibility`) have
 * NOT shipped. The route therefore calls this with `writeOptInEnabled=false`,
 * `handoffQueueExists=false`, `closePermissionGranted=false`, which makes
 * every action compute to `false` — matching the spec's "until the write
 * endpoints ship, all keys compute to false". The full rule set below is
 * implemented now so Phase B/B' only have to flip the inputs, not the logic.
 */

export interface AvailableActions {
  comment: boolean
  status: boolean
  escalate: boolean
  assign: boolean
  resolve: boolean
  close: boolean
}

export interface AvailableActionsInput {
  /** The pairing key's granted scopes (canonical `resource:action` strings). */
  scopes: string[]
  /**
   * Whether the customer's admin has enabled the per-pairing write opt-in
   * (D16). False until Phase B ships `write_scope_enabled_by_customer`.
   */
  writeOptInEnabled: boolean
  /** The ticket's mapped base status: 'open' | 'pending' | 'closed'. */
  ticketBaseStatus: string
  /**
   * Whether at least one valid handoff/escalation target queue exists from
   * the ticket's current queue. False until Phase B ships the queue model.
   */
  handoffQueueExists: boolean
  /**
   * Whether the customer explicitly granted close permission on this pairing
   * (independent of `tickets:delete` scope). False until Phase B.
   */
  closePermissionGranted: boolean
}

function hasScope(scopes: string[], scope: string): boolean {
  return scopes.includes(scope) || scopes.includes('admin:full')
}

/** 'closed' is the only terminal mapped state; open/pending are non-terminal. */
function isTerminal(baseStatus: string): boolean {
  return baseStatus === 'closed'
}

export function computeAvailableActions(input: AvailableActionsInput): AvailableActions {
  const canWrite = hasScope(input.scopes, 'tickets:write')
  const canDelete = hasScope(input.scopes, 'tickets:delete')
  const terminal = isTerminal(input.ticketBaseStatus)

  // Base gate: writing anything requires the write scope AND the customer's
  // per-pairing write opt-in. Everything else derives from this.
  const comment = canWrite && input.writeOptInEnabled

  return {
    comment,
    // Any status transition (including reopen) is permitted when write-enabled.
    status: comment,
    // Escalation needs a valid handoff target and the ability to invoke it.
    escalate: comment && input.handoffQueueExists,
    // Assignment is granted alongside write.
    assign: comment,
    // Can only resolve a non-terminal ticket.
    resolve: comment && !terminal,
    // Close is a mutation, so the customer's per-pairing write opt-in (D16)
    // gates it just like every other action — WITHOUT this a delete-scoped
    // pairing key would get close:true today, before any write path exists
    // (audit M9). Beyond the opt-in it needs delete scope OR an explicit
    // customer close grant, and a non-terminal ticket.
    close:
      input.writeOptInEnabled &&
      (canDelete || input.closePermissionGranted) &&
      !terminal,
  }
}
