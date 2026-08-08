'use client'

import { useState, useEffect, useRef } from 'react'

interface DropdownItem {
  id: string
  name: string
  [key: string]: any
}

interface InlineCreateDropdownProps {
  /** Currently selected item ID */
  value: string | null
  /** Called when selection changes */
  onChange: (id: string | null) => void
  /** Available items for selection */
  items: DropdownItem[]
  /** Label shown above the dropdown */
  label: string
  /** Placeholder when nothing selected */
  placeholder?: string
  /** Message when no items exist */
  emptyMessage?: string
  /** Link to settings page for configuring items */
  settingsHref?: string
  /** Whether this field is required */
  required?: boolean
  /** Whether the field is disabled */
  disabled?: boolean
  /** Fields for the quick-create form */
  createFields?: CreateField[]
  /** Called to create a new item */
  onCreateNew?: (data: Record<string, string>) => Promise<DropdownItem | null>
  /** Label for the create button */
  createLabel?: string
}

interface CreateField {
  key: string
  label: string
  placeholder?: string
  required?: boolean
}

export function InlineCreateDropdown({
  value,
  onChange,
  items,
  label,
  placeholder = 'Select...',
  emptyMessage,
  settingsHref,
  required = false,
  disabled = false,
  createFields = [{ key: 'name', label: 'Name', required: true }],
  onCreateNew,
  createLabel = 'Create New',
}: InlineCreateDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [createData, setCreateData] = useState<Record<string, string>>({})
  const [createError, setCreateError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedItem = items.find(i => i.id === value)
  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  async function handleCreate() {
    if (!onCreateNew) return
    const missingRequired = createFields.filter(
      f => f.required && !createData[f.key]?.trim()
    )
    if (missingRequired.length > 0) {
      setCreateError(`${missingRequired[0].label} is required`)
      return
    }

    setSubmitting(true)
    setCreateError('')
    try {
      const newItem = await onCreateNew(createData)
      if (newItem) {
        onChange(newItem.id)
        setCreating(false)
        setCreateData({})
        setOpen(false)
        setSearch('')
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
          disabled
            ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed'
            : open
              ? 'bg-slate-800 border-brand-500 text-white'
              : 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
        }`}
      >
        <span className={selectedItem ? 'text-white' : 'text-slate-500'}>
          {selectedItem?.name || placeholder}
        </span>
        <ChevronIcon
          className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-hidden">
          {/* Search input */}
          {items.length > 5 && (
            <div className="p-2 border-b border-slate-700">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-2.5 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {/* Items list */}
          <div className="overflow-y-auto max-h-44">
            {items.length === 0 && !creating ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-slate-400">
                  {emptyMessage || `No ${label.toLowerCase()}s configured yet.`}
                </p>
                {settingsHref && (
                  <a
                    href={settingsHref}
                    className="text-sm text-brand-400 hover:text-brand-300 mt-1 inline-block"
                  >
                    Configure in Settings
                  </a>
                )}
              </div>
            ) : (
              <>
                {/* Clear selection option */}
                {value && !required && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null)
                      setOpen(false)
                      setSearch('')
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 italic"
                  >
                    Clear selection
                  </button>
                )}

                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      item.id === value
                        ? 'bg-brand-500/10 text-brand-400'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}

                {search && filtered.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    No matches found
                  </div>
                )}
              </>
            )}
          </div>

          {/* Create new section */}
          {onCreateNew && (
            <div className="border-t border-slate-700">
              {!creating ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true)
                    setCreateError('')
                    // Pre-fill name from search text
                    if (search) {
                      setCreateData({ name: search })
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-brand-400 hover:bg-slate-700 flex items-center gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  {createLabel}
                </button>
              ) : (
                <div className="p-3 space-y-2">
                  {createFields.map((field) => (
                    <div key={field.key}>
                      <input
                        type="text"
                        value={createData[field.key] || ''}
                        onChange={(e) =>
                          setCreateData((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder || field.label}
                        className="w-full px-2.5 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                        autoFocus={field === createFields[0]}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreate()
                        }}
                      />
                    </div>
                  ))}

                  {createError && (
                    <p className="text-xs text-red-400">{createError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={submitting}
                      className="flex-1 px-2.5 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false)
                        setCreateData({})
                        setCreateError('')
                      }}
                      className="px-2.5 py-1.5 text-sm text-slate-400 hover:text-white rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}
