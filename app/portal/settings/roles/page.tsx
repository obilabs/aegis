'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LockClosedIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const VALID_CAPABILITIES = [
  { key: 'triage', label: 'Triage', description: 'View unassigned ticket pool and classify tickets' },
  { key: 'bulk_actions', label: 'Bulk Actions', description: 'Perform bulk operations on tickets' },
  { key: 'reports', label: 'Reports', description: 'Access reports and analytics' },
  { key: 'settings', label: 'Settings', description: 'Access system settings' },
  { key: 'user_management', label: 'User Management', description: 'Create and manage users' },
  { key: 'credentials', label: 'Credential Vault', description: 'View, reveal, and manage stored credentials (admins always have this)' },
] as const

const TICKET_ACCESS_OPTIONS = [
  { value: 'own', label: 'Own Only', description: 'Can only see tickets they created or are assigned to' },
  { value: 'team', label: 'Team', description: 'Can see their own tickets plus their team\'s tickets' },
  { value: 'all', label: 'All', description: 'Can see all tickets in the organization' },
] as const

interface RolePermissions {
  capabilities: string[]
  ticket_access: 'own' | 'team' | 'all'
  admin_access: boolean
}

interface Role {
  id: string
  name: string
  description: string | null
  permissions: RolePermissions
  isSystem: boolean
  userCount: number
  createdAt: string
  updatedAt: string
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['capabilities', 'access', 'admin']))
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<RolePermissions>({
    capabilities: [],
    ticket_access: 'own',
    admin_access: false,
  })

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/roles')
      if (!res.ok) throw new Error('Failed to fetch roles')
      const data = await res.json()
      setRoles(data.roles)
      if (data.roles.length > 0) {
        setSelectedRole((prev: Role | null) => prev || data.roles[0])
      }
    } catch {
      setError('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleCapabilityToggle = async (capability: string) => {
    if (!selectedRole) return

    const perms = selectedRole.permissions
    const newCapabilities = perms.capabilities.includes(capability)
      ? perms.capabilities.filter(c => c !== capability)
      : [...perms.capabilities, capability]

    const newPerms = { ...perms, capabilities: newCapabilities }
    await updateRole(selectedRole.id, { permissions: newPerms })
  }

  const handleTicketAccessChange = async (access: 'own' | 'team' | 'all') => {
    if (!selectedRole || selectedRole.isSystem) return
    const newPerms = { ...selectedRole.permissions, ticket_access: access }
    await updateRole(selectedRole.id, { permissions: newPerms })
  }

  const handleAdminToggle = async () => {
    if (!selectedRole || selectedRole.isSystem) return
    const newPerms = { ...selectedRole.permissions, admin_access: !selectedRole.permissions.admin_access }
    await updateRole(selectedRole.id, { permissions: newPerms })
  }

  const updateRole = async (roleId: string, updates: Partial<{ name: string; description: string; permissions: RolePermissions }>) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update role')
        return
      }
      const data = await res.json()
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, ...data.role } : r))
      setSelectedRole(prev => prev?.id === roleId ? { ...prev, ...data.role } : prev)
    } catch {
      setError('Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      setError('Role name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || undefined,
          permissions: newRolePermissions,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create role')
        return
      }
      const data = await res.json()
      setRoles(prev => [...prev, data.role])
      setSelectedRole(data.role)
      setShowCreateForm(false)
      setNewRoleName('')
      setNewRoleDescription('')
      setNewRolePermissions({ capabilities: [], ticket_access: 'own', admin_access: false })
    } catch {
      setError('Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/roles/${roleId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete role')
        return
      }
      setRoles(prev => prev.filter(r => r.id !== roleId))
      if (selectedRole?.id === roleId) {
        setSelectedRole(roles.find(r => r.id !== roleId) || null)
      }
    } catch {
      setError('Failed to delete role')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <ShieldCheckIcon className="h-7 w-7" />
            Roles & Permissions
          </h1>
          <p className="text-slate-400 mt-1">Manage access control for users</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Create Role
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-4">
          <h3 className="font-semibold text-slate-100">New Role</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="e.g. Project Manager"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={newRoleDescription}
                onChange={e => setNewRoleDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="What this role is for"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Ticket Access</label>
            <div className="flex gap-3">
              {TICKET_ACCESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewRolePermissions(p => ({ ...p, ticket_access: opt.value as 'own' | 'team' | 'all' }))}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    newRolePermissions.ticket_access === opt.value
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                      : 'bg-slate-900 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-2">
              {VALID_CAPABILITIES.map(cap => (
                <button
                  key={cap.key}
                  onClick={() => {
                    setNewRolePermissions(p => ({
                      ...p,
                      capabilities: p.capabilities.includes(cap.key)
                        ? p.capabilities.filter(c => c !== cap.key)
                        : [...p.capabilities, cap.key],
                    }))
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    newRolePermissions.capabilities.includes(cap.key)
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                      : 'bg-slate-900 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {cap.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRole}
              disabled={saving || !newRoleName.trim()}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="col-span-1 space-y-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="font-semibold text-slate-100 mb-4">Roles ({roles.length})</h3>
            <div className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedRole?.id === role.id
                      ? 'bg-brand-500/20 border border-brand-500/50'
                      : 'bg-slate-900/50 border border-transparent hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      role.permissions.admin_access ? 'bg-red-500' :
                      role.permissions.ticket_access === 'all' ? 'bg-blue-500' :
                      role.permissions.ticket_access === 'team' ? 'bg-purple-500' :
                      'bg-slate-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-200 truncate">{role.name}</p>
                        {role.isSystem && (
                          <LockClosedIcon className="h-3 w-3 text-slate-500 flex-shrink-0" title="System role" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{role.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-slate-300">{role.userCount}</p>
                      <p className="text-xs text-slate-500">users</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Role Details */}
        <div className="col-span-2">
          {selectedRole ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              {/* Role Header */}
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-100">{selectedRole.name}</h2>
                      {selectedRole.isSystem && (
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 mt-1">{selectedRole.description || 'No description'}</p>
                  </div>
                  {!selectedRole.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(selectedRole.id)}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6 mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-300">{selectedRole.userCount} users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-300">
                      {selectedRole.permissions.capabilities.length} capabilities
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    selectedRole.permissions.ticket_access === 'all' ? 'bg-blue-500/20 text-blue-400' :
                    selectedRole.permissions.ticket_access === 'team' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {selectedRole.permissions.ticket_access === 'all' ? 'All Tickets' :
                     selectedRole.permissions.ticket_access === 'team' ? 'Team Tickets' :
                     'Own Tickets'}
                  </span>
                </div>
              </div>

              {/* Capabilities Section */}
              <div className="p-4 space-y-3">
                <button
                  onClick={() => toggleSection('capabilities')}
                  className="w-full flex items-center justify-between hover:bg-slate-700/30 rounded-lg px-2 py-1 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has('capabilities') ? (
                      <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-100">Capabilities</span>
                  </div>
                  <span className="text-sm text-slate-400">
                    {selectedRole.permissions.capabilities.length}/{VALID_CAPABILITIES.length}
                  </span>
                </button>

                {expandedSections.has('capabilities') && (
                  <div className="space-y-2 pl-6">
                    {VALID_CAPABILITIES.map(cap => {
                      const isGranted = selectedRole.permissions.capabilities.includes(cap.key)
                      return (
                        <button
                          key={cap.key}
                          onClick={() => handleCapabilityToggle(cap.key)}
                          disabled={saving}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors disabled:opacity-50 ${
                            isGranted ? 'bg-brand-500/10 hover:bg-brand-500/20' : 'bg-slate-900/50 hover:bg-slate-800'
                          }`}
                        >
                          <div className={`p-1 rounded ${isGranted ? 'bg-brand-500/20' : 'bg-slate-700'}`}>
                            {isGranted ? (
                              <CheckIcon className="h-4 w-4 text-brand-400" />
                            ) : (
                              <XMarkIcon className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <p className={`text-sm ${isGranted ? 'text-slate-200' : 'text-slate-400'}`}>
                              {cap.label}
                            </p>
                            <p className="text-xs text-slate-500">{cap.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Ticket Access Section */}
                <button
                  onClick={() => toggleSection('access')}
                  className="w-full flex items-center justify-between hover:bg-slate-700/30 rounded-lg px-2 py-1 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has('access') ? (
                      <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-100">Ticket Access</span>
                    {selectedRole.isSystem && (
                      <LockClosedIcon className="h-3 w-3 text-slate-500" title="Cannot change on system roles" />
                    )}
                  </div>
                </button>

                {expandedSections.has('access') && (
                  <div className="space-y-2 pl-6">
                    {TICKET_ACCESS_OPTIONS.map(opt => {
                      const isSelected = selectedRole.permissions.ticket_access === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleTicketAccessChange(opt.value as 'own' | 'team' | 'all')}
                          disabled={saving || selectedRole.isSystem}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors disabled:opacity-50 ${
                            isSelected ? 'bg-brand-500/10 border border-brand-500/30' : 'bg-slate-900/50 hover:bg-slate-800 border border-transparent'
                          } ${selectedRole.isSystem ? 'cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-brand-500' : 'border-slate-600'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                          </div>
                          <div>
                            <p className={`text-sm ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-slate-500">{opt.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Admin Access Section */}
                <button
                  onClick={() => toggleSection('admin')}
                  className="w-full flex items-center justify-between hover:bg-slate-700/30 rounded-lg px-2 py-1 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has('admin') ? (
                      <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-100">Admin Access</span>
                    {selectedRole.isSystem && (
                      <LockClosedIcon className="h-3 w-3 text-slate-500" title="Cannot change on system roles" />
                    )}
                  </div>
                </button>

                {expandedSections.has('admin') && (
                  <div className="pl-6">
                    <button
                      onClick={handleAdminToggle}
                      disabled={saving || selectedRole.isSystem}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors disabled:opacity-50 ${
                        selectedRole.permissions.admin_access
                          ? 'bg-red-500/10 hover:bg-red-500/20'
                          : 'bg-slate-900/50 hover:bg-slate-800'
                      } ${selectedRole.isSystem ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${
                        selectedRole.permissions.admin_access ? 'bg-red-500' : 'bg-slate-600'
                      }`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          selectedRole.permissions.admin_access ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <div>
                        <p className={`text-sm ${selectedRole.permissions.admin_access ? 'text-red-400' : 'text-slate-400'}`}>
                          {selectedRole.permissions.admin_access ? 'Admin Access Enabled' : 'No Admin Access'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Admin access grants full system configuration rights
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
              <ShieldCheckIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Select a role to view permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <SparklesIcon className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <p><strong className="text-slate-200">Role-Based Access Control (RBAC)</strong></p>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li><strong>System roles</strong> are seeded on setup — you can toggle their capabilities but not rename, delete, or change ticket access</li>
              <li><strong>Custom roles</strong> can be created, fully edited, and deleted (if no users are assigned)</li>
              <li>Each user has one role. Capabilities and ticket access are defined by their role.</li>
              <li><strong>Ticket access</strong> controls which tickets a user can see (own, team, or all)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
