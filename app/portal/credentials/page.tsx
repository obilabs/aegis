'use client'

import { useState, useEffect } from 'react'
import {
  KeyIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  ListBulletIcon,
  LockClosedIcon,
  PencilIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'

interface Credential {
  id: string
  name: string
  description: string
  category: string
  username: string
  uri?: string
  passwordChangedAt?: string
  expiresAt?: string
  isExpiring: boolean
  isExpired: boolean
  contactCount: number
  assetCount: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'application': return GlobeAltIcon
    case 'server': return ComputerDesktopIcon
    case 'database': return Squares2X2Icon
    case 'api': return LinkIcon
    case 'network': return ShieldCheckIcon
    default: return KeyIcon
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'application': return 'bg-blue-500/20 text-blue-400'
    case 'server': return 'bg-purple-500/20 text-purple-400'
    case 'database': return 'bg-brand-500/20 text-brand-400'
    case 'api': return 'bg-orange-500/20 text-orange-400'
    case 'network': return 'bg-cyan-500/20 text-cyan-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [revealedPasswords, setRevealedPasswords] = useState<Map<string, string>>(new Map())
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchCredentials()
  }, [])

  async function fetchCredentials() {
    try {
      const res = await fetch('/api/portal/credentials')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCredentials(data.credentials || [])
    } catch (err) {
      console.error('Failed to load credentials:', err)
    } finally {
      setLoading(false)
    }
  }

  async function revealPassword(id: string) {
    if (revealedPasswords.has(id)) {
      setRevealedPasswords(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      return
    }

    setRevealingId(id)
    try {
      const res = await fetch(`/api/portal/credentials/${id}/reveal`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to reveal')
      const data = await res.json()
      setRevealedPasswords(prev => {
        const next = new Map(prev)
        next.set(id, data.revealed.password || '')
        return next
      })
    } catch (err) {
      console.error('Failed to reveal password:', err)
    } finally {
      setRevealingId(null)
    }
  }

  async function copyPassword(id: string) {
    let password = revealedPasswords.get(id)
    if (!password) {
      try {
        const res = await fetch(`/api/portal/credentials/${id}/reveal`, { method: 'POST' })
        if (!res.ok) throw new Error('Failed to reveal')
        const data = await res.json()
        password = data.revealed.password || ''
      } catch {
        return
      }
    }
    if (password) {
      await navigator.clipboard.writeText(password)
      setCopiedId(`pass-${id}`)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const copyToClipboard = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(key)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredCredentials = credentials.filter(cred => {
    const matchesSearch =
      cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.username.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || cred.category === categoryFilter

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'expiring' && cred.isExpiring) ||
      (statusFilter === 'expired' && cred.isExpired) ||
      (statusFilter === 'healthy' && !cred.isExpiring && !cred.isExpired)

    return matchesSearch && matchesCategory && matchesStatus
  })

  const stats = {
    total: credentials.length,
    expiring: credentials.filter(c => c.isExpiring).length,
    expired: credentials.filter(c => c.isExpired).length,
    healthy: credentials.filter(c => !c.isExpiring && !c.isExpired).length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <KeyIcon className="h-7 w-7 text-yellow-400" />
            Credential Vault
          </h1>
          <p className="text-slate-400 mt-1">Securely manage passwords and API keys</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
          <PlusIcon className="h-4 w-4" />
          Add Credential
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-lg border transition-colors ${
            statusFilter === 'all'
              ? 'bg-slate-700 border-brand-500'
              : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <KeyIcon className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-slate-100">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Credentials</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('healthy')}
          className={`p-4 rounded-lg border transition-colors ${
            statusFilter === 'healthy'
              ? 'bg-slate-700 border-brand-500'
              : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/10 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-brand-400">{stats.healthy}</p>
              <p className="text-xs text-slate-500">Healthy</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('expiring')}
          className={`p-4 rounded-lg border transition-colors ${
            statusFilter === 'expiring'
              ? 'bg-slate-700 border-yellow-500'
              : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <ClockIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-yellow-400">{stats.expiring}</p>
              <p className="text-xs text-slate-500">Expiring Soon</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('expired')}
          className={`p-4 rounded-lg border transition-colors ${
            statusFilter === 'expired'
              ? 'bg-slate-700 border-red-500'
              : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-red-400">{stats.expired}</p>
              <p className="text-xs text-slate-500">Expired</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search credentials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Categories</option>
          <option value="application">Applications</option>
          <option value="server">Servers</option>
          <option value="database">Databases</option>
          <option value="api">API Keys</option>
          <option value="network">Network</option>
          <option value="other">Other</option>
        </select>

        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <ListBulletIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Squares2X2Icon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Credentials List */}
      {filteredCredentials.length === 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <KeyIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No credentials found</p>
          <p className="text-sm text-slate-500 mt-1">Add your first credential to get started</p>
        </div>
      )}

      {filteredCredentials.length > 0 && viewMode === 'list' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Username</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Category</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Linked</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Last Rotated</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredCredentials.map((cred) => {
                const CategoryIcon = getCategoryIcon(cred.category)
                return (
                  <tr key={cred.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getCategoryColor(cred.category).split(' ')[0]}`}>
                          <CategoryIcon className={`h-5 w-5 ${getCategoryColor(cred.category).split(' ')[1]}`} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{cred.name}</p>
                          <p className="text-sm text-slate-500">{cred.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-slate-300 bg-slate-900 px-2 py-0.5 rounded">
                          {cred.username || '-'}
                        </code>
                        {cred.username && (
                          <button
                            onClick={() => copyToClipboard(`user-${cred.id}`, cred.username)}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {copiedId === `user-${cred.id}` ? (
                              <CheckCircleIcon className="h-4 w-4 text-brand-400" />
                            ) : (
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(cred.category)}`}>
                        {cred.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {cred.contactCount > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <UserIcon className="h-3 w-3" />
                            {cred.contactCount}
                          </span>
                        )}
                        {cred.assetCount > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <ComputerDesktopIcon className="h-3 w-3" />
                            {cred.assetCount}
                          </span>
                        )}
                        {cred.contactCount === 0 && cred.assetCount === 0 && (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-300">
                        {cred.passwordChangedAt ? new Date(cred.passwordChangedAt).toLocaleDateString() : 'Never'}
                      </p>
                    </td>
                    <td className="p-4">
                      {cred.isExpired ? (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          Expired
                        </span>
                      ) : cred.isExpiring ? (
                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                          <ClockIcon className="h-4 w-4" />
                          Expiring
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-brand-400">
                          <CheckCircleIcon className="h-4 w-4" />
                          Healthy
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => revealPassword(cred.id)}
                          disabled={revealingId === cred.id}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                          title="View password"
                        >
                          {revealedPasswords.has(cred.id) ? (
                            <EyeSlashIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyPassword(cred.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                          title="Copy password"
                        >
                          {copiedId === `pass-${cred.id}` ? (
                            <CheckCircleIcon className="h-4 w-4 text-brand-400" />
                          ) : (
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                          title="Rotate password"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
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

      {filteredCredentials.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-3 gap-4">
          {filteredCredentials.map((cred) => {
            const CategoryIcon = getCategoryIcon(cred.category)
            return (
              <div
                key={cred.id}
                className={`bg-slate-800 rounded-lg border p-4 transition-colors ${
                  cred.isExpired ? 'border-red-500/50' :
                  cred.isExpiring ? 'border-yellow-500/50' :
                  'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(cred.category).split(' ')[0]}`}>
                      <CategoryIcon className={`h-5 w-5 ${getCategoryColor(cred.category).split(' ')[1]}`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{cred.name}</p>
                      <p className="text-xs text-slate-500">{cred.description}</p>
                    </div>
                  </div>
                  {cred.isExpired ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  ) : cred.isExpiring ? (
                    <ClockIcon className="h-5 w-5 text-yellow-400" />
                  ) : null}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between bg-slate-900 rounded px-3 py-2">
                    <span className="text-xs text-slate-500">Username</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-slate-300">{cred.username || '-'}</code>
                      {cred.username && (
                        <button
                          onClick={() => copyToClipboard(`user-${cred.id}`, cred.username)}
                          className="p-1 text-slate-500 hover:text-slate-300"
                        >
                          <ClipboardDocumentIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 rounded px-3 py-2">
                    <span className="text-xs text-slate-500">Password</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-slate-300">
                        {revealedPasswords.has(cred.id) ? revealedPasswords.get(cred.id) : '••••••••'}
                      </code>
                      <button
                        onClick={() => revealPassword(cred.id)}
                        disabled={revealingId === cred.id}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-50"
                      >
                        {revealedPasswords.has(cred.id) ? (
                          <EyeSlashIcon className="h-3 w-3" />
                        ) : (
                          <EyeIcon className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => copyPassword(cred.id)}
                        className="p-1 text-slate-500 hover:text-slate-300"
                      >
                        <ClipboardDocumentIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {(cred.contactCount > 0 || cred.assetCount > 0) && (
                  <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                    {cred.contactCount > 0 && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {cred.contactCount} contacts
                      </span>
                    )}
                    {cred.assetCount > 0 && (
                      <span className="flex items-center gap-1">
                        <ComputerDesktopIcon className="h-3 w-3" />
                        {cred.assetCount} assets
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <div className="text-xs text-slate-500">
                    Rotated {cred.passwordChangedAt ? new Date(cred.passwordChangedAt).toLocaleDateString() : 'Never'}
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors">
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <LockClosedIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-400">Security Notice</p>
            <p className="text-slate-400 mt-1">
              All credentials are encrypted at rest with AES-256-GCM. Password viewing and copying is logged in the audit trail.
              Enable rotation policies to ensure credentials are regularly updated.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
