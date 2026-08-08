'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Totals {
  total: number
  open: number
  in_progress: number
  closed: number
  avg_resolution_hours: number | null
}

interface BreakdownRow {
  status?: string
  mapped_state?: string
  color?: string
  priority?: string
  type?: string
  count: number
}

interface TrendRow {
  date: string
  created: number
  resolved: number
}

interface ReportData {
  period: { from: string; to: string }
  totals: Totals
  byStatus: BreakdownRow[]
  byPriority: BreakdownRow[]
  byType: BreakdownRow[]
  dailyTrend: TrendRow[]
}

export default function TicketSummaryPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/portal/reports/ticket-summary?from=${from}&to=${to}`)
      .then(res => res.json())
      .then(json => setData(json.report))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [from, to])

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-amber-500/20 text-amber-400',
    medium: 'bg-blue-500/20 text-blue-400',
    low: 'bg-slate-500/20 text-slate-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <Link href="/portal/reports" className="hover:text-slate-200">Reports</Link>
            <span>/</span>
            <span className="text-slate-200">Ticket Summary</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Ticket Summary</h1>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Total Tickets</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">{data.totals.total}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Open</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{data.totals.open}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">In Progress</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{data.totals.in_progress}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Closed</p>
              <p className="text-3xl font-bold text-brand-400 mt-1">{data.totals.closed}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Avg Resolution</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">
                {data.totals.avg_resolution_hours != null ? `${data.totals.avg_resolution_hours}h` : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Status */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">By Status</h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {data.byStatus.map((row) => (
                  <div key={row.status} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {row.color && (
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                      )}
                      <span className="text-sm text-slate-300">{row.status}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-200">{row.count}</span>
                  </div>
                ))}
                {data.byStatus.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No data</p>
                )}
              </div>
            </div>

            {/* By Priority */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">By Priority</h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {data.byPriority.map((row) => (
                  <div key={row.priority} className="px-4 py-3 flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[row.priority || ''] || 'bg-slate-700 text-slate-400'}`}>
                      {row.priority}
                    </span>
                    <span className="text-sm font-medium text-slate-200">{row.count}</span>
                  </div>
                ))}
                {data.byPriority.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No data</p>
                )}
              </div>
            </div>

            {/* By Type */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">By Type</h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {data.byType.map((row) => (
                  <div key={row.type} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-300">{row.type}</span>
                    <span className="text-sm font-medium text-slate-200">{row.count}</span>
                  </div>
                ))}
                {data.byType.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No data</p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          {data.dailyTrend.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">Daily Trend</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-4 text-slate-400 font-medium">Date</th>
                      <th className="text-right py-2 px-4 text-slate-400 font-medium">Created</th>
                      <th className="text-right py-2 px-4 text-slate-400 font-medium">Resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data.dailyTrend.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-700/30">
                        <td className="py-2 px-4 text-slate-300">
                          {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-200">{row.created}</td>
                        <td className="py-2 px-4 text-right text-brand-400">{row.resolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
