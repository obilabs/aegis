/**
 * The role-grant policy itself (lib/role-grants.ts). The route-level test in
 * app/api/portal/users/role-grants.test.ts drives the handlers against a fake
 * database; these pin the pure decisions directly, so a refactor of either side
 * cannot quietly change what the policy allows.
 */
import { describe, expect, it, vi } from 'vitest'
import { decideLastAdmin, decidePrivilegedUpdate, decideRoleOnCreate } from './role-grants'

const ADMIN = 'actor-admin'
const MANAGER = 'actor-manager' // user_management capability, no admin_access
const TARGET = 'target-user'

/** A legitimate grant: an admin gives a non-admin role to someone else. */
const base = {
  actorUserId: ADMIN,
  actorIsAdmin: true,
  targetUserId: TARGET,
  changesRole: true,
  newRoleIsAdmin: false,
  targetIsAdmin: false,
  touchesPrivileged: true,
}

const refused = (d: ReturnType<typeof decidePrivilegedUpdate>) => {
  expect(d.ok).toBe(false)
  if (d.ok) throw new Error('unreachable')
  expect(d.status).toBe(403)
  return d.error
}

describe('decideRoleOnCreate', () => {
  it('refuses an admin role at account creation, admin or not', () => {
    const d = decideRoleOnCreate({ roleIsAdmin: true })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.status).toBe(403)
  })

  it('allows a non-admin role', () => {
    expect(decideRoleOnCreate({ roleIsAdmin: false })).toEqual({ ok: true })
  })
})

describe('decidePrivilegedUpdate', () => {
  it('refuses a self role change — even by an admin', () => {
    expect(
      refused(decidePrivilegedUpdate({ ...base, targetUserId: ADMIN, newRoleIsAdmin: false })),
    ).toMatch(/your own role/i)
    // And the self-grant of an admin role is the same refusal.
    refused(
      decidePrivilegedUpdate({
        ...base,
        actorUserId: MANAGER,
        actorIsAdmin: false,
        targetUserId: MANAGER,
        newRoleIsAdmin: true,
      }),
    )
  })

  it('refuses a non-admin holding user_management granting an admin role', () => {
    expect(
      refused(
        decidePrivilegedUpdate({
          ...base,
          actorUserId: MANAGER,
          actorIsAdmin: false,
          newRoleIsAdmin: true,
        }),
      ),
    ).toMatch(/only an administrator can grant an administrator role/i)
  })

  it('refuses a non-admin modifying an admin target, by role or by status', () => {
    // role change on an admin
    expect(
      refused(
        decidePrivilegedUpdate({
          ...base,
          actorUserId: MANAGER,
          actorIsAdmin: false,
          targetIsAdmin: true,
        }),
      ),
    ).toMatch(/administrator's role or status/i)
    // status-only change on an admin (changesRole false, still privileged)
    refused(
      decidePrivilegedUpdate({
        ...base,
        actorUserId: MANAGER,
        actorIsAdmin: false,
        changesRole: false,
        targetIsAdmin: true,
      }),
    )
  })

  it('allows the legitimate paths', () => {
    // an admin grants an admin role to someone else
    expect(decidePrivilegedUpdate({ ...base, newRoleIsAdmin: true })).toEqual({ ok: true })
    // an admin changes another admin's status
    expect(
      decidePrivilegedUpdate({ ...base, changesRole: false, targetIsAdmin: true }),
    ).toEqual({ ok: true })
    // user_management assigns a non-admin role to a non-admin
    expect(
      decidePrivilegedUpdate({ ...base, actorUserId: MANAGER, actorIsAdmin: false }),
    ).toEqual({ ok: true })
    // nothing privileged in the update at all
    expect(
      decidePrivilegedUpdate({
        ...base,
        actorUserId: MANAGER,
        actorIsAdmin: false,
        changesRole: false,
        touchesPrivileged: false,
        targetIsAdmin: true,
      }),
    ).toEqual({ ok: true })
  })
})

describe('decideLastAdmin', () => {
  const activeAdmin = {
    targetIsActiveAdmin: true,
    willDeactivate: false,
    willChangeRole: false,
    newRoleIsAdmin: false,
  }
  const count = (n: number) => vi.fn(async () => n)

  it('refuses deactivating the final active admin', async () => {
    const d = await decideLastAdmin({ ...activeAdmin, willDeactivate: true }, count(1))
    expect(d.ok).toBe(false)
    if (!d.ok) {
      expect(d.status).toBe(409)
      expect(d.error).toMatch(/last administrator/i)
    }
  })

  it('refuses moving the final active admin to a non-admin role', async () => {
    const d = await decideLastAdmin({ ...activeAdmin, willChangeRole: true }, count(1))
    expect(d.ok).toBe(false)
  })

  it('refuses when there are no active admins left to count', async () => {
    expect((await decideLastAdmin({ ...activeAdmin, willDeactivate: true }, count(0))).ok).toBe(false)
  })

  it('allows the same change when another active admin remains', async () => {
    expect(await decideLastAdmin({ ...activeAdmin, willDeactivate: true }, count(2))).toEqual({
      ok: true,
    })
    expect(await decideLastAdmin({ ...activeAdmin, willChangeRole: true }, count(2))).toEqual({
      ok: true,
    })
  })

  it('allows moving the final admin to another admin role', async () => {
    const counter = count(1)
    expect(
      await decideLastAdmin(
        { ...activeAdmin, willChangeRole: true, newRoleIsAdmin: true },
        counter,
      ),
    ).toEqual({ ok: true })
    expect(counter, 'no admin access is lost, so no count is needed').not.toHaveBeenCalled()
  })

  it('does not count admins when the target is not an active admin', async () => {
    const counter = count(1)
    expect(
      await decideLastAdmin(
        { ...activeAdmin, targetIsActiveAdmin: false, willDeactivate: true },
        counter,
      ),
    ).toEqual({ ok: true })
    expect(counter).not.toHaveBeenCalled()
  })
})
