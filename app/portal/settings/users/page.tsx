'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  UserGroupIcon,
  PlusIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  KeyIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role_id: string | null
  role_name: string | null
  status: 'active' | 'inactive' | 'suspended'
  contact_id: string | null
  auth_method: string
  last_login_at: string | null
  created_at: string
  contact_type: string | null
  department_name: string | null
  job_title_name: string | null
}

interface Role {
  id: string
  name: string
  description: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-green-500/10 text-green-400' },
  inactive: { label: 'Inactive', classes: 'bg-slate-700 text-slate-400' },
  suspended: { label: 'Suspended', classes: 'bg-red-500/10 text-red-400' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Never'
  return date.toLocaleDateString()
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role_id: '',
    contact_type: 'employee' as 'employee' | 'customer' | 'vendor' | 'partner',
    msp_pairing_key_id: '' as string,
  })

  // Active MSP pairing keys — for the "Provisioning MSP firm" dropdown.
  // When admin selects one, revoking that MSP later will cascade-disable
  // this user's account (msp-cascade-revocation spec).
  const [pairingKeys, setPairingKeys] = useState<
    Array<{ id: string; name: string }>
  >([])

  // Edit state (inline per-row)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editRoleId, setEditRoleId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  // Admin password reset (no SMTP required)
  const [resettingId, setResettingId] = useState<string | null>(null)
  // Shared "copy set-password link" result — used by both create (invite) and reset.
  const [linkResult, setLinkResult] = useState<{ email: string; url: string; kind: 'invite' | 'reset' } | null>(null)

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Generate a one-time set-password link for ${user.email}? You'll get a link to send them — they set their own password (you never see it).`)) return
    setResettingId(user.id)
    setError(null)
    try {
      const res = await fetch(`/api/portal/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'admin_reset_disabled'
          ? 'Password resets are disabled for this organization.'
          : data.error || 'Failed to generate link')
        return
      }
      setLinkResult({ email: user.email, url: data.setPasswordUrl, kind: 'reset' })
    } catch {
      setError('Failed to generate link')
    } finally {
      setResettingId(null)
    }
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPairingKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/api-keys')
      if (!res.ok) return
      const data = await res.json()
      const active = (data.apiKeys || [])
        .filter(
          (k: { key_type: string; is_active: boolean }) =>
            k.key_type === 'aegis-mtp-pairing' && k.is_active,
        )
        .map((k: { id: string; name: string }) => ({ id: k.id, name: k.name }))
      setPairingKeys(active)
    } catch {
      // Non-fatal: dropdown will be empty
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/roles')
      if (!res.ok) throw new Error('Failed to fetch roles')
      const data = await res.json()
      setRoles(data.roles)
    } catch {
      // Non-fatal: role dropdowns will be empty
      console.error('Failed to fetch roles')
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchPairingKeys()
  }, [fetchUsers, fetchRoles, fetchPairingKeys])

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === '' ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.role_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.department_name || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || user.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // -------------------------------------------------------------------------
  // Create user
  // -------------------------------------------------------------------------

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreating(true)

    try {
      const res = await fetch('/api/portal/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: createForm.first_name.trim(),
          last_name: createForm.last_name.trim(),
          email: createForm.email.trim(),
          role_id: createForm.role_id || null,
          contact_type: createForm.contact_type,
          msp_pairing_key_id: createForm.msp_pairing_key_id || null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create user')
        return
      }

      const invitedEmail = createForm.email.trim()
      setShowCreateModal(false)
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role_id: '',
        contact_type: 'employee',
        msp_pairing_key_id: '',
      })
      fetchUsers()
      // Surface the one-time set-password link for the admin to send.
      if (data.setPasswordUrl) {
        setLinkResult({ email: invitedEmail, url: data.setPasswordUrl, kind: 'invite' })
      }
    } catch {
      setError('Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  // -------------------------------------------------------------------------
  // Update user (role change, status toggle)
  // -------------------------------------------------------------------------

  const handleUpdateRole = async (userId: string, roleId: string | null) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update role')
        return
      }
      setEditingUserId(null)
      fetchUsers()
    } catch {
      setError('Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update status')
        return
      }
      fetchUsers()
    } catch {
      setError('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Edit row helpers
  // -------------------------------------------------------------------------

  const startEditing = (user: User) => {
    setEditingUserId(user.id)
    setEditRoleId(user.role_id || '')
  }

  const cancelEditing = () => {
    setEditingUserId(null)
    setEditRoleId('')
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const activeCount = users.filter((u) => u.status === 'active').length
  const inactiveCount = users.filter((u) => u.status === 'inactive').length
  const suspendedCount = users.filter((u) => u.status === 'suspended').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/portal/settings"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              <UserGroupIcon className="h-7 w-7" />
              Users &amp; Roles
            </h1>
            <p className="text-slate-400 mt-1">Manage team members, roles, and access</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Invite User
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-sm text-slate-400">Active Users</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{activeCount}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-sm text-slate-400">Inactive</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{inactiveCount}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-sm text-slate-400">Suspended</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{suspendedCount}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, role, or department..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <UserGroupIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              {users.length === 0 ? 'No users yet' : 'No users match your search'}
            </h3>
            <p className="text-slate-500 mb-4">
              {users.length === 0
                ? 'Invite your first team member to get started'
                : 'Try adjusting the search or filter criteria'}
            </p>
            {users.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                Invite User
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredUsers.map((user) => {
                  const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.inactive
                  const isEditing = editingUserId === user.id

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-brand-400">
                              {getInitials(user.first_name, user.last_name)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {user.first_name} {user.last_name}
                            </p>
                            {user.job_title_name && (
                              <p className="text-xs text-slate-500 truncate">{user.job_title_name}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300">{user.email}</span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editRoleId}
                              onChange={(e) => setEditRoleId(e.target.value)}
                              className="px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:border-brand-500 outline-none"
                            >
                              <option value="">No Role</option>
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleUpdateRole(user.id, editRoleId || null)}
                              disabled={saving}
                              className="p-1 text-brand-400 hover:text-brand-300 disabled:opacity-50"
                              title="Save role"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-slate-400 hover:text-slate-300"
                              title="Cancel"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-brand-500/10 text-brand-400 rounded">
                            {user.role_name || 'No Role'}
                          </span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">
                          {user.department_name || '--'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${statusCfg.classes}`}>
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">
                          {formatDate(user.last_login_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!isEditing && (
                            <button
                              onClick={() => startEditing(user)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Change role"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                          {!isEditing && (
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={resettingId === user.id}
                              className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                              title="Send set-password link (user sets their own; you never see it)"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={saving}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              user.status === 'active'
                                ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                                : 'text-slate-400 hover:text-green-400 hover:bg-slate-800'
                            }`}
                            title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.status === 'active' ? (
                              <XCircleIcon className="h-4 w-4" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with count */}
        {filteredUsers.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800 text-sm text-slate-500">
            Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create User Modal                                                  */}
      {/* ------------------------------------------------------------------ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 my-8">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-slate-100">Invite User</h2>
              <p className="text-sm text-slate-400 mt-1">
                Create a new user account and assign a role
              </p>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                    placeholder="Jane"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.last_name}
                    onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="jane.doe@company.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  required
                />
              </div>

              {/* No password field — the user sets their own via a one-time link */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-400">
                You won&rsquo;t set a password. On save you&rsquo;ll get a one-time
                <span className="text-slate-200"> set-password link</span> to send them &mdash;
                they choose their own password, and you never see it.
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role
                </label>
                <select
                  value={createForm.role_id}
                  onChange={(e) => setCreateForm({ ...createForm, role_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                >
                  <option value="">No Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                      {role.description ? ` -- ${role.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Contact Type
                </label>
                <select
                  value={createForm.contact_type}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      contact_type: e.target.value as 'employee' | 'customer' | 'vendor' | 'partner',
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                >
                  <option value="employee">Employee</option>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="partner">Partner</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Determines the type of contact record created for this user.
                </p>
              </div>

              {/* Provisioning MSP firm — only shown when at least one
                  active aegis-mtp-pairing key exists. Selecting one
                  binds this user to that MSP; revoking the MSP later
                  cascade-disables the account (msp-cascade-revocation
                  spec). */}
              {pairingKeys.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Provisioning MSP firm{' '}
                    <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <select
                    value={createForm.msp_pairing_key_id}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, msp_pairing_key_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  >
                    <option value="">None — customer-native user</option>
                    {pairingKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecting this means revoking this MSP&apos;s pairing will
                    automatically disable this user&apos;s account.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateForm({
                      first_name: '',
                      last_name: '',
                      email: '',
                      password: '',
                      role_id: '',
                      contact_type: 'employee',
                      msp_pairing_key_id: '',
                    })
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.first_name || !createForm.last_name || !createForm.email}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-time set-password link — for invite (create) or reset. Shown once. */}
      {linkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <KeyIcon className="h-5 w-5 text-brand-400" />
              <h3 className="text-lg font-semibold text-slate-100">
                {linkResult.kind === 'invite' ? 'Send this set-password link' : 'Send this reset link'}
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Send this one-time link to <span className="text-slate-200">{linkResult.email}</span>.
              They set their own password &mdash; you never see it. The link expires and works once.
              {linkResult.kind === 'reset' && ' Their current password keeps working until they use it.'}
            </p>
            <div className="flex items-center gap-2 mb-5">
              <code className="flex-1 rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs text-slate-100 select-all break-all">
                {linkResult.url}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(linkResult.url)}
                className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setLinkResult(null)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
