'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface DropdownItem {
  label: string
  description: string
  href: string
  icon: React.ReactNode
  visible: boolean
}

interface TicketType {
  id: string
  name: string
  icon: string
  color: string
  is_visible: boolean
}

/**
 * Context-aware "+ New" dropdown for the portal nav.
 *
 * Role-filtered:
 * - End users: Report an Issue + Request a Service
 * - Technicians: + Problem Investigation
 * - Admins: + Change Request
 */
export function NewItemDropdown() {
  const [open, setOpen] = useState(false)
  const [types, setTypes] = useState<TicketType[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/portal/ticket-types')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.types) setTypes(data.types)
      })
      .catch(() => {})
  }, [])

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

  const hasType = (name: string) => types.some(t => t.name === name && t.is_visible)

  const items: DropdownItem[] = [
    {
      label: 'Report an Issue',
      description: 'Something is broken or not working',
      href: '/portal/tickets/new?type=incident',
      icon: <AlertIcon className="h-5 w-5 text-red-400" />,
      visible: hasType('Incident'),
    },
    {
      label: 'Request a Service',
      description: 'Browse the service catalog',
      href: '/portal/requests/catalog',
      icon: <ClipboardIcon className="h-5 w-5 text-blue-400" />,
      visible: hasType('Service Request'),
    },
  ]

  const agentItems: DropdownItem[] = [
    {
      label: 'Problem Investigation',
      description: 'Investigate root cause of recurring issues',
      href: '/portal/tickets/new?type=problem',
      icon: <SearchIcon className="h-5 w-5 text-purple-400" />,
      visible: hasType('Problem'),
    },
    {
      label: 'Change Request',
      description: 'Propose a change to infrastructure or services',
      href: '/portal/tickets/new?type=change',
      icon: <BranchIcon className="h-5 w-5 text-amber-400" />,
      visible: hasType('Change Request'),
    },
  ]

  const visibleItems = items.filter(i => i.visible)
  const visibleAgentItems = agentItems.filter(i => i.visible)

  // Fallback: if types haven't loaded yet, show basic items
  if (types.length === 0) {
    return (
      <a
        href="/portal/tickets/new"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <PlusIcon className="h-4 w-4" />
        New
      </a>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 hover:bg-slate-800 rounded-lg transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <PlusIcon className="h-4 w-4" />
        New
        <ChevronIcon className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-1">
            {visibleItems.map((item) => (
              <button
                key={item.href}
                onClick={() => {
                  setOpen(false)
                  router.push(item.href)
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3 ${
                  pathname?.startsWith(item.href.split('?')[0])
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="mt-0.5">{item.icon}</span>
                <div>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.description}</span>
                </div>
              </button>
            ))}

            {visibleAgentItems.length > 0 && (
              <>
                <div className="my-1 border-t border-slate-700" />
                {visibleAgentItems.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      setOpen(false)
                      router.push(item.href)
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3 text-slate-300 hover:bg-slate-700"
                  >
                    <span className="mt-0.5">{item.icon}</span>
                    <div>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs text-slate-500">{item.description}</span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Inline SVG icons to avoid importing a heavy icon library into this component
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

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
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

function BranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6v6m0 0a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0v3a3 3 0 0 1-3 3H9" />
    </svg>
  )
}
