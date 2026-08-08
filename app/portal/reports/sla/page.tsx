'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface SLAReport {
  period: { from: string; to: string }
  response: { met: number; breached: number; total: number; percentage: number | null }
  resolution: { met: number; breached: number; currentlyBreached: number; total: number; percentage: number | null }
  byPriority: { priority: string; total: number; breached: number; avg_hours: number | null }[]
  recentBreaches: {
    id: string; subject: string; priority: string; created_at: string
    sla_resolution_due_at: string | null; sla_resolved_at: string | null; assigned_to_name: string | null
  }[]
}

export default function SLAReportPage() {
  const [data, setData] = useState<SLAReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/portal/reports/sla?from=${from}&to=${to}`)
      .then(res => res.json())
      .then(json => setData(json.report))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [from, to])

  const priorityColors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-amber-400',
    medium: 'text-blue-400',
    low: 'text-slate-400',
  }

  function complianceColor(pct: number | null): string {
    if (pct == null) return 'text-slate-500'
    if (pct >= 95) return 'text-brand-400'
    if (pct >= 80) return 'text-amber-400'
    return 'text-red-400'
  }

  function complianceBarColor(pct: number | null): string {
    if (pct == null) return 'bg-slate-700'
    if (pct >= 95) return 'bg-brand-500'
    if (pct >= 80) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <Link href="/portal/reports" className="hover:text-slate-200">Reports</Link>
            <span>/</span>
            <span className="text-slate-200">SLA Compliance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">SLA Compliance</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : data ? (
        <>
          {/* Compliance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Response SLA */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">First Response SLA</h3>
              <div className="mt-3 flex items-end gap-3">
                <span className={`text-4xl font-bold ${complianceColor(data.response.percentage)}`}>
                  {data.response.percentage != null ? `${data.response.percentage}%` : '—'}
                </span>
                <span className="text-sm text-slate-500 pb-1">
                  {data.response.met} met / {data.response.breached} breached
                </span>
              </div>
              <div className="mt-3 w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${complianceBarColor(data.response.percentage)}`}
                  style={{ width: `${data.response.percentage || 0}%` }}
                />
              </div>
            </div>

            {/* Resolution SLA */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Resolution SLA</h3>
              <div className="mt-3 flex items-end gap-3">
                <span className={`text-4xl font-bold ${complianceColor(data.resolution.percentage)}`}>
                  {data.resolution.percentage != null ? `${data.resolution.percentage}%` : '—'}
                </span>
                <span className="text-sm text-slate-500 pb-1">
                  {data.resolution.met} met / {data.resolution.breached} breached
                </span>
              </div>
              <div className="mt-3 w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${complianceBarColor(data.resolution.percentage)}`}
                  style={{ width: `${data.resolution.percentage || 0}%` }}
                />
              </div>
              {data.resolution.currentlyBreached > 0 && (
                <p className="mt-2 text-xs text-red-400">
                  {data.resolution.currentlyBreached} currently breached
                </p>
              )}
            </div>
          </div>

          {/* By Priority */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-200">Breakdown by Priority</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-4 text-slate-400 font-medium">Priority</th>
                  <th className="text-right py-2 px-4 text-slate-400 font-medium">Total w/ SLA</th>
                  <th className="text-right py-2 px-4 text-slate-400 font-medium">Breached</th>
                  <th className="text-right py-2 px-4 text-slate-400 font-medium">Compliance</th>
                  <th className="text-right py-2 px-4 text-slate-400 font-medium">Avg Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.byPriority.map((row) => {
                  const pct = row.total > 0 ? Math.round(((row.total - row.breached) / row.total) * 100) : null
                  return (
                    <tr key={row.priority} className="hover:bg-slate-700/30">
                      <td className={`py-2 px-4 font-medium capitalize ${priorityColors[row.priority] || 'text-slate-300'}`}>
                        {row.priority}
                      </td>
                      <td className="py-2 px-4 text-right text-slate-200">{row.total}</td>
                      <td className="py-2 px-4 text-right text-red-400">{row.breached}</td>
                      <td className={`py-2 px-4 text-right font-medium ${complianceColor(pct)}`}>
                        {pct != null ? `${pct}%` : '—'}
                      </td>
                      <td className="py-2 px-4 text-right text-slate-300">
                        {row.avg_hours != null ? `${row.avg_hours}h` : '—'}
                      </td>
                    </tr>
                  )
                })}
                {data.byPriority.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-500">No SLA data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Breaches */}
          {data.recentBreaches.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">Recent Breaches</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-4 text-slate-400 font-medium">Ticket</th>
                    <th className="text-left py-2 px-4 text-slate-400 font-medium">Priority</th>
                    <th className="text-left py-2 px-4 text-slate-400 font-medium">Assigned To</th>
                    <th className="text-left py-2 px-4 text-slate-400 font-medium">Due</th>
                    <th className="text-left py-2 px-4 text-slate-400 font-medium">Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.recentBreaches.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-700/30">
                      <td className="py-2 px-4">
                        <Link href={`/portal/tickets/${ticket.id}`} className="text-brand-400 hover:text-brand-300">
                          {ticket.subject}
                        </Link>
                      </td>
                      <td className={`py-2 px-4 capitalize ${priorityColors[ticket.priority] || 'text-slate-300'}`}>
                        {ticket.priority}
                      </td>
                      <td className="py-2 px-4 text-slate-300">{ticket.assigned_to_name || 'Unassigned'}</td>
                      <td className="py-2 px-4 text-slate-400 text-xs">
                        {ticket.sla_resolution_due_at
                          ? new Date(ticket.sla_resolution_due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="py-2 px-4 text-slate-400 text-xs">
                        {ticket.sla_resolved_at
                          ? new Date(ticket.sla_resolved_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                          : 'Still open'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-slate-400">Failed to load report data.</p>
        </div>
      )}
    </div>
  )
}
