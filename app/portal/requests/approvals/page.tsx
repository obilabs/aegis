'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PendingApproval {
  id: string
  request_number: number
  status: string
  priority: string
  form_responses: Record<string, any>
  justification: string | null
  submitted_at: string
  total_cost: number | null
  item_name: string
  item_slug: string
  item_icon: string | null
  requires_approval: boolean
  requester_name: string
  requester_email: string | null
  requester_department: string | null
  requester_title: string | null
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    fetchApprovals()
  }, [])

  async function fetchApprovals() {
    try {
      const res = await fetch('/api/portal/requests/approvals')
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.approvals || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/portal/requests/${id}/approve`, { method: 'POST' })
      if (res.ok) {
        setApprovals(prev => prev.filter(a => a.id !== id))
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to approve')
      }
    } catch {
      alert('Failed to approve request')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject() {
    if (!rejectModal || !rejectReason.trim()) return
    setActionLoading(rejectModal.id)
    try {
      const res = await fetch(`/api/portal/requests/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (res.ok) {
        setApprovals(prev => prev.filter(a => a.id !== rejectModal.id))
        setRejectModal(null)
        setRejectReason('')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to reject')
      }
    } catch {
      alert('Failed to reject request')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getFormSummary = (formData: Record<string, any>) => {
    const entries = Object.entries(formData || {}).filter(([, v]) => v !== null && v !== undefined && v !== '')
    return entries.slice(0, 3).map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `${label}: ${value}`
    }).join(' | ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Pending Approvals</h1>
        <p className="text-slate-400 mt-1">
          {approvals.length === 0
            ? 'No requests awaiting your approval'
            : `${approvals.length} request${approvals.length !== 1 ? 's' : ''} awaiting approval`}
        </p>
      </div>

      {approvals.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-slate-300">All caught up</h3>
          <p className="mt-1 text-sm text-slate-500">No pending approvals at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const formData = typeof approval.form_responses === 'string'
              ? JSON.parse(approval.form_responses)
              : approval.form_responses || {}
            const isActioning = actionLoading === approval.id

            return (
              <div
                key={approval.id}
                className="bg-slate-800 rounded-lg border border-slate-700 p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/portal/requests/${approval.id}`}
                        className="text-lg font-semibold text-slate-100 hover:text-brand-400"
                      >
                        {approval.item_name}
                      </Link>
                      <span className="text-xs text-slate-500">REQ-{approval.request_number}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <span className="text-slate-300">{approval.requester_name || '—'}</span>
                        {approval.requester_department && (
                          <span className="text-slate-500">({approval.requester_department})</span>
                        )}
                      </div>
                      <span className="text-slate-500">{formatDate(approval.submitted_at)}</span>
                      {approval.total_cost != null && approval.total_cost > 0 && (
                        <span className="text-amber-400">${approval.total_cost.toFixed(2)}</span>
                      )}
                    </div>

                    {/* Form summary */}
                    {Object.keys(formData).length > 0 && (
                      <p className="text-sm text-slate-400 mt-2 truncate">
                        {getFormSummary(formData)}
                      </p>
                    )}

                    {/* Justification */}
                    {approval.justification && (
                      <div className="mt-3 pl-3 border-l-2 border-slate-600">
                        <p className="text-sm text-slate-300 italic">&ldquo;{approval.justification}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(approval.id)}
                      disabled={isActioning}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isActioning ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: approval.id, name: approval.item_name })}
                      disabled={isActioning}
                      className="px-4 py-2 bg-slate-700 hover:bg-red-600/20 hover:text-red-400 disabled:opacity-50 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Reject Request</h2>
              <p className="text-sm text-slate-400 mt-1">
                Rejecting: {rejectModal.name}
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Reason for rejection <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500"
                rows={3}
                placeholder="Please provide a reason for rejecting this request..."
                autoFocus
              />
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason('') }}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
