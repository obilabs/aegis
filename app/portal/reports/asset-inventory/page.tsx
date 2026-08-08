'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ReportData {
  totals: { total: number; total_value: number; warranty_expired: number; warranty_expiring: number }
  byType: { type: string; count: number; total_value: number }[]
  byStatus: { status: string; count: number }[]
  byCompany: { company: string; count: number }[]
}

export default function AssetInventoryPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/reports/asset-inventory')
      .then(res => res.json())
      .then(json => setData(json.report))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
  }

  const statusColors: Record<string, string> = {
    active: 'bg-brand-500/20 text-brand-400',
    deployed: 'bg-blue-500/20 text-blue-400',
    in_stock: 'bg-slate-500/20 text-slate-300',
    retired: 'bg-red-500/20 text-red-400',
    rma: 'bg-amber-500/20 text-amber-400',
    disposed: 'bg-slate-600/20 text-slate-500',
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
          <Link href="/portal/reports" className="hover:text-slate-200">Reports</Link>
          <span>/</span>
          <span className="text-slate-200">Asset Inventory</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Asset Inventory</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Total Assets</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">{data.totals.total}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Total Value</p>
              <p className="text-3xl font-bold text-brand-400 mt-1">{formatCurrency(Number(data.totals.total_value))}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Warranty Expiring</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{data.totals.warranty_expiring}</p>
              <p className="text-xs text-slate-500 mt-1">Within 30 days</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <p className="text-sm text-slate-400">Warranty Expired</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{data.totals.warranty_expired}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Type */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">By Type</h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {data.byType.map((row) => (
                  <div key={row.type} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-300">{row.type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{formatCurrency(Number(row.total_value))}</span>
                      <span className="text-sm font-medium text-slate-200 w-8 text-right">{row.count}</span>
                    </div>
                  </div>
                ))}
                {data.byType.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No data</p>
                )}
              </div>
            </div>

            {/* By Status */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">By Status</h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {data.byStatus.map((row) => (
                  <div key={row.status} className="px-4 py-3 flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[row.status] || 'bg-slate-700 text-slate-400'}`}>
                      {row.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium text-slate-200">{row.count}</span>
                  </div>
                ))}
                {data.byStatus.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No data</p>
                )}
              </div>
            </div>

            {/* By Company */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">By Company</h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {data.byCompany.map((row) => (
                  <div key={row.company} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-300">{row.company}</span>
                    <span className="text-sm font-medium text-slate-200">{row.count}</span>
                  </div>
                ))}
                {data.byCompany.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No data</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-slate-400">Failed to load report data.</p>
        </div>
      )}
    </div>
  )
}
