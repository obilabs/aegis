/**
 * AccessContext — orthogonal (depth, crossOrg) replacement for the broken
 * linearized ChatContextLevel.
 *
 * Background (auth-foundations Phase 1, D4): the prior model treated `provider`
 * as a depth axis and mis-ordered it as more permissive than `admin`. Provider
 * status is actually orthogonal to power-within-org — an MSP technician should
 * still be bounded by the contract and parent API key, never able to exceed
 * either. Modeling it as a flag with an optional delegation chain makes that
 * impossible to violate by construction.
 *
 * Effective permissions for a cross-org actor =
 *   intersection(staff_role.scopes, contract.scopes, parent_api_key.scopes)
 * Every grant is bounded above by its parent. No upward escalation.
 */

import type { ApiScope } from '@obilabs/api-scopes'

export type DepthLevel = 'end_user' | 'technician' | 'admin'

export interface DelegationChain {
  parentApiKeyId: string
  providerContractId: string
  grantedScopes: ApiScope[]
}

export interface AccessContext {
  /** Power within the user's primary organization. */
  depth: DepthLevel
  /** True iff this actor can touch other orgs (provider/MSP). */
  crossOrg: boolean
  /** Present only when crossOrg = true. Bounds effective scope intersection. */
  delegationChain?: DelegationChain
}
