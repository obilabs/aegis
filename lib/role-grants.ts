/**
 * Role-grant policy — who may put which role on which account.
 *
 * Principle 1 (admin is bootstrapped once, then only granted):
 *   - Account creation never carries an administrator role, whatever the
 *     caller sends. The account is created, then an existing admin grants the
 *     role as a separate, audited action.
 *   - Granting a role with `admin_access` — or changing the role/status of an
 *     account that currently has admin access — requires the actor to be an
 *     admin. The `user_management` capability alone is not enough.
 *   - Nobody changes their own role.
 *   - The last active admin cannot be removed (enforced in the PATCH route).
 *
 * The decision functions are pure so the policy is unit-tested directly; the
 * routes resolve the facts (is the role admin? is the target admin?) and call
 * them.
 */

import { pool } from '@/lib/db'

export type GrantDecision = { ok: true } | { ok: false; status: 403; error: string }

const ALLOW: GrantDecision = { ok: true }

export function decideRoleOnCreate(input: { roleIsAdmin: boolean }): GrantDecision {
  if (input.roleIsAdmin) {
    return {
      ok: false,
      status: 403,
      error:
        'New accounts cannot be created with an administrator role. Create the account, then have an administrator grant the role.',
    }
  }
  return ALLOW
}

export function decidePrivilegedUpdate(input: {
  actorUserId: string
  actorIsAdmin: boolean
  targetUserId: string
  /** role_id is part of this update */
  changesRole: boolean
  /** the role being assigned has admin_access */
  newRoleIsAdmin: boolean
  /** the target currently holds a role with admin_access */
  targetIsAdmin: boolean
  /** role_id / status / contact_id is part of this update */
  touchesPrivileged: boolean
}): GrantDecision {
  if (input.changesRole && input.actorUserId === input.targetUserId) {
    return { ok: false, status: 403, error: 'You cannot change your own role.' }
  }
  if (input.changesRole && input.newRoleIsAdmin && !input.actorIsAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Only an administrator can grant an administrator role.',
    }
  }
  if (input.touchesPrivileged && input.targetIsAdmin && !input.actorIsAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Only an administrator can change an administrator's role or status.",
    }
  }
  return ALLOW
}

/**
 * Look up a role in this org. `null` when it does not exist here (callers
 * reject the request rather than attaching a foreign / unknown role).
 */
export async function lookupRole(
  roleId: string,
  orgId: string,
): Promise<{ adminAccess: boolean } | null> {
  const res = await pool.query(
    `SELECT (permissions->>'admin_access')::boolean AS admin_access
       FROM user_roles WHERE id = $1 AND organization_id = $2`,
    [roleId, orgId],
  )
  if (res.rows.length === 0) return null
  return { adminAccess: res.rows[0].admin_access === true }
}

/** Does this user currently hold a role with admin_access? */
export async function userHasAdminRole(userId: string, orgId: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT (ur.permissions->>'admin_access')::boolean AS admin_access
       FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE u.id = $1 AND u.organization_id = $2`,
    [userId, orgId],
  )
  return res.rows[0]?.admin_access === true
}
