'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export type LinkableType = 'asset' | 'ticket' | 'kb_article' | 'document'

export interface LinkedItem {
  id: string
  name: string
  subtitle?: string
  type?: string
  status?: string
  linkType?: string
  entityType: LinkableType
}

interface LinkItemsProps {
  ticketId?: string          // If provided, uses the links API for persistence
  allowedTypes?: LinkableType[]
  linkedItems?: LinkedItem[] // Externally controlled linked items (for creation form)
  onLink?: (item: LinkedItem) => void
  onUnlink?: (item: LinkedItem) => void
  readOnly?: boolean
  compact?: boolean          // Smaller display for sidebar
}

const TYPE_CONFIG: Record<LinkableType, { label: string; icon: string; color: string }> = {
  asset: { label: 'Assets', icon: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25', color: 'text-blue-400' },
  ticket: { label: 'Tickets', icon: 'M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z', color: 'text-purple-400' },
  kb_article: { label: 'KB Articles', icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25', color: 'text-brand-400' },
  document: { label: 'Documents', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z', color: 'text-amber-400' },
}

interface SearchResult {
  id: string
  name: string
  subtitle?: string
  type?: string
  status?: string
}

export function LinkItems({
  ticketId,
  allowedTypes = ['asset', 'ticket', 'kb_article', 'document'],
  linkedItems: externalItems,
  onLink,
  onUnlink,
  readOnly = false,
  compact = false,
}: LinkItemsProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<LinkableType>(allowedTypes[0])
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [items, setItems] = useState<LinkedItem[]>(externalItems || [])
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Sync external items
  useEffect(() => {
    if (externalItems) setItems(externalItems)
  }, [externalItems])

  // Load existing links when ticketId is provided
  useEffect(() => {
    if (!ticketId) return
    fetch(`/api/portal/tickets/${ticketId}/links`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        const loaded: LinkedItem[] = []
        for (const a of data.assets || []) {
          loaded.push({ id: a.id, name: a.name, subtitle: a.asset_tag, type: a.type_name, status: a.status, entityType: 'asset' })
        }
        for (const t of data.tickets || []) {
          loaded.push({ id: t.id, name: `${t.prefix || ''}${t.ticket_number}`, subtitle: t.subject, type: t.type_name, status: t.status, linkType: t.relation_type, entityType: 'ticket' })
        }
        for (const k of data.kb_articles || []) {
          loaded.push({ id: k.id, name: k.title, subtitle: k.category_name, linkType: k.link_type, entityType: 'kb_article' })
        }
        for (const d of data.documents || []) {
          loaded.push({ id: d.id, name: d.title, subtitle: d.document_type, type: d.version, status: d.status, linkType: d.link_type, entityType: 'document' })
        }
        setItems(loaded)
      })
      .catch(() => {})
  }, [ticketId])

  // Debounced search
  const doSearch = useCallback((query: string, type: LinkableType) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const excludeIds = items.filter(i => i.entityType === type).map(i => i.id).join(',')
        const params = new URLSearchParams({ type, q: query, limit: '5' })
        if (excludeIds) params.set('exclude', excludeIds)
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
  }, [items])

  useEffect(() => {
    doSearch(searchQuery, searchType)
  }, [searchQuery, searchType, doSearch])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleLink = async (result: SearchResult) => {
    const newItem: LinkedItem = {
      id: result.id,
      name: result.name,
      subtitle: result.subtitle,
      type: result.type,
      status: result.status,
      entityType: searchType,
    }

    // Optimistic update
    setItems(prev => [...prev, newItem])
    setResults(prev => prev.filter(r => r.id !== result.id))

    // Persist if ticket exists
    if (ticketId) {
      try {
        const res = await fetch(`/api/portal/tickets/${ticketId}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType: searchType, targetId: result.id }),
        })
        if (!res.ok) {
          // Rollback on failure
          setItems(prev => prev.filter(i => i.id !== result.id || i.entityType !== searchType))
        }
      } catch {
        setItems(prev => prev.filter(i => i.id !== result.id || i.entityType !== searchType))
      }
    }

    onLink?.(newItem)
  }

  const handleUnlink = async (item: LinkedItem) => {
    // Optimistic update
    setItems(prev => prev.filter(i => !(i.id === item.id && i.entityType === item.entityType)))

    // Persist if ticket exists
    if (ticketId) {
      try {
        const res = await fetch(`/api/portal/tickets/${ticketId}/links`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType: item.entityType, targetId: item.id }),
        })
        if (!res.ok) {
          // Rollback on failure
          setItems(prev => [...prev, item])
        }
      } catch {
        setItems(prev => [...prev, item])
      }
    }

    onUnlink?.(item)
  }

  // Group items by type
  const grouped = allowedTypes.reduce((acc, type) => {
    acc[type] = items.filter(i => i.entityType === type)
    return acc
  }, {} as Record<LinkableType, LinkedItem[]>)

  const hasAnyItems = items.length > 0

  return (
    <div className="space-y-2">
      {/* Linked items display */}
      {hasAnyItems && (
        <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
          {allowedTypes.map(type => {
            const typeItems = grouped[type]
            if (!typeItems?.length) return null
            const config = TYPE_CONFIG[type]
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TypeIcon path={config.icon} className={`h-3.5 w-3.5 ${config.color}`} />
                  <span className="text-xs font-medium text-slate-400">{config.label}</span>
                  <span className="text-xs text-slate-600">({typeItems.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {typeItems.map(item => (
                    <span
                      key={`${item.entityType}-${item.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-slate-300"
                    >
                      <span className="truncate max-w-[160px]">{item.name}</span>
                      {item.subtitle && (
                        <span className="text-slate-500 truncate max-w-[100px]">· {item.subtitle}</span>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => handleUnlink(item)}
                          className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors"
                          title="Remove link"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Link button + search popover */}
      {!readOnly && (
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-brand-400 hover:bg-slate-800 border border-slate-700 border-dashed rounded-md transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Link item
          </button>

          {open && (
            <div className="absolute left-0 mt-1 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              {/* Type tabs */}
              <div className="flex border-b border-slate-700">
                {allowedTypes.map(type => {
                  const config = TYPE_CONFIG[type]
                  return (
                    <button
                      key={type}
                      onClick={() => { setSearchType(type); setSearchQuery(''); setResults([]) }}
                      className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                        searchType === type
                          ? 'text-brand-400 border-b-2 border-brand-400'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {config.label}
                    </button>
                  )
                })}
              </div>

              {/* Search input */}
              <div className="p-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${TYPE_CONFIG[searchType].label.toLowerCase()}...`}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-48 overflow-y-auto">
                {searching && (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">Searching...</div>
                )}
                {!searching && searchQuery && results.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">No results found</div>
                )}
                {!searching && results.map(result => (
                  <button
                    key={result.id}
                    onClick={() => handleLink(result)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700/50 transition-colors flex items-start gap-2"
                  >
                    <TypeIcon
                      path={TYPE_CONFIG[searchType].icon}
                      className={`h-4 w-4 mt-0.5 ${TYPE_CONFIG[searchType].color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-200 truncate">{result.name}</div>
                      {result.subtitle && (
                        <div className="text-xs text-slate-500 truncate">{result.subtitle}</div>
                      )}
                    </div>
                    {result.status && (
                      <span className="text-xs text-slate-500 shrink-0">{result.status}</span>
                    )}
                  </button>
                ))}
              </div>

              {!searchQuery && (
                <div className="px-3 py-4 text-center text-xs text-slate-500">
                  Type to search {TYPE_CONFIG[searchType].label.toLowerCase()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Inline SVG helpers
function TypeIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
