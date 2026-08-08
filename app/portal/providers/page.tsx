'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Provider {
  id: string
  provider_id: string
  provider_name: string
  provider_domain?: string
  contact_email: string
  status: 'pending' | 'active' | 'suspended' | 'revoked'
  contract_type?: string
  contract_end?: string
  last_activity_at?: string
  active_users: number
  total_actions_30d: number
  access_grants: AccessGrant[]
  created_at: string
}

interface AccessGrant {
  id: string
  name: string
  permissions: string[]
  is_active: boolean
  valid_until?: string
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

  useEffect(() => {
    fetch('/api/portal/providers')
      .then(res => res.json())
      .then(data => setProviders(data.providers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-brand-500/20 text-brand-400 border-brand-500/30'
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'suspended': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'revoked': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const activeProviders = providers.filter(p => p.status === 'active')
  const totalActiveUsers = providers.reduce((sum, p) => sum + p.active_users, 0)

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
          <h1 className="text-2xl font-bold text-white">Provider Access</h1>
          <p className="text-slate-400 mt-1">Manage external MSP and partner access to your data</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Provider
        </button>
      </div>

      {/* Data Sovereignty Notice */}
      <div className="bg-gradient-to-r from-brand-500/10 to-cyan-500/10 border border-brand-500/20 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="h-6 w-6 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">You Control Your Data</h3>
            <p className="text-sm text-slate-400 mt-1">
              External providers only access what you explicitly grant. All provider actions are logged in the 
              <Link href="/portal/activity" className="text-brand-400 hover:text-brand-300 mx-1">Activity Log</Link>
              and you can revoke access instantly at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Providers</p>
          <p className="text-2xl font-bold text-white mt-1">{providers.length}</p>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Active Providers</p>
          <p className="text-2xl font-bold text-brand-400 mt-1">{activeProviders.length}</p>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Active Users</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{totalActiveUsers}</p>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Actions (30d)</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{providers.reduce((sum, p) => sum + p.total_actions_30d, 0)}</p>
        </div>
      </div>

      {/* Providers List */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {/* Provider Header */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-400">
                    {provider.provider_name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{provider.provider_name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(provider.status)}`}>
                      {provider.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                    <span>{provider.contact_email}</span>
                    {provider.provider_domain && (
                      <>
                        <span>•</span>
                        <span>{provider.provider_domain}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/portal/activity?provider=${provider.id}`}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  View Activity
                </Link>
                {provider.status === 'active' && (
                  <button className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                    Revoke Access
                  </button>
                )}
                <button
                  onClick={() => setSelectedProvider(selectedProvider?.id === provider.id ? null : provider)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className={`h-5 w-5 transition-transform ${selectedProvider?.id === provider.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Provider Details (Expanded) */}
            {selectedProvider?.id === provider.id && (
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Contract Info */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Contract Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Type</span>
                        <span className="text-slate-300 capitalize">{provider.contract_type?.replace('_', ' ') || '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Expires</span>
                        <span className="text-slate-300">{formatDate(provider.contract_end)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Added</span>
                        <span className="text-slate-300">{formatDate(provider.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Activity Stats */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Activity</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Active Users</span>
                        <span className="text-slate-300">{provider.active_users}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Actions (30d)</span>
                        <span className="text-slate-300">{provider.total_actions_30d}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Last Activity</span>
                        <span className="text-slate-300">{formatTimeAgo(provider.last_activity_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Access Grants */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Access Grants</h4>
                    <div className="space-y-2">
                      {provider.access_grants.map((grant) => (
                        <div key={grant.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${grant.is_active ? 'bg-brand-400' : 'bg-slate-600'}`}></span>
                            <span className="text-sm text-slate-300">{grant.name}</span>
                          </div>
                          <span className="text-xs text-slate-500">{grant.permissions.length} permissions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Permissions Detail */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <h4 className="text-sm font-medium text-slate-400 mb-3">Granted Permissions</h4>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(provider.access_grants.flatMap(g => g.permissions))].map((perm) => (
                      <span key={perm} className="px-2 py-1 text-xs font-mono bg-slate-800 text-slate-400 rounded">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {providers.length === 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
          <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <p className="text-slate-400">No providers configured</p>
          <p className="text-sm text-slate-600 mt-1">Add a provider to grant external access to your ITSM data</p>
        </div>
      )}
    </div>
  )
}
