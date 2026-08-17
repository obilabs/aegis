/**
 * Cross-boundary pin: the capability strings MTP gates writes on.
 *
 * `SERVER_CAPABILITIES` is advertised in the handshake response and stored by
 * MTP in `mtp_clients.capabilities`. MTP's `ACTION_CAPABILITY` map
 * (apps/mtp/app/api/portal/clients/[id]/actions/route.ts) looks each action's
 * required capability up in that stored array, so these are literally two
 * halves of one string contract living in two repositories.
 *
 * They did not match. This side hardcoded `['tickets:read']` and never
 * advertised write; the MTP side expected `'tickets'`. Every write was refused
 * with "this install did not advertise the capability" — even for a key whose
 * customer HAD granted `tickets:write`. Both sides were individually
 * defensible, every unit test on both sides passed, and the value simply never
 * crossed. The write path was unreachable end to end and nothing said so.
 *
 * That is the same shape as the `max_clients` / `max_managed_clients` incident,
 * which is why Verification Rule 3 exists: pin cross-boundary names in a test,
 * not a comment. Found here only by pairing a real MTP against a real Aegis.
 */

import { describe, it, expect } from 'vitest'
import { SERVER_CAPABILITIES } from '@/lib/mtp-capabilities'

describe('handshake SERVER_CAPABILITIES (cross-repo contract)', () => {
  it('advertises exactly the capabilities MTP gates on', () => {
    // If you change this, change apps/mtp's ACTION_CAPABILITY map in the same
    // breath — and re-pair, because MTP captures capabilities at handshake and
    // an existing pairing keeps the OLD array until it pairs again.
    expect([...SERVER_CAPABILITIES]).toEqual(['tickets:read', 'tickets:write'])
  })

  it('advertises write, because the write endpoints exist', () => {
    // The regression, stated directly: comment/status/assignee routes shipped
    // 2026-08-16. Not advertising write makes them unreachable through MTP.
    expect(SERVER_CAPABILITIES).toContain('tickets:write')
  })

  it('uses resource:action form, matching the scope vocabulary', () => {
    // A bare 'tickets' (what MTP once expected) matches nothing here.
    for (const cap of SERVER_CAPABILITIES) {
      expect(cap).toMatch(/^[a-z]+:[a-z]+$/)
    }
  })
})
