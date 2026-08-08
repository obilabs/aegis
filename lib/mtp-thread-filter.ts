/**
 * D8 cross-MSP thread-visibility filter for the MTP JIT ticket-detail
 * endpoint (`GET /api/v1/mtp/tickets/{id}`).
 *
 * Spec: mtp-poller-extension-sla-triage — "JIT endpoint enforces D8
 * cross-MSP thread visibility". Design D3 in the same change.
 *
 * The rule (default CLOSED per D8): an internal note authored via a
 * DIFFERENT pairing key than the caller's is hidden UNLESS the customer's
 * admin has opted the caller's pairing into the note author's
 * `shares_activity_with_pairing_ids`. Public comments and structural
 * system events (status / assignment / queue changes) are ALWAYS visible.
 *
 * Filtering happens server-side (never in the MTP client): filtering in
 * MTP would leak the existence of the hidden notes even if their content
 * were withheld.
 *
 * Transitional note: until the write path (Phase B',
 * `msp-mtp-inline-ticket-actions`) stamps `via_pairing_key_id` onto notes,
 * every existing note has `via_pairing_key_id === null` — a customer-side
 * user wrote it, not an MSP tech, so it is always visible and this filter
 * is effectively a no-op. Correct per design D3.
 */

export type ThreadKind =
  | 'comment'
  | 'internal_note'
  | 'status_change'
  | 'assignment_change'
  | 'queue_change'

/**
 * The subset of a thread entry the D8 filter reasons about. The route's
 * full thread entry is a superset (adds display fields like actor_name);
 * the generic below preserves whatever extra fields the caller passes.
 */
export interface ThreadFilterFields {
  kind: ThreadKind
  is_internal_note: boolean
  /**
   * The pairing key that authored this entry, or null when it was authored
   * by a customer-side user (no MSP attribution). Null → always visible.
   */
  via_pairing_key_id: string | null
  /**
   * The set of pairing key ids the customer has opted to share THIS entry's
   * activity with. Empty by default (D8 default CLOSED).
   */
  shares_activity_with_pairing_ids: string[]
}

/**
 * Return only the thread entries the calling pairing key is permitted to
 * see under D8. Preserves order and any additional fields on each entry.
 */
export function filterThreadForCaller<T extends ThreadFilterFields>(
  thread: T[],
  callerPairingKeyId: string,
): T[] {
  return thread.filter((entry) => {
    // Public comments and structural system events are never scoped.
    if (!entry.is_internal_note) return true

    // Internal note authored by a customer-side user (no MSP pairing) —
    // always visible (D3 transitional + native customer notes).
    if (entry.via_pairing_key_id === null) return true

    // Internal note authored via the caller's OWN pairing key — visible.
    if (entry.via_pairing_key_id === callerPairingKeyId) return true

    // Internal note authored via a DIFFERENT pairing key — visible only if
    // the customer opted the caller into this note's activity sharing.
    return entry.shares_activity_with_pairing_ids.includes(callerPairingKeyId)
  })
}
