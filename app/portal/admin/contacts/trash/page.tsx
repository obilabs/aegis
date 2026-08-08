'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline'
import PurgeContactDialog from '@/components/contacts/PurgeContactDialog'

interface DeletedContact {
  id: string
  first_name: string
  last_name: string
  email: string
  contact_type: string
  deleted_at: string
  deleted_by_user_name: string | null
  deleted_by_name: string | null
  delete_reason: string | null
  legal_hold: boolean
}

export default function ContactsTrashPage() {
  const [contacts, setContacts] = useState<DeletedContact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<DeletedContact | null>(null)
  const [bulkPurgeCount, setBulkPurgeCount] = useState<number | null>(null)

  const limit = 25

  useEffect(() => {
    fetchTrash()
  }, [search, page])

  async function fetchTrash() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
      if (search) params.set('search', search)
      const res = await fetch(`/api/portal/admin/contacts/trash?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setContacts(data.contacts)
      setTotal(data.total)
    } catch {
      setMessage({ type: 'error', text: 'Failed to load deleted contacts' })
    } finally {
      setLoading(false)
    }
  }

  async function restoreContact(id: string) {
    try {
      const res = await fetch(`/api/portal/admin/contacts/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setContacts(prev => prev.filter(c => c.id !== id))
      setTotal(prev => prev - 1)
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
      setMessage({ type: 'success', text: 'Contact restored' })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to restore contact' })
    }
  }

  async function purgeContact(id: string) {
    try {
      const res = await fetch(`/api/portal/admin/contacts/${id}/purge`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setContacts(prev => prev.filter(c => c.id !== id))
      setTotal(prev => prev - 1)
      setPurgeTarget(null)
      setMessage({ type: 'success', text: 'Contact permanently deleted' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to purge contact' })
      setPurgeTarget(null)
    }
  }

  async function toggleLegalHold(contact: DeletedContact) {
    try {
      const res = await fetch(`/api/portal/admin/contacts/${contact.id}/legal-hold`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legal_hold: !contact.legal_hold }),
      })
      if (!res.ok) throw new Error()
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, legal_hold: !c.legal_hold } : c))
      setMessage({ type: 'success', text: contact.legal_hold ? 'Legal hold removed' : 'Legal hold enabled' })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to update legal hold' })
    }
  }

  async function bulkRestore() {
    const ids = Array.from(selected)
    try {
      const res = await fetch('/api/portal/admin/contacts/bulk/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setContacts(prev => prev.filter(c => !selected.has(c.id)))
      setTotal(prev => prev - data.restored)
      setSelected(new Set())
      setMessage({ type: 'success', text: `${data.restored} contacts restored` })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to restore contacts' })
    }
  }

  async function bulkPurge() {
    const ids = Array.from(selected)
    try {
      const res = await fetch('/api/portal/admin/contacts/bulk/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const data = await res.json()
      setContacts(prev => prev.filter(c => !selected.has(c.id)))
      setTotal(prev => prev - data.purged)
      setSelected(new Set())
      setBulkPurgeCount(null)
      setMessage({ type: 'success', text: `${data.purged} contacts permanently deleted` })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to purge contacts' })
      setBulkPurgeCount(null)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function toggleSelectAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map(c => c.id)))
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/portal/contacts" className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-4">
          <ArrowLeftIcon className="h-4 w-4" />
          Contacts
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrashIcon className="h-7 w-7 text-red-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Deleted Contacts</h1>
              <p className="text-slate-400 text-sm">{total} deleted contact{total !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Search + Bulk Actions */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search deleted contacts..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{selected.size} selected</span>
            <button
              onClick={bulkRestore}
              className="px-3 py-1.5 bg-brand-500/20 text-brand-400 rounded text-sm hover:bg-brand-500/30"
            >
              Restore Selected
            </button>
            <button
              onClick={() => setBulkPurgeCount(selected.size)}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30"
            >
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <TrashIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No deleted contacts</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-600 bg-slate-700 text-brand-500 focus:ring-brand-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Email</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Deleted</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Deleted By</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Reason</th>
                <th className="px-4 py-3 text-right text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      className="rounded border-slate-600 bg-slate-700 text-brand-500 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.legal_hold && (
                        <LockClosedIcon className="h-4 w-4 text-amber-400" title="Legal hold" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{contact.email}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(contact.deleted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {contact.deleted_by_user_name || contact.deleted_by_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">
                    {contact.delete_reason || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => restoreContact(contact.id)}
                        title="Restore"
                        className="p-1.5 text-brand-400 hover:bg-brand-500/10 rounded transition-colors"
                      >
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleLegalHold(contact)}
                        title={contact.legal_hold ? 'Remove legal hold' : 'Set legal hold'}
                        className={`p-1.5 rounded transition-colors ${
                          contact.legal_hold
                            ? 'text-amber-400 hover:bg-amber-500/10'
                            : 'text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {contact.legal_hold
                          ? <LockClosedIcon className="h-4 w-4" />
                          : <LockOpenIcon className="h-4 w-4" />
                        }
                      </button>
                      <button
                        onClick={() => setPurgeTarget(contact)}
                        title="Permanently delete"
                        disabled={contact.legal_hold}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <span className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Purge Confirmation Dialog */}
      {purgeTarget && (
        <PurgeContactDialog
          isOpen={!!purgeTarget}
          onClose={() => setPurgeTarget(null)}
          onConfirm={() => purgeContact(purgeTarget.id)}
          contactName={`${purgeTarget.first_name} ${purgeTarget.last_name}`}
        />
      )}

      {/* Bulk Purge Confirmation */}
      {bulkPurgeCount !== null && (
        <PurgeContactDialog
          isOpen={true}
          onClose={() => setBulkPurgeCount(null)}
          onConfirm={bulkPurge}
          contactName={`${bulkPurgeCount} contacts`}
          isBulk
        />
      )}
    </div>
  )
}
