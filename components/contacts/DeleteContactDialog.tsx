'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface Impact {
  open_tickets: number
  closed_tickets: number
  credentials: number
  kb_articles: number
  documents: number
  access_requests: number
  group_memberships: number
  asset_assignments: number
  onboarding_requests: number
  offboarding_requests: number
  projects: number
  team_memberships: number
  service_ownerships: number
}

interface DeleteContactDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason?: string) => void
  contactId: string
  contactName: string
}

export default function DeleteContactDialog({
  isOpen,
  onClose,
  onConfirm,
  contactId,
  contactName,
}: DeleteContactDialogProps) {
  const [impact, setImpact] = useState<Impact | null>(null)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && contactId) {
      setLoading(true)
      setError(null)
      setReason('')
      fetch(`/api/portal/admin/contacts/${contactId}/impact`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load impact')
          return res.json()
        })
        .then(data => setImpact(data.impact))
        .catch(() => setError('Could not load impact preview'))
        .finally(() => setLoading(false))
    }
  }, [isOpen, contactId])

  const impactItems = impact
    ? [
        { label: 'Open tickets', count: impact.open_tickets },
        { label: 'Closed tickets', count: impact.closed_tickets },
        { label: 'Credentials', count: impact.credentials },
        { label: 'KB articles', count: impact.kb_articles },
        { label: 'Documents', count: impact.documents },
        { label: 'Asset assignments', count: impact.asset_assignments },
        { label: 'Group memberships', count: impact.group_memberships },
        { label: 'Team memberships', count: impact.team_memberships },
        { label: 'Projects', count: impact.projects },
        { label: 'Access requests', count: impact.access_requests },
        { label: 'Service ownerships', count: impact.service_ownerships },
      ].filter(i => i.count > 0)
    : []

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-slate-800 border border-slate-700 p-6 shadow-xl transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Delete {contactName}?
                    </Dialog.Title>
                    <p className="text-sm text-slate-400 mt-1">
                      This contact will be moved to trash. You can restore them later.
                    </p>
                  </div>
                </div>

                {/* Impact Preview */}
                <div className="mt-4">
                  {loading && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500"></div>
                    </div>
                  )}
                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                  {!loading && !error && impactItems.length > 0 && (
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <p className="text-xs font-medium text-slate-400 uppercase mb-2">Affected Resources</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {impactItems.map(item => (
                          <div key={item.label} className="flex justify-between text-sm">
                            <span className="text-slate-400">{item.label}</span>
                            <span className="text-white font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        These resources will remain accessible with the contact shown as &quot;(Deleted)&quot;.
                      </p>
                    </div>
                  )}
                  {!loading && !error && impactItems.length === 0 && impact && (
                    <p className="text-sm text-slate-400">This contact has no associated resources.</p>
                  )}
                </div>

                {/* Reason */}
                <div className="mt-4">
                  <label className="block text-sm text-slate-400 mb-1">Reason for deletion (optional)</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                    placeholder="e.g., Employee terminated, duplicate record..."
                  />
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onConfirm(reason || undefined)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Delete Contact
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
