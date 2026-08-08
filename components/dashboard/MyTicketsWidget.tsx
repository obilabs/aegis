'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TicketIcon } from '@heroicons/react/24/outline'

interface TicketItem {
  id: string
  ticket_number: string
  subject: string
  priority: string
  status: string
  status_color: string | null
  updated_at: string
}

function formatRelativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const priorityColors: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
}

export function MyTicketsWidget() {
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/portal/dashboard/my-tickets')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d) {
          setTickets(d.tickets || [])
          setTotal(d.total || 0)
        }
      })
      .catch(() => {})
  }, [])

  if (total === 0) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <TicketIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">My Tickets</h3>
            <p className="text-xs text-slate-500">{total} open</p>
          </div>
        </div>
        <Link
          href="/portal/tickets"
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {tickets.slice(0, 3).map((ticket) => (
          <Link
            key={ticket.id}
            href={`/portal/tickets/${ticket.id}`}
            className="block p-2.5 rounded-lg bg-slate-750 hover:bg-slate-700 transition-colors border border-slate-700/50"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
              <span className="text-xs text-slate-600">{formatRelativeTime(ticket.updated_at)}</span>
            </div>
            <p className="text-xs text-slate-200 truncate">{ticket.subject}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="px-1.5 py-0.5 text-xs rounded"
                style={{
                  backgroundColor: ticket.status_color ? `${ticket.status_color}20` : undefined,
                  color: ticket.status_color || undefined,
                }}
              >
                {ticket.status || 'Open'}
              </span>
              <span className={`text-xs ${priorityColors[ticket.priority] || 'text-slate-400'}`}>
                {ticket.priority}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
