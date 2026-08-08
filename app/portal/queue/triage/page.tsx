'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface QueueStats {
  actionStateCounts: Record<string, number>
  statusCounts: Record<string, number>
  avgScore: number | null
  unassignedCount: number
  slaBreachCount: number
  totalOpen: number
  avgAgentActionAgeHours: number | null
}

const ACTION_STATE_LABELS: Record<string, string> = {
  new_unreviewed: 'New / Unreviewed',
  needs_agent_action: 'Needs Agent Action',
  needs_more_info: 'Needs More Info',
  escalation_needed: 'Escalation Needed',
  waiting_on_user: 'Waiting on User',
  user_will_follow_up: 'User Will Follow Up',
  waiting_on_vendor: 'Waiting on Vendor',
  waiting_on_internal: 'Waiting on Internal',
  waiting_on_approval: 'Waiting on Approval',
  waiting_on_parts: 'Waiting on Parts',
  scheduled: 'Scheduled',
  on_hold: 'On Hold',
  resolution_candidate: 'Resolution Candidate',
}

const ACTION_STATE_COLORS: Record<string, string> = {
  needs_agent_action: 'bg-red-500',
  escalation_needed: 'bg-orange-500',
  needs_more_info: 'bg-amber-500',
  new_unreviewed: 'bg-blue-500',
  waiting_on_user: 'bg-yellow-500',
  user_will_follow_up: 'bg-slate-400',
  waiting_on_vendor: 'bg-slate-500',
  waiting_on_internal: 'bg-purple-500',
  waiting_on_approval: 'bg-yellow-600',
  waiting_on_parts: 'bg-slate-600',
  scheduled: 'bg-slate-700',
  on_hold: 'bg-slate-700',
  resolution_candidate: 'bg-brand-500',
}

function MetricCard({
  label,
  value,
  color = 'text-white',
  subtitle,
}: {
  label: string
  value: string | number
  color?: string
  subtitle?: string
}) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  )
}

export default function TriageDashboardPage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/portal/queue/stats')
        if (res.ok) {
          setStats(await res.json())
        }
      } catch (error) {
        console.error('Failed to fetch queue stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-16 text-slate-400">
        Failed to load triage dashboard.
      </div>
    )
  }

  // Sort action states by count descending
  const sortedStates = Object.entries(stats.actionStateCounts)
    .sort(([, a], [, b]) => b - a)

  const totalScored = sortedStates.reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Triage Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm">Queue health and scoring overview</p>
        </div>
        <Link
          href="/portal/queue"
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors"
        >
          Back to Queue
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Total Open"
          value={stats.totalOpen}
        />
        <MetricCard
          label="Unassigned"
          value={stats.unassignedCount}
          color={stats.unassignedCount > 0 ? 'text-amber-400' : 'text-white'}
        />
        <MetricCard
          label="SLA Breaches"
          value={stats.slaBreachCount}
          color={stats.slaBreachCount > 0 ? 'text-red-400' : 'text-brand-400'}
        />
        <MetricCard
          label="Avg Score"
          value={stats.avgScore !== null ? stats.avgScore.toFixed(1) : '--'}
        />
        <MetricCard
          label="Needs Action"
          value={stats.actionStateCounts.needs_agent_action || 0}
          color="text-red-400"
          subtitle={
            stats.avgAgentActionAgeHours !== null
              ? `Avg age: ${stats.avgAgentActionAgeHours.toFixed(1)}h`
              : undefined
          }
        />
        <MetricCard
          label="Escalations"
          value={stats.actionStateCounts.escalation_needed || 0}
          color={
            (stats.actionStateCounts.escalation_needed || 0) > 0
              ? 'text-orange-400'
              : 'text-white'
          }
        />
        <MetricCard
          label="New / Unreviewed"
          value={stats.actionStateCounts.new_unreviewed || 0}
          color="text-blue-400"
        />
        <MetricCard
          label="Resolution Candidates"
          value={stats.actionStateCounts.resolution_candidate || 0}
          color="text-brand-400"
        />
      </div>

      {/* Action state breakdown */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Tickets by Action State</h3>
        <div className="space-y-2">
          {sortedStates.map(([state, count]) => {
            const pct = totalScored > 0 ? (count / totalScored) * 100 : 0
            return (
              <div key={state} className="flex items-center gap-3">
                <div className="w-40 text-xs text-slate-400 truncate">
                  {ACTION_STATE_LABELS[state] || state}
                </div>
                <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ACTION_STATE_COLORS[state] || 'bg-slate-600'}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <div className="w-12 text-xs text-slate-400 text-right font-mono">
                  {count}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">By Status</h3>
        <div className="flex gap-4">
          {Object.entries(stats.statusCounts).map(([status, count]) => (
            <div key={status} className="text-center">
              <div className="text-lg font-bold text-white">{count}</div>
              <div className="text-xs text-slate-500 capitalize">{status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
