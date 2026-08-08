'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  UserIcon,
  ComputerDesktopIcon,
  TicketIcon,
  DocumentTextIcon,
  KeyIcon,
  GlobeAltIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'

export type EntityType = 'contact' | 'asset' | 'ticket' | 'credential' | 'document' | 'service' | 'kb_article'

interface Entity {
  id: string
  name: string
  subtitle?: string
  type?: string
  status?: string
  icon?: React.ElementType
}

interface LinkEntityModalProps {
  isOpen: boolean
  onClose: () => void
  onLink: (entityIds: string[]) => void
  entityType: EntityType
  sourceType: string
  sourceName: string
  existingLinks?: string[]
  allowMultiple?: boolean
}

const entityConfig: Record<EntityType, {
  title: string
  searchPlaceholder: string
  icon: React.ElementType
  color: string
}> = {
  contact: {
    title: 'Link Contact',
    searchPlaceholder: 'Search contacts by name or email...',
    icon: UserIcon,
    color: 'text-blue-400',
  },
  asset: {
    title: 'Link Asset',
    searchPlaceholder: 'Search assets by name or tag...',
    icon: ComputerDesktopIcon,
    color: 'text-purple-400',
  },
  ticket: {
    title: 'Link Ticket',
    searchPlaceholder: 'Search tickets by number or subject...',
    icon: TicketIcon,
    color: 'text-orange-400',
  },
  credential: {
    title: 'Link Credential',
    searchPlaceholder: 'Search credentials by name or service...',
    icon: KeyIcon,
    color: 'text-yellow-400',
  },
  document: {
    title: 'Link Document',
    searchPlaceholder: 'Search documents by name...',
    icon: DocumentTextIcon,
    color: 'text-brand-400',
  },
  service: {
    title: 'Link Service',
    searchPlaceholder: 'Search services by name...',
    icon: GlobeAltIcon,
    color: 'text-cyan-400',
  },
  kb_article: {
    title: 'Link Knowledge Article',
    searchPlaceholder: 'Search articles by title...',
    icon: DocumentTextIcon,
    color: 'text-pink-400',
  },
}

async function fetchEntities(entityType: EntityType, search: string, excludeIds: string[]): Promise<Entity[]> {
  const params = new URLSearchParams({ type: entityType })
  if (search) params.set('q', search)
  if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','))

  try {
    const res = await fetch(`/api/portal/search/entities?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entities || []
  } catch {
    return []
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case 'active':
    case 'assigned':
    case 'open':
    case 'published':
    case 'current':
      return 'bg-brand-500/20 text-brand-400'
    case 'pending':
    case 'available':
    case 'draft':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'inactive':
    case 'closed':
    case 'in_repair':
      return 'bg-slate-500/20 text-slate-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

export default function LinkEntityModal({
  isOpen,
  onClose,
  onLink,
  entityType,
  sourceType,
  sourceName,
  existingLinks = [],
  allowMultiple = true,
}: LinkEntityModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const config = entityConfig[entityType]
  const Icon = config.icon

  const loadEntities = useCallback(async (search: string) => {
    setLoading(true)
    const results = await fetchEntities(entityType, search, existingLinks)
    setEntities(results)
    setLoading(false)
  }, [entityType, existingLinks])

  // Load entities on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set())
      setSearchQuery('')
      loadEntities('')
    }
  }, [isOpen, loadEntities])

  // Debounced search
  useEffect(() => {
    if (!isOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadEntities(searchQuery)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, isOpen, loadEntities])

  const filteredEntities = entities

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
      }
      return next
    })
  }

  const handleLink = () => {
    onLink(Array.from(selectedIds))
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-slate-800 border border-slate-700 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-900 ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-slate-100">
                        {config.title}
                      </Dialog.Title>
                      <p className="text-sm text-slate-500">
                        Link to {sourceType}: {sourceName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-700">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <input
                      type="text"
                      placeholder={config.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Entity List */}
                <div className="max-h-80 overflow-y-auto p-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent"></div>
                    </div>
                  ) : filteredEntities.length === 0 ? (
                    <div className="text-center py-8">
                      <Icon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">
                        {searchQuery ? 'No results found' : 'No items available to link'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredEntities.map((entity) => {
                        const isSelected = selectedIds.has(entity.id)
                        return (
                          <button
                            key={entity.id}
                            onClick={() => toggleSelection(entity.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'bg-brand-500/20 border border-brand-500/50'
                                : 'bg-slate-900/50 border border-transparent hover:bg-slate-700/50'
                            }`}
                          >
                            <div className={`p-2 rounded-lg ${
                              isSelected ? 'bg-brand-500/20' : 'bg-slate-800'
                            }`}>
                              {isSelected ? (
                                <CheckIcon className="h-4 w-4 text-brand-400" />
                              ) : (
                                <Icon className={`h-4 w-4 ${config.color}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${
                                isSelected ? 'text-brand-400' : 'text-slate-200'
                              }`}>
                                {entity.name}
                              </p>
                              {entity.subtitle && (
                                <p className="text-sm text-slate-500 truncate">{entity.subtitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {entity.type && (
                                <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                  {entity.type}
                                </span>
                              )}
                              {entity.status && (
                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(entity.status)}`}>
                                  {entity.status}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-900/50">
                  <p className="text-sm text-slate-400">
                    {selectedIds.size} selected
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-slate-300 hover:text-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLink}
                      disabled={selectedIds.size === 0}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        selectedIds.size > 0
                          ? 'bg-brand-600 text-white hover:bg-brand-500'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <LinkIcon className="h-4 w-4" />
                      Link {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
