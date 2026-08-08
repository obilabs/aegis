'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CpuChipIcon } from '@heroicons/react/24/outline'

interface SoftwareItem {
  name: string
  source: string
  license_type: string | null
  access_level: string | null
}

export function MySoftwareWidget() {
  const [software, setSoftware] = useState<SoftwareItem[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/portal/dashboard/my-software')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d) {
          setSoftware(d.software || [])
          setTotal(d.total || 0)
        }
      })
      .catch(() => {})
  }, [])

  if (total === 0) return null

  const displayed = software.slice(0, 5)
  const remaining = total - displayed.length

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <CpuChipIcon className="h-5 w-5 text-cyan-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-100">My Software</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {displayed.map((sw, i) => (
          <span
            key={i}
            className="px-2.5 py-1 text-xs bg-slate-700 text-slate-300 rounded-md border border-slate-600"
          >
            {sw.name}
          </span>
        ))}
        {remaining > 0 && (
          <Link
            href="/portal/services"
            className="px-2.5 py-1 text-xs bg-slate-700/50 text-slate-500 rounded-md hover:text-slate-300 transition-colors"
          >
            +{remaining} more
          </Link>
        )}
      </div>
    </div>
  )
}
