import { describe, expect, it } from 'vitest'
import { accessLevel, allows } from '@/lib/access-policy'

const endUser = { capabilities: [], ticketAccess: 'own' as const, adminAccess: false }
const tech = { capabilities: ['credentials' as const], ticketAccess: 'team' as const, adminAccess: false }
const helpdeskAdmin = { capabilities: ['triage' as const, 'reports' as const], ticketAccess: 'all' as const, adminAccess: false }
const admin = { capabilities: [], ticketAccess: 'all' as const, adminAccess: true }

describe('access levels', () => {
  it('maps roles to levels', () => {
    expect(accessLevel(endUser)).toBe('end_user')
    expect(accessLevel(tech)).toBe('staff')
    expect(accessLevel(helpdeskAdmin)).toBe('staff')
    expect(accessLevel(admin)).toBe('admin')
  })

  it('staff routes refuse end users', () => {
    expect(allows(endUser, { level: 'staff' })).toBe(false)
    expect(allows(tech, { level: 'staff' })).toBe(true)
    expect(allows(admin, { level: 'staff' })).toBe(true)
  })

  it('admin routes refuse everyone but admins', () => {
    expect(allows(helpdeskAdmin, { level: 'admin' })).toBe(false)
    expect(allows(admin, { level: 'admin' })).toBe(true)
  })

  it('capabilities are required unless admin', () => {
    expect(allows(tech, { capability: 'settings' })).toBe(false)
    expect(allows({ ...endUser, capabilities: ['settings'] }, { capability: 'settings' })).toBe(true)
    expect(allows(admin, { capability: 'settings' })).toBe(true)
  })
})
