/**
 * Path-prefix restriction by API key type (audit C4).
 *
 * A key type listed here may ONLY authenticate requests whose path starts with
 * the given prefix. An `aegis-mtp-pairing` key is issued for one specific MTP
 * integration and must be confined to the MTP surface — otherwise a pairing
 * key carrying the default `tickets:read` would authenticate e.g.
 * `GET /api/v1/tickets` (full, unredacted ticket bodies + requester emails)
 * like any other bearer, defeating the headlines-only privacy boundary the
 * MTP endpoints enforce per-endpoint.
 *
 * Key types not listed have no path restriction. Enforcement lives in
 * `validateApiRequest` (lib/api-auth.ts) — the single point every bearer flow
 * passes through — so the restriction can't be bypassed by how a route wires
 * its auth. This module is kept dependency-free so the rule is unit-testable.
 */

export const KEY_TYPE_PATH_PREFIX: Record<string, string> = {
  'aegis-mtp-pairing': '/api/v1/mtp/',
}

/**
 * Returns false iff `keyType` is path-restricted and `pathname` falls outside
 * its allowed prefix. Unrestricted key types (and unknown/undefined) return
 * true.
 */
export function keyTypeAllowedOnPath(
  keyType: string | undefined,
  pathname: string,
): boolean {
  const prefix = keyType ? KEY_TYPE_PATH_PREFIX[keyType] : undefined
  if (!prefix) return true
  return pathname.startsWith(prefix)
}
