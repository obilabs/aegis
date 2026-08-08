'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface PolicyRow {
  id: string
  title: string
  slug: string
  tags: string[]
  version: number
  updated_at: string
  total_users: number
  acknowledged_count: number
  percentage: number
}

interface ComplianceData {
  policies: PolicyRow[]
  total_users: number
  total_policies: number
  overall_percentage: number
}

export default function ComplianceReportPage() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/reports/compliance')
      .then(res => {
        if (res.status === 403) throw new Error('You do not have permission to view reports.')
        if (!res.ok) throw new Error('Failed to load compliance report.')
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-300">{error}</h2>
        <Link href="/portal/dashboard" className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  if (!data || data.total_policies === 0) {
    return (
      <div className="text-center py-16">
        <ShieldCheckIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-300">No policies found</h2>
        <p className="text-sm text-slate-500 mt-1">Policy articles will appear here once created.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Compliance Report</h1>
          <p className="text-slate-400 mt-1">Policy acknowledgment status across your organization</p>
        </div>
        <a
          href="/api/portal/reports/compliance/export"
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:border-slate-600 hover:text-white transition-colors text-sm"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <p className="text-sm text-slate-400">Overall Compliance</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{data.overall_percentage}%</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${data.overall_percentage >= 80 ? 'bg-brand-500' : data.overall_percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${data.overall_percentage}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <p className="text-sm text-slate-400">Total Policies</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{data.total_policies}</p>
          <p className="text-xs text-slate-500 mt-2">Requiring acknowledgment</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <p className="text-sm text-slate-400">Active Users</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{data.total_users}</p>
          <p className="text-xs text-slate-500 mt-2">Expected to acknowledge</p>
        </div>
      </div>

      {/* Policy Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Policy</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Frameworks</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Acknowledged</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Compliance</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {data.policies.map((policy) => (
              <tr key={policy.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-3 px-4">
                  <p className="text-slate-200 font-medium">{policy.title}</p>
                  <p className="text-xs text-slate-500">v{policy.version}</p>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {policy.tags.filter(t => ['nist-csf', 'soc2', 'hipaa', 'pci-dss', 'itil4'].includes(t)).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                        {tag.toUpperCase().replace('-', ' ')}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-slate-200">
                    {policy.acknowledged_count} / {policy.total_users}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {policy.percentage >= 80 ? (
                      <CheckCircleIcon className="h-4 w-4 text-brand-400" />
                    ) : policy.percentage >= 50 ? (
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-400" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
                    )}
                    <div className="w-20 bg-slate-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${policy.percentage >= 80 ? 'bg-brand-500' : policy.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${policy.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{policy.percentage}%</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-500 text-xs">
                  {new Date(policy.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
