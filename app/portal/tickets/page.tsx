'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Ticket {
  id: string
  ticket_number: number
  prefix: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
  status_color: string
  category: string
  created_at: string
  updated_at: string
  assigned_to_name?: string
  contact_name?: string
  contact_is_deleted?: boolean
}

type FilterStatus = 'all' | string
type FilterPriority = 'all' | 'critical' | 'high' | 'medium' | 'low'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery])

  async function fetchTickets() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (priorityFilter !== 'all') params.set('priority', priorityFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/portal/tickets?${params}`)
      if (!res.ok) throw new Error('Failed to fetch tickets')

      const data = await res.json()
      setTickets(data.tickets || [])
      setStatusCounts(data.statusCounts || {})
      setCategoryCounts(data.categoryCounts || {})
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching tickets:', error)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getStatusColor = (status: string, color?: string) => {
    if (color) {
      return `bg-[${color}]/20 text-[${color}]`
    }
    switch (status) {
      case 'Open': return 'bg-blue-500/20 text-blue-400'
      case 'In Progress': return 'bg-purple-500/20 text-purple-400'
      case 'Waiting on Customer': return 'bg-amber-500/20 text-amber-400'
      case 'Resolved': return 'bg-brand-500/20 text-brand-400'
      case 'Closed': return 'bg-slate-600/20 text-slate-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const allCount = Object.values(statusCounts).reduce((a, b) => a + b, 0)

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
          <h1 className="text-2xl font-bold text-white">Tickets</h1>
          <p className="text-slate-400 mt-1">Manage support requests and incidents</p>
        </div>
        <Link
          href="/portal/tickets/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Ticket
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            categoryFilter === 'all'
              ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent'
          }`}
        >
          All Tickets
          <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
            {Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
          </span>
        </button>
        {Object.entries(categoryCounts).map(([name, count]) => (
          <button
            key={name}
            onClick={() => setCategoryFilter(name)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === name
                ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-transparent'
            }`}
          >
            {name}
            <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="all">All ({allCount})</option>
              {Object.entries(statusCounts).map(([name, count]) => (
                <option key={name} value={name}>{name} ({count})</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as FilterPriority)}
              className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Assigned
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/portal/tickets/${ticket.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-500">#{ticket.ticket_number}</span>
                      </div>
                      <p className="text-sm font-medium text-white mt-1 hover:text-brand-400 transition-colors">
                        {ticket.subject}
                      </p>
                      {ticket.contact_name && ticket.contact_name.trim() && (
                        <p className="text-xs text-slate-500 mt-1">
                          {ticket.contact_name}
                          {ticket.contact_is_deleted && <span className="text-red-400/60 ml-1">(Deleted)</span>}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(ticket.status)}`}>
                      {ticket.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-400">{ticket.category || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {ticket.assigned_to_name ? (
                      <span className="text-sm text-slate-300">{ticket.assigned_to_name}</span>
                    ) : (
                      <span className="text-sm text-slate-600">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{formatDate(ticket.updated_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tickets.length === 0 && (
          <div className="p-12 text-center">
            <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
            </svg>
            <p className="text-slate-400">No tickets found</p>
            <p className="text-sm text-slate-600 mt-1">Try adjusting your filters or create a new ticket</p>
          </div>
        )}
      </div>
    </div>
  )
}
