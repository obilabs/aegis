import { describe, expect, it } from 'vitest'
import { folderAccess, folderAccessFilter, type FolderAccess } from './folder-access'

const admin: FolderAccess = { isAdmin: true, isStaff: true, role: 'admin' }
const tech: FolderAccess = { isAdmin: false, isStaff: true, role: 'technician' }
const endUser: FolderAccess = { isAdmin: false, isStaff: false, role: 'user' }

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('folderAccess', () => {
  const perms = (over: Partial<{ adminAccess: boolean; ticketAccess: 'own' | 'team' | 'all' }> = {}) =>
    ({ capabilities: [], ticketAccess: 'own', adminAccess: false, ...over }) as never

  it('reads admin from the application role, not the session role', () => {
    // A granted admin whose Better Auth role is still "user" is an admin here.
    expect(folderAccess(perms({ adminAccess: true }), 'user')).toEqual({
      isAdmin: true,
      isStaff: true,
      role: 'user',
    })
  })

  it('a technician is staff but not admin', () => {
    expect(folderAccess(perms({ ticketAccess: 'all' }), 'technician')).toEqual({
      isAdmin: false,
      isStaff: true,
      role: 'technician',
    })
  })

  it('an end user is neither, and a missing session role falls back to "user"', () => {
    expect(folderAccess(perms(), null)).toEqual({ isAdmin: false, isStaff: false, role: 'user' })
    expect(folderAccess(perms(), undefined).role).toBe('user')
  })

  it("does not take 'admin' in the session role as admin", () => {
    // The Better Auth role never grants folder bypass on its own.
    expect(folderAccess(perms(), 'admin').isAdmin).toBe(false)
  })
})

describe('folderAccessFilter', () => {
  it('does not restrict an admin, and asks for no parameters', () => {
    expect(folderAccessFilter(admin, 3, { folderId: 'd.folder_id', nullable: true })).toEqual({
      clause: '',
      params: [],
    })
  })

  it('restricts a technician to folders their role is granted', () => {
    const { clause, params } = folderAccessFilter(tech, 3, { folderId: 'd.folder_id', nullable: true })
    expect(params).toEqual(['technician'])
    expect(squash(clause)).toBe(
      'AND ( d.folder_id IS NULL OR f.is_restricted = false ' +
        'OR EXISTS ( SELECT 1 FROM folder_permissions fp ' +
        'WHERE fp.folder_id = d.folder_id AND fp.role = $3 ) )',
    )
  })

  it('restricts an end user the same way (staff is not a bypass)', () => {
    const { clause, params } = folderAccessFilter(endUser, 3, { folderId: 'd.folder_id', nullable: true })
    expect(params).toEqual(['user'])
    expect(clause).toContain('fp.role = $3')
  })

  it('omits the NULL branch when the folder id cannot be null', () => {
    const { clause } = folderAccessFilter(endUser, 2, { folderId: 'f.id' })
    expect(squash(clause)).toBe(
      'AND ( f.is_restricted = false ' +
        'OR EXISTS ( SELECT 1 FROM folder_permissions fp ' +
        'WHERE fp.folder_id = f.id AND fp.role = $2 ) )',
    )
    expect(clause).not.toContain('IS NULL')
  })

  it('uses the parameter index it is given', () => {
    expect(folderAccessFilter(endUser, 7, { folderId: 'f.id' }).clause).toContain('fp.role = $7')
  })

  it('takes the restricted-flag expression from the caller', () => {
    const { clause } = folderAccessFilter(endUser, 2, { folderId: 'f.id', isRestricted: 'par.is_restricted' })
    expect(clause).toContain('par.is_restricted = false')
  })

  it('always names a role parameter for a non-admin, so the clause cannot be a no-op', () => {
    for (const access of [tech, endUser]) {
      const { clause, params } = folderAccessFilter(access, 1, { folderId: 'f.id' })
      expect(params).toHaveLength(1)
      expect(clause).toContain('EXISTS')
    }
  })
})
