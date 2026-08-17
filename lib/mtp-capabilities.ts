/**
 * Coarse product capabilities advertised to a paired MTP at handshake.
 *
 * These describe what THIS PRODUCT can do — not what a given customer granted.
 * The customer's grant is the pairing key's `scopes`, returned alongside this
 * in the handshake response. MTP stores both and gates writes on the scope.
 *
 * ── CROSS-REPO CONTRACT ────────────────────────────────────────────────────
 * MTP stores this array in `mtp_clients.capabilities` and its `ACTION_CAPABILITY`
 * map (apps/mtp/app/api/portal/clients/[id]/actions/route.ts) looks each action's
 * required capability up in it. These strings are therefore two halves of one
 * contract living in two repositories. Pinned by tests on BOTH sides — do not
 * edit one without the other.
 *
 * `tickets:write` was added 2026-08-17 when the minimal write path shipped.
 * Until then this was hardcoded `['tickets:read']` while MTP expected
 * `'tickets'`, so every write was refused as "not advertised" — even for a key
 * whose customer HAD granted `tickets:write`. Both sides were individually
 * defensible, every unit test on both sides passed, and the value simply never
 * crossed. The write path was unreachable end to end and nothing said so. Found
 * only by pairing a real MTP against a real Aegis; the same shape as the
 * `max_clients` / `max_managed_clients` incident that produced Verification
 * Rule 3.
 *
 * NOTE: MTP captures capabilities at handshake time, so an EXISTING pairing
 * keeps the old array until it re-pairs. Changing this list does not
 * retroactively grant anything to already-paired installs.
 *
 * Lives in lib/ rather than in the route because a Next.js `route.ts` may only
 * export HTTP verbs and route config — exporting anything else is a type error.
 */
export const SERVER_CAPABILITIES = ['tickets:read', 'tickets:write'] as const

export type ServerCapability = (typeof SERVER_CAPABILITIES)[number]
