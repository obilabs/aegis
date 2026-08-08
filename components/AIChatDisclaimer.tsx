'use client'

import { useState, useEffect } from 'react'
import { InformationCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

export function AIChatDisclaimer() {
  const [enabled, setEnabled] = useState(false)
  const [text, setText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/portal/ai-disclaimer')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEnabled(data.enabled)
          setText(data.text)
          // Restore collapsed state from localStorage
          const stored = localStorage.getItem('ai-disclaimer-collapsed')
          if (stored === 'true') setCollapsed(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('ai-disclaimer-collapsed', String(next))
  }

  if (!loaded || !enabled) return null

  return (
    <div className="flex-shrink-0 border-b border-slate-700/50">
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-800/30 transition-colors"
      >
        <InformationCircleIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
        {collapsed ? (
          <span className="text-xs text-slate-500 flex-1 truncate">AI Disclaimer</span>
        ) : (
          <span className="text-xs text-slate-400 flex-1">{text}</span>
        )}
        {collapsed ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronUpIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
        )}
      </button>
    </div>
  )
}
