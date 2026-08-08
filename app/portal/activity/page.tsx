'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface AuditEntry {
  id: string
  actor_type: 'user' | 'provider_user' | 'system' | 'api'
  actor_name: string
  actor_email: string
  provider_name?: string
  action: string
  action_category: string
  entity_type: string
  entity_id: string
  entity_name?: string
  changed_fields?: string[]
  success: boolean
  actor_ip?: string
  created_at: string
}

type FilterActorType = 'all' | 'user' | 'provider_user' | 'system'
type FilterAction = 'all' | 'create' | 'read' | 'update' | 'delete' | 'login' | 'export'

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actorFilter, setActorFilter] = useState<FilterActorType>('all')
  const [actionFilter, setActionFilter] = useState<FilterAction>('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState('7d')

  useEffect(() => {
    fetch(`/api/portal/activity?days=${dateRange.replace('d', '')}`)
      .then(res => res.json())
      .then(data => setEntries(data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dateRange])

  const getActorTypeColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-500/20 text-blue-400'
      case 'provider_user': return 'bg-purple-500/20 text-purple-400'
      case 'system': return 'bg-slate-500/20 text-slate-400'
      case 'api': return 'bg-cyan-500/20 text-cyan-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getActionColor = (action: string, success: boolean) => {
    if (!success) return 'bg-red-500/20 text-red-400'
    switch (action) {
      case 'create': return 'bg-brand-500/20 text-brand-400'
      case 'update': return 'bg-amber-500/20 text-amber-400'
      case 'delete': return 'bg-red-500/20 text-red-400'
      case 'read': return 'bg-slate-500/20 text-slate-400'
      case 'login': return 'bg-blue-500/20 text-blue-400'
      case 'export': return 'bg-purple-500/20 text-purple-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      case 'update':
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
      case 'delete':
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
      case 'read':
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
      case 'login':
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
      case 'export':
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
      default:
        return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const entityTypes = ['all', ...new Set(entries.map(e => e.entity_type))]

  const filteredEntries = entries.filter(entry => {
    if (actorFilter !== 'all' && entry.actor_type !== actorFilter) return false
    if (actionFilter !== 'all' && entry.action !== actionFilter) return false
    if (entityFilter !== 'all' && entry.entity_type !== entityFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        entry.actor_name.toLowerCase().includes(query) ||
        entry.actor_email.toLowerCase().includes(query) ||
        entry.entity_name?.toLowerCase().includes(query) ||
        entry.provider_name?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const providerActionCount = entries.filter(e => e.actor_type === 'provider_user').length
  const failedActionCount = entries.filter(e => !e.success).length

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
          <h1 className="text-2xl font-bold text-white">Activity Log</h1>
          <p className="text-slate-400 mt-1">Audit trail of all system activity</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          Export Log
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Events</p>
          <p className="text-2xl font-bold text-white mt-1">{entries.length}</p>
          <p className="text-xs text-slate-500 mt-1">Last 7 days</p>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Provider Actions</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{providerActionCount}</p>
          <p className="text-xs text-slate-500 mt-1">External MSP activity</p>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Failed Actions</p>
          <p className={`text-2xl font-bold mt-1 ${failedActionCount > 0 ? 'text-red-400' : 'text-brand-400'}`}>{failedActionCount}</p>
          <p className="text-xs text-slate-500 mt-1">Access denied / errors</p>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">Unique Actors</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{new Set(entries.map(e => e.actor_email)).size}</p>
          <p className="text-xs text-slate-500 mt-1">Users & providers</p>
        </div>
      </div>

      {/* Provider Activity Alert */}
      {providerActionCount > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-300">External Provider Activity Detected</p>
              <p className="text-xs text-purple-400/70 mt-0.5">{providerActionCount} actions by MSP users in the selected period</p>
            </div>
            <Link href="/portal/providers" className="text-sm text-purple-400 hover:text-purple-300">
              Manage Access →
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by user, email, or entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>

          {/* Actor Type */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value as FilterActorType)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="all">All Actors</option>
            <option value="user">Internal Users</option>
            <option value="provider_user">Provider Users (MSP)</option>
            <option value="system">System</option>
          </select>

          {/* Action */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as FilterAction)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="all">All Actions</option>
            <option value="create">Create</option>
            <option value="read">Read</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="export">Export</option>
          </select>

          {/* Entity Type */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {entityTypes.map(type => (
              <option key={type} value={type}>{type === 'all' ? 'All Entities' : type.replace('_', ' ')}</option>
            ))}
          </select>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="divide-y divide-slate-800">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className={`px-5 py-4 hover:bg-slate-800/50 transition-colors ${!entry.success ? 'bg-red-500/5' : ''}`}>
              <div className="flex items-start gap-4">
                {/* Action Icon */}
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getActionColor(entry.action, entry.success)}`}>
                  {getActionIcon(entry.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{entry.actor_name}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getActorTypeColor(entry.actor_type)}`}>
                      {entry.actor_type === 'provider_user' ? 'MSP' : entry.actor_type}
                    </span>
                    {entry.provider_name && (
                      <span className="text-xs text-purple-400">via {entry.provider_name}</span>
                    )}
                    {!entry.success && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400">FAILED</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-slate-400 mt-1">
                    <span className="capitalize">{entry.action}</span>
                    {' '}
                    <span className="text-slate-500">{entry.entity_type.replace('_', ' ')}</span>
                    {entry.entity_name && (
                      <>
                        {' → '}
                        <span className="text-slate-300">{entry.entity_name}</span>
                      </>
                    )}
                  </p>

                  {entry.changed_fields && entry.changed_fields.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Changed: {entry.changed_fields.join(', ')}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                    <span>{entry.actor_email}</span>
                    {entry.actor_ip && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{entry.actor_ip}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div className="text-right">
                  <span className="text-xs text-slate-500">{formatTime(entry.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredEntries.length === 0 && (
          <div className="p-12 text-center">
            <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-slate-400">No activity found</p>
            <p className="text-sm text-slate-600 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
