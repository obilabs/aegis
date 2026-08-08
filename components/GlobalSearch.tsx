'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  name: string
  subtitle?: string
  type?: string
  status?: string
}

interface GroupedResults {
  tickets: SearchResult[]
  assets: SearchResult[]
  articles: SearchResult[]
}

const TYPE_CONFIG = {
  tickets: { label: 'Tickets', path: '/portal/tickets' },
  assets: { label: 'Assets', path: '/portal/assets' },
  articles: { label: 'Knowledge Base', path: '/portal/kb/articles' },
} as const

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GroupedResults>({ tickets: [], assets: [], articles: [] })
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const allResults = [...results.tickets, ...results.assets, ...results.articles]

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ tickets: [], assets: [], articles: [] })
      setOpen(false)
      return
    }

    setLoading(true)
    try {
      const [ticketRes, assetRes, articleRes] = await Promise.all([
        fetch(`/api/portal/search/entities?type=ticket&q=${encodeURIComponent(q)}&limit=5`),
        fetch(`/api/portal/search/entities?type=asset&q=${encodeURIComponent(q)}&limit=5`),
        fetch(`/api/portal/search/entities?type=kb_article&q=${encodeURIComponent(q)}&limit=5`),
      ])

      const [tickets, assets, articles] = await Promise.all([
        ticketRes.ok ? ticketRes.json() : { entities: [] },
        assetRes.ok ? assetRes.json() : { entities: [] },
        articleRes.ok ? articleRes.json() : { entities: [] },
      ])

      const grouped = {
        tickets: tickets.entities || [],
        assets: assets.entities || [],
        articles: articles.entities || [],
      }

      setResults(grouped)
      setSelectedIndex(-1)
      setOpen(grouped.tickets.length > 0 || grouped.assets.length > 0 || grouped.articles.length > 0)
    } catch {
      setResults({ tickets: [], assets: [], articles: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const navigateTo = (group: keyof typeof TYPE_CONFIG, item: SearchResult) => {
    const basePath = TYPE_CONFIG[group].path
    router.push(`${basePath}/${item.id}`)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }

    if (!open || allResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % allResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + allResults.length) % allResults.length)
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      const item = allResults[selectedIndex]
      let offset = 0
      for (const [key, items] of Object.entries(results)) {
        if (selectedIndex < offset + items.length) {
          navigateTo(key as keyof typeof TYPE_CONFIG, item)
          return
        }
        offset += items.length
      }
    }
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [])

  let flatIndex = -1

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (allResults.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Search tickets, assets, KB..."
          className="w-64 px-4 py-1.5 pl-10 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 w-96 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 z-50 overflow-hidden max-h-96 overflow-y-auto">
          {(Object.entries(results) as [keyof typeof TYPE_CONFIG, SearchResult[]][]).map(([group, items]) => {
            if (items.length === 0) return null
            return (
              <div key={group}>
                <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-800/80 sticky top-0">
                  {TYPE_CONFIG[group].label}
                </div>
                {items.map((item) => {
                  flatIndex++
                  const idx = flatIndex
                  return (
                    <button
                      key={`${group}-${item.id}`}
                      onClick={() => navigateTo(group, item)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors ${
                        idx === selectedIndex
                          ? 'bg-brand-500/20 text-white'
                          : 'text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        {item.subtitle && (
                          <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                        )}
                      </div>
                      {item.status && (
                        <span className="shrink-0 text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
                          {item.status}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {allResults.length === 0 && !loading && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
