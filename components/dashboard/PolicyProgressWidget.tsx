'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'

interface PolicyProgress {
  total: number
  acknowledged: number
  percentage: number
  unacknowledged: { title: string; slug: string; category_slug: string }[]
}

export function PolicyProgressWidget() {
  const [data, setData] = useState<PolicyProgress | null>(null)

  useEffect(() => {
    fetch('/api/portal/dashboard/policy-progress')
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d && d.total > 0) setData(d) })
      .catch(() => {})
  }, [])

  if (!data || data.total === 0) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Policy Review</h3>
            <p className="text-xs text-slate-500">
              {data.acknowledged} of {data.total} policies reviewed
            </p>
          </div>
        </div>
        <span className="text-lg font-bold text-slate-100">{data.percentage}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            data.percentage === 100 ? 'bg-brand-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${data.percentage}%` }}
        />
      </div>
      {data.percentage < 100 && data.unacknowledged.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Pending review:</p>
          {data.unacknowledged.slice(0, 3).map((policy) => (
            <Link
              key={policy.slug}
              href={`/portal/kb/${policy.category_slug}/${policy.slug}`}
              className="block text-xs text-indigo-400 hover:text-indigo-300 transition-colors truncate"
            >
              {policy.title}
            </Link>
          ))}
          {data.unacknowledged.length > 3 && (
            <Link
              href="/portal/kb/policies-procedures"
              className="block text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              +{data.unacknowledged.length - 3} more
            </Link>
          )}
        </div>
      )}
      {data.percentage === 100 && (
        <p className="text-xs text-brand-400">All policies reviewed — you're up to date!</p>
      )}
    </div>
  )
}
