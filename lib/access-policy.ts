/**
 * Pure access-level decisions (no I/O), used by lib/access.ts and the nav.
 * See lib/access.ts for the levels.
 */
import type { Capability, UserPermissions } from '@/lib/permissions'

export type AccessLevel = 'admin' | 'staff' | 'end_user'

/** Pure: the level a set of permissions grants. */
export function accessLevel(perms: UserPermissions): AccessLevel {
  if (perms.adminAccess) return 'admin'
  return perms.ticketAccess === 'own' ? 'end_user' : 'staff'
}

/** Pure: does the permission set satisfy the requirement? */
export function allows(
  perms: UserPermissions,
  need: { level?: 'staff' | 'admin'; capability?: Capability },
): boolean {
  const level = accessLevel(perms)
  if (level === 'admin') return true
  if (need.level === 'admin') return false
  if (need.level === 'staff' && level !== 'staff') return false
  if (need.capability && !perms.capabilities.includes(need.capability)) return false
  return true
}

