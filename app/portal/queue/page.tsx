'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

interface QueueTicket {
  id: string
  ticketNumber: number
  prefix: string
  subject: string
  priority: string
  assignedTo: string | null
  assignedName: string | null
  contactName: string | null
  contactIsDeleted: boolean
  createdAt: string
  updatedAt: string
  firstViewedAt: string | null
  status: {
    name: string
    color: string
    baseStatus: string
    slaPaused: boolean
  }
  typeName: string | null
  queue: {
    actionState: string
    confidence: number | null
    baseScore: number
    assignmentBoost: number
    effectiveScore: number
    reasoning: string | null
    scoredAt: string | null
    scoredBy: string | null
  }
  sla: {
    breached: boolean
    pausedAt: string | null
    totalPausedSeconds: number
    firstResponseDueAt: string | null
    resolutionDueAt: string | null
    targetResponseMinutes: number | null
    targetResolutionMinutes: number | null
  }
  section: string
}

interface QueueData {
  mine: QueueTicket[]
  team: QueueTicket[]
  unassigned: QueueTicket[]
  other: QueueTicket[]
  permissions: {
    ticketAccess: string
    canTriage: boolean
    isAdmin: boolean
  }
}

// ─── Action State Display ────────────────────────────────────────────────────

const ACTION_STATE_LABELS: Record<string, string> = {
  new_unreviewed: 'New',
  needs_agent_action: 'Action Needed',
  needs_more_info: 'Needs Info',
  escalation_needed: 'Escalation',
  waiting_on_user: 'Waiting: User',
  user_will_follow_up: 'User Follow-up',
  waiting_on_vendor: 'Waiting: Vendor',
  waiting_on_internal: 'Waiting: Internal',
  waiting_on_approval: 'Waiting: Approval',
  waiting_on_parts: 'Waiting: Parts',
  scheduled: 'Scheduled',
  on_hold: 'On Hold',
  resolution_candidate: 'Resolve?',
}

const ACTION_STATE_COLORS: Record<string, string> = {
  needs_agent_action: 'bg-red-500/20 text-red-400 border-red-500/30',
  escalation_needed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  needs_more_info: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  new_unreviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting_on_user: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  user_will_follow_up: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  waiting_on_vendor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  waiting_on_internal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  waiting_on_approval: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  waiting_on_parts: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  scheduled: 'bg-slate-600/20 text-slate-500 border-slate-600/30',
  on_hold: 'bg-slate-600/20 text-slate-500 border-slate-600/30',
  resolution_candidate: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatSlaRemaining(dueAt: string | null, paused: boolean): string | null {
  if (!dueAt) return null
  if (paused) return 'PAUSED'
  const remaining = Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000)
  if (remaining <= 0) return 'BREACHED'
  if (remaining < 3600) return `${Math.floor(remaining / 60)}m`
  if (remaining < 86400) return `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`
  return `${Math.floor(remaining / 86400)}d`
}

// ─── Components ──────────────────────────────────────────────────────────────

function QueueSection({
  title,
  tickets,
  defaultOpen = true,
  actionStateFilter,
}: {
  title: string
  tickets: QueueTicket[]
  defaultOpen?: boolean
  actionStateFilter: string | null
}) {
  const [open, setOpen] = useState(defaultOpen)

  const filtered = actionStateFilter
    ? tickets.filter((t) => t.queue.actionState === actionStateFilter)
    : tickets

  if (tickets.length === 0) return null

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
            {filtered.length}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-800">
          {filtered.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  )
}

function TicketRow({ ticket }: { ticket: QueueTicket }) {
  const slaText = formatSlaRemaining(ticket.sla.resolutionDueAt, ticket.status.slaPaused)

  return (
    <Link
      href={`/portal/tickets/${ticket.id}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 last:border-b-0 hover:bg-slate-800/50 transition-colors"
    >
      {/* Priority */}
      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border uppercase ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
        {ticket.priority?.[0]}
      </span>

      {/* Ticket number + subject */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {ticket.prefix}-{ticket.ticketNumber}
          </span>
          <span className="text-sm text-slate-200 truncate">
            {ticket.subject}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {ticket.contactName && (
            <span className="text-xs text-slate-500">
              {ticket.contactName}
              {ticket.contactIsDeleted && <span className="text-red-400/60 ml-1">(Deleted)</span>}
            </span>
          )}
          {ticket.assignedName && (
            <span className="text-xs text-slate-600">→ {ticket.assignedName}</span>
          )}
          <span className="text-xs text-slate-600">{timeAgo(ticket.updatedAt)}</span>
        </div>
      </div>

      {/* Action state chip */}
      <span className={`px-2 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap ${ACTION_STATE_COLORS[ticket.queue.actionState] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
        {ACTION_STATE_LABELS[ticket.queue.actionState] || ticket.queue.actionState}
      </span>

      {/* Status */}
      <span
        className="px-2 py-0.5 text-[10px] rounded whitespace-nowrap"
        style={{
          backgroundColor: `${ticket.status.color}20`,
          color: ticket.status.color,
        }}
      >
        {ticket.status.name}
      </span>

      {/* SLA */}
      {slaText && (
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${
          slaText === 'BREACHED'
            ? 'bg-red-500/20 text-red-400'
            : slaText === 'PAUSED'
              ? 'bg-slate-600/20 text-slate-500'
              : 'bg-slate-700 text-slate-300'
        }`}>
          {slaText === 'PAUSED' ? '⏸ SLA' : slaText === 'BREACHED' ? '⚠ SLA' : `⏱ ${slaText}`}
        </span>
      )}

      {/* Score */}
      <span className="text-xs text-slate-600 font-mono w-8 text-right">
        {ticket.queue.effectiveScore}
      </span>
    </Link>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function QueuePage() {
  const [data, setData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string | null>(null)
  const [showPaused, setShowPaused] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (showPaused) params.set('show_paused', 'true')
      const res = await fetch(`/api/portal/queue?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    } finally {
      setLoading(false)
    }
  }, [showPaused])

  useEffect(() => {
    fetchQueue()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  // Refresh on tab focus
  useEffect(() => {
    const handleFocus = () => fetchQueue()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchQueue])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/portal/queue/refresh', { method: 'POST' })
      // Wait a bit for the sweep to start, then refresh view
      setTimeout(async () => {
        await fetchQueue()
        setRefreshing(false)
      }, 2000)
    } catch {
      setRefreshing(false)
    }
  }

  function getHighestScoredTicket(): QueueTicket | null {
    if (!data) return null
    const actionable = [...data.mine, ...data.unassigned]
      .filter((t) => ['needs_agent_action', 'new_unreviewed', 'needs_more_info', 'escalation_needed'].includes(t.queue.actionState))
    actionable.sort((a, b) => b.queue.effectiveScore - a.queue.effectiveScore)
    return actionable[0] || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-slate-400">
        Failed to load queue data.
      </div>
    )
  }

  const totalCount = data.mine.length + data.team.length + data.unassigned.length + data.other.length
  const allTickets = [...data.mine, ...data.team, ...data.unassigned, ...data.other]

  // Count by action state for filter chips
  const actionCounts: Record<string, number> = {}
  allTickets.forEach((t) => {
    actionCounts[t.queue.actionState] = (actionCounts[t.queue.actionState] || 0) + 1
  })

  const nextTicket = getHighestScoredTicket()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Queue</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {totalCount} open ticket{totalCount !== 1 ? 's' : ''} across your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextTicket && (
            <Link
              href={`/portal/tickets/${nextTicket.id}`}
              className="px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Work on Next
            </Link>
          )}
          {data.permissions.canTriage && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Re-score All'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActionFilter(null)}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
            !actionFilter
              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          All ({totalCount})
        </button>
        {Object.entries(actionCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([state, count]) => (
            <button
              key={state}
              onClick={() => setActionFilter(actionFilter === state ? null : state)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                actionFilter === state
                  ? ACTION_STATE_COLORS[state] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {ACTION_STATE_LABELS[state] || state} ({count})
            </button>
          ))}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showPaused}
            onChange={(e) => setShowPaused(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/20"
          />
          Show paused
        </label>
      </div>

      {/* Sections */}
      <QueueSection
        title="My Tickets"
        tickets={data.mine}
        defaultOpen={true}
        actionStateFilter={actionFilter}
      />
      <QueueSection
        title="Team"
        tickets={data.team}
        defaultOpen={true}
        actionStateFilter={actionFilter}
      />
      <QueueSection
        title="Unassigned"
        tickets={data.unassigned}
        defaultOpen={true}
        actionStateFilter={actionFilter}
      />
      <QueueSection
        title="Other"
        tickets={data.other}
        defaultOpen={false}
        actionStateFilter={actionFilter}
      />

      {totalCount === 0 && (
        <div className="text-center py-16">
          <div className="text-slate-500 text-lg mb-2">Queue is empty</div>
          <p className="text-slate-600 text-sm">No open tickets found. Great work!</p>
        </div>
      )}
    </div>
  )
}
