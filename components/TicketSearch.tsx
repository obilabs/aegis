'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TicketResult {
  id: string
  name: string      // e.g., "TKT-0001"
  subtitle?: string  // subject
  type?: string      // ticket type name
  status?: string
}

interface TicketSearchProps {
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  label?: string
  placeholder?: string
  excludeIds?: string[]  // IDs to exclude from results (e.g., current ticket)
}

/**
 * Searchable ticket selector for Problem→Incident linking.
 * Displays selected tickets as removable chips and provides search.
 */
export function TicketSearch({
  selectedIds,
  onSelect,
  label = 'Link Related Incidents',
  placeholder = 'Search by ticket number or subject...',
  excludeIds = [],
}: TicketSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TicketResult[]>([])
  const [selectedTickets, setSelectedTickets] = useState<TicketResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load selected ticket details on mount
  useEffect(() => {
    if (selectedIds.length === 0) return
    const loadSelected = async () => {
      const loaded: TicketResult[] = []
      for (const id of selectedIds) {
        try {
          const res = await fetch(`/api/portal/search/entities?type=ticket&q=&limit=1&exclude=`)
          if (res.ok) {
            // Try to load by searching for the ID — fallback to showing the ID
            loaded.push({ id, name: id, subtitle: 'Loading...' })
          }
        } catch {
          loaded.push({ id, name: id })
        }
      }
      setSelectedTickets(loaded)
    }
    loadSelected()
  }, []) // Only on mount

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const allExclude = [...selectedIds, ...excludeIds].join(',')
        const params = new URLSearchParams({ type: 'ticket', q, limit: '8' })
        if (allExclude) params.set('exclude', allExclude)
        const res = await fetch(`/api/portal/search/entities?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.entities || [])
        }
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [selectedIds, excludeIds])

  useEffect(() => {
    doSearch(query)
  }, [query, doSearch])

  // Close results on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (ticket: TicketResult) => {
    const newIds = [...selectedIds, ticket.id]
    onSelect(newIds)
    setSelectedTickets(prev => [...prev, ticket])
    setResults(prev => prev.filter(r => r.id !== ticket.id))
    setQuery('')
  }

  const handleRemove = (id: string) => {
    onSelect(selectedIds.filter(sid => sid !== id))
    setSelectedTickets(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>

      {/* Selected tickets as chips */}
      {selectedTickets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTickets.map(ticket => (
            <span
              key={ticket.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-300"
            >
              <TicketIcon className="h-3 w-3" />
              <span className="font-medium">{ticket.name}</span>
              {ticket.subtitle && ticket.subtitle !== 'Loading...' && (
                <span className="text-purple-400/60 truncate max-w-[120px]">· {ticket.subtitle}</span>
              )}
              <button
                onClick={() => handleRemove(ticket.id)}
                className="ml-0.5 text-purple-400/60 hover:text-red-400 transition-colors"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowResults(true) }}
            onFocus={() => setShowResults(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Results dropdown */}
        {showResults && query.trim() && (
          <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto">
            {searching && (
              <div className="px-3 py-3 text-center text-xs text-slate-500">Searching...</div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-slate-500">No matching tickets found</div>
            )}
            {!searching && results.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => handleSelect(ticket)}
                className="w-full text-left px-3 py-2 hover:bg-slate-700/50 transition-colors flex items-center gap-2"
              >
                <TicketIcon className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{ticket.name}</span>
                    {ticket.status && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{ticket.status}</span>
                    )}
                  </div>
                  {ticket.subtitle && (
                    <div className="text-xs text-slate-500 truncate">{ticket.subtitle}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Inline SVG icons
function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}
