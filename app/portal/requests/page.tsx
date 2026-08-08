'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface TicketRequest {
  id: string
  ticket_number: number
  prefix: string
  title: string
  type: string
  status: string
  status_color: string
  priority: string
  request_category: string
  created_at: string
  approved_at: string | null
  requester: string
  department: string
  assigned_to: string | null
}

interface CatalogRequest {
  id: string
  request_number: number
  item_name: string
  status: string
  priority: string
  created_at: string
  approved_at: string | null
  fulfilled_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  ticket_id: string | null
  requester_name: string
}

type UnifiedRequest = {
  id: string
  source: 'ticket' | 'catalog'
  number: string
  title: string
  type: string
  status: string
  statusColor: string
  priority: string
  requester: string
  created_at: string
  resolved_at: string | null
  link: string
}

const statusConfig: Record<string, { color: string; label: string }> = {
  pending_approval: { color: '#f59e0b', label: 'Pending Approval' },
  approved: { color: '#3b82f6', label: 'Approved' },
  rejected: { color: '#ef4444', label: 'Rejected' },
  fulfilled: { color: '#10b981', label: 'Fulfilled' },
  cancelled: { color: '#6b7280', label: 'Cancelled' },
}

const priorityColors: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
  critical: 'text-red-500',
}

export default function ServiceRequestsPage() {
  const [ticketRequests, setTicketRequests] = useState<TicketRequest[]>([])
  const [catalogRequests, setCatalogRequests] = useState<CatalogRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'catalog' | 'tickets'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetch('/api/portal/requests')
      .then(res => res.json())
      .then(data => {
        setTicketRequests(data.requests || [])
        setCatalogRequests(data.catalogRequests || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Unify both request types into a single list
  const unified: UnifiedRequest[] = [
    ...catalogRequests.map((r): UnifiedRequest => {
      const sc = statusConfig[r.status] || { color: '#6b7280', label: r.status }
      return {
        id: r.id,
        source: 'catalog',
        number: `REQ-${r.request_number}`,
        title: r.item_name,
        type: 'Catalog Request',
        status: sc.label,
        statusColor: sc.color,
        priority: r.priority || 'medium',
        requester: r.requester_name || '—',
        created_at: r.created_at,
        resolved_at: r.fulfilled_at || r.rejected_at || null,
        link: `/portal/requests/${r.id}`,
      }
    }),
    ...ticketRequests.map((r): UnifiedRequest => ({
      id: r.id,
      source: 'ticket',
      number: `${r.prefix}-${r.ticket_number}`,
      title: r.title,
      type: r.type || r.request_category || 'Request',
      status: r.status,
      statusColor: r.status_color || '#6b7280',
      priority: r.priority || 'medium',
      requester: r.requester || '—',
      created_at: r.created_at,
      resolved_at: r.approved_at || null,
      link: `/portal/tickets/${r.id}`,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const filtered = unified.filter(r => {
    if (activeTab === 'catalog' && r.source !== 'catalog') return false
    if (activeTab === 'tickets' && r.source !== 'ticket') return false
    if (statusFilter !== 'all' && r.status.toLowerCase().replace(/ /g, '_') !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        r.number.toLowerCase().includes(q) ||
        r.requester.toLowerCase().includes(q)
      )
    }
    return true
  })

  const catalogCount = catalogRequests.length
  const ticketCount = ticketRequests.length

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Service Requests</h1>
          <p className="text-slate-400 mt-1">Track service requests, approvals, and fulfillment</p>
        </div>
        <Link
          href="/portal/requests/catalog"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Browse Catalog
        </Link>
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {[
            { key: 'all' as const, label: 'All', count: unified.length },
            { key: 'catalog' as const, label: 'Catalog Requests', count: catalogCount },
            { key: 'tickets' as const, label: 'Ticket Requests', count: ticketCount },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.key ? 'bg-brand-500/30' : 'bg-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Request</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Requester</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Resolved</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((request) => (
                <tr key={`${request.source}-${request.id}`} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${priorityColors[request.priority] || 'text-slate-400'}`}
                           style={{ backgroundColor: 'currentColor' }} />
                      <div className="min-w-0">
                        <Link href={request.link} className="text-sm font-medium text-white hover:text-brand-400 truncate block">
                          {request.title}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">{request.number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      request.source === 'catalog'
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {request.type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-300">{request.requester}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="inline-flex px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${request.statusColor}20`,
                        color: request.statusColor,
                      }}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-500">{formatDate(request.created_at)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-500">
                      {request.resolved_at ? formatDate(request.resolved_at) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={request.link}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors inline-flex"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-slate-300">No requests found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {unified.length === 0
                ? 'Submit your first request from the service catalog.'
                : 'Try adjusting your search or filters.'}
            </p>
            {unified.length === 0 && (
              <Link
                href="/portal/requests/catalog"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
              >
                Browse Catalog
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
