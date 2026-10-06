/**
 * Who may read which document folder — pure decisions, no I/O.
 *
 * A folder with `is_restricted` is readable only by a role that has a matching
 * `folder_permissions` row; an administrator reads every folder. The predicate
 * lives here once because seven queries apply it (the document list and
 * detail, the attachment list and download, and the folder list and detail) —
 * a copy that drifts is a disclosure. Unit-tested in folder-access.test.ts.
 *
 * Admin is decided from the application role (the caller's UserPermissions,
 * i.e. users.role_id -> user_roles), not from the Better Auth session role, so
 * an administrator granted the role after setup passes too. The role string
 * matched against `folder_permissions.role` is still the session role, because
 * that is what the folder-permissions editor writes.
 */
import { allows } from '@/lib/access-policy'
import type { UserPermissions } from '@/lib/permissions'

export interface FolderAccess {
  /** Admins read every folder, restricted or not. */
  isAdmin: boolean
  /** Staff: admin, or a role that works tickets beyond its own. */
  isStaff: boolean
  /** Role matched against folder_permissions.role. */
  role: string
}

/** The caller's folder access, from their application permissions. */
export function folderAccess(perms: UserPermissions, sessionRole?: string | null): FolderAccess {
  return {
    isAdmin: allows(perms, { level: 'admin' }),
    isStaff: allows(perms, { level: 'staff' }),
    role: sessionRole || 'user',
  }
}

export interface FolderTarget {
  /** SQL expression for the folder id, e.g. 'd.folder_id' or 'f.id'. */
  folderId: string
  /** SQL expression for the folder's restricted flag. */
  isRestricted?: string
  /** True when folderId may be NULL (a document filed outside any folder). */
  nullable?: boolean
}

/**
 * AND-clause restricting rows to folders the caller may read, plus the
 * parameters it needs. Admins get an empty clause and no parameters.
 *
 *   const folder = folderAccessFilter(access, 3, { folderId: 'd.folder_id', nullable: true })
 *   await queryOne(`... WHERE d.id = $1 AND d.organization_id = $2 ${folder.clause}`,
 *                  [id, orgId, ...folder.params])
 *
 * @param firstParamIndex the $n this clause may use for its first parameter
 */
export function folderAccessFilter(
  access: FolderAccess,
  firstParamIndex: number,
  target: FolderTarget,
): { clause: string; params: string[] } {
  if (access.isAdmin) return { clause: '', params: [] }
  const { folderId, isRestricted = 'f.is_restricted', nullable = false } = target
  const clause = `AND (
        ${nullable ? `${folderId} IS NULL\n        OR ` : ''}${isRestricted} = false
        OR EXISTS (
          SELECT 1 FROM folder_permissions fp
          WHERE fp.folder_id = ${folderId} AND fp.role = $${firstParamIndex}
        )
      )`
  return { clause, params: [access.role] }
}
