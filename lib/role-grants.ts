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
 *   - The last active admin cannot be removed.
 *
 * The decision functions are pure so the policy is unit-tested directly; the
 * routes resolve the facts (is the role admin? is the target admin?) and call
 * them.
 */

import { pool } from '@/lib/db'

/** 403 for a refused grant; 409 for the last-admin conflict. */
export type GrantDecision = { ok: true } | { ok: false; status: 403 | 409; error: string }

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
/**
 * Last-admin guard (PRINCIPLES.md: never lock out administration). Refuses an
 * update that would take admin access off the FINAL active administrator, by
 * deactivating them or by moving them to a non-admin role. Recovery from a
 * zero-admin state is out-of-band (setup wizard / DB), never this endpoint.
 *
 * `countActiveAdmins` is called only when the update would actually cost the
 * target their admin access, so an ordinary status change costs no extra query.
 */
export async function decideLastAdmin(
  input: {
    /** the target holds admin access AND is currently active */
    targetIsActiveAdmin: boolean
    /** status is changing to something other than 'active' */
    willDeactivate: boolean
    /** role_id is part of this update */
    willChangeRole: boolean
    /** the role being assigned has admin_access */
    newRoleIsAdmin: boolean
  },
  countActiveAdmins: () => Promise<number>,
): Promise<GrantDecision> {
  const losesAdmin =
    input.targetIsActiveAdmin &&
    (input.willDeactivate || (input.willChangeRole && !input.newRoleIsAdmin))
  if (!losesAdmin) return ALLOW
  if ((await countActiveAdmins()) > 1) return ALLOW
  return {
    ok: false,
    status: 409,
    error: 'Cannot remove the last administrator — administration would be locked out.',
  }
}

export async function userHasAdminRole(userId: string, orgId: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT (ur.permissions->>'admin_access')::boolean AS admin_access
       FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE u.id = $1 AND u.organization_id = $2`,
    [userId, orgId],
  )
  return res.rows[0]?.admin_access === true
}
