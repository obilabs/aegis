'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ComputerDesktopIcon } from '@heroicons/react/24/outline'

interface HardwareItem {
  id: string
  name: string
  asset_tag: string | null
  make: string | null
  model: string | null
}

export function MyHardwareWidget() {
  const [hardware, setHardware] = useState<HardwareItem[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/portal/dashboard/my-hardware')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d) {
          setHardware(d.hardware || [])
          setTotal(d.total || 0)
        }
      })
      .catch(() => {})
  }, [])

  if (total === 0) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <ComputerDesktopIcon className="h-5 w-5 text-orange-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-100">My Hardware</h3>
      </div>
      <div className="space-y-2">
        {hardware.slice(0, 4).map((hw) => (
          <Link
            key={hw.id}
            href={`/portal/assets/${hw.id}`}
            className="flex items-center justify-between gap-2 group"
          >
            <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors truncate">
              {hw.name}
              {hw.make && hw.model && (
                <span className="text-slate-500 ml-1">({hw.make} {hw.model})</span>
              )}
            </span>
            {hw.asset_tag && (
              <span className="text-xs text-slate-500 flex-shrink-0 font-mono">{hw.asset_tag}</span>
            )}
          </Link>
        ))}
        {total > 4 && (
          <Link
            href="/portal/assets"
            className="block text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            +{total - 4} more
          </Link>
        )}
      </div>
    </div>
  )
}
