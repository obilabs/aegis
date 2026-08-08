'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface RequestDetail {
  id: string
  request_number: number
  status: string
  priority: string
  form_responses: Record<string, any>
  justification: string | null
  quantity: number | null
  submitted_at: string
  approved_at: string | null
  rejected_at: string | null
  fulfilled_at: string | null
  cancelled_at: string | null
  rejection_reason: string | null
  fulfillment_notes: string | null
  ticket_id: string | null
  total_cost: number | null
  item_name: string
  item_slug: string
  item_description: string | null
  item_icon: string | null
  requires_approval: boolean
  request_form: any[]
  estimated_fulfillment_days: number | null
  requester_name: string
  requester_email: string | null
  requester_department: string | null
  requester_title: string | null
  approved_by_name: string | null
  rejected_by_name: string | null
}

const statusConfig: Record<string, { color: string; label: string; bg: string }> = {
  pending_approval: { color: 'text-amber-400', label: 'Pending Approval', bg: 'bg-amber-500/20' },
  approved: { color: 'text-blue-400', label: 'Approved', bg: 'bg-blue-500/20' },
  rejected: { color: 'text-red-400', label: 'Rejected', bg: 'bg-red-500/20' },
  fulfilled: { color: 'text-brand-400', label: 'Fulfilled', bg: 'bg-brand-500/20' },
  cancelled: { color: 'text-slate-400', label: 'Cancelled', bg: 'bg-slate-500/20' },
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    fetchRequest()
  }, [id])

  async function fetchRequest() {
    try {
      const res = await fetch(`/api/portal/requests/${id}`)
      if (!res.ok) {
        setError(res.status === 404 ? 'Request not found' : 'Failed to load request')
        return
      }
      const data = await res.json()
      if (typeof data.form_responses === 'string') {
        data.form_responses = JSON.parse(data.form_responses)
      }
      setRequest(data)
    } catch {
      setError('Failed to load request')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this request?')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/portal/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (res.ok) {
        fetchRequest()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to cancel')
      }
    } catch {
      alert('Failed to cancel request')
    } finally {
      setCancelling(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-300">{error || 'Request not found'}</h2>
        <Link href="/portal/requests" className="text-brand-400 hover:text-brand-300 mt-2 inline-block">
          Back to Requests
        </Link>
      </div>
    )
  }

  const sc = statusConfig[request.status] || { color: 'text-slate-400', label: request.status, bg: 'bg-slate-500/20' }
  const formData = request.form_responses || {}
  const formFields = (typeof request.request_form === 'string'
    ? JSON.parse(request.request_form)
    : request.request_form) || []

  // Build timeline events
  const timeline: { label: string; date: string; detail?: string; color: string }[] = [
    { label: 'Submitted', date: request.submitted_at, color: 'bg-blue-500' },
  ]

  if (request.approved_at) {
    timeline.push({
      label: 'Approved',
      date: request.approved_at,
      detail: request.approved_by_name ? `by ${request.approved_by_name}` : undefined,
      color: 'bg-brand-500',
    })
  }
  if (request.rejected_at) {
    timeline.push({
      label: 'Rejected',
      date: request.rejected_at,
      detail: request.rejected_by_name ? `by ${request.rejected_by_name}` : undefined,
      color: 'bg-red-500',
    })
  }
  if (request.fulfilled_at) {
    timeline.push({ label: 'Fulfilled', date: request.fulfilled_at, color: 'bg-brand-500' })
  }
  if (request.cancelled_at) {
    timeline.push({ label: 'Cancelled', date: request.cancelled_at, color: 'bg-slate-500' })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal/requests" className="hover:text-brand-400">Requests</Link>
        <span>/</span>
        <span className="text-slate-200">REQ-{request.request_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{request.item_name}</h1>
          <p className="text-slate-400 mt-1">Request #{request.request_number}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${sc.color} ${sc.bg}`}>
          {sc.label}
        </span>
      </div>

      {/* Status-specific info banners */}
      {request.status === 'pending_approval' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3">
          <svg className="h-5 w-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">Awaiting approval</p>
            <p className="text-xs text-slate-400">This request requires manager or admin approval before it can be processed.</p>
          </div>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Request'}
          </button>
        </div>
      )}

      {request.status === 'rejected' && request.rejection_reason && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm font-medium text-red-400">Rejection Reason</p>
          <p className="text-sm text-slate-300 mt-1">{request.rejection_reason}</p>
          {request.rejected_by_name && (
            <p className="text-xs text-slate-500 mt-2">Rejected by {request.rejected_by_name}</p>
          )}
        </div>
      )}

      {request.status === 'approved' && request.ticket_id && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-400">Fulfillment in Progress</p>
            <p className="text-xs text-slate-400">A ticket has been created to fulfill this request.</p>
          </div>
          <Link
            href={`/portal/tickets/${request.ticket_id}`}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            View Ticket
          </Link>
        </div>
      )}

      {/* Form Responses */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Request Details</h2>
        <dl className="space-y-4">
          {formFields.map((field: any) => {
            const value = formData[field.name]
            if (value === null || value === undefined || value === '') return null
            return (
              <div key={field.name}>
                <dt className="text-sm font-medium text-slate-400">{field.label || field.name}</dt>
                <dd className="text-sm text-slate-200 mt-0.5">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </dd>
              </div>
            )
          })}

          {/* Show any form values not in the field definitions */}
          {Object.entries(formData)
            .filter(([key]) => !formFields.some((f: any) => f.name === key))
            .map(([key, value]) => {
              if (value === null || value === undefined || value === '') return null
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              return (
                <div key={key}>
                  <dt className="text-sm font-medium text-slate-400">{label}</dt>
                  <dd className="text-sm text-slate-200 mt-0.5">{String(value)}</dd>
                </div>
              )
            })}

          {request.justification && (
            <div>
              <dt className="text-sm font-medium text-slate-400">Business Justification</dt>
              <dd className="text-sm text-slate-200 mt-0.5">{request.justification}</dd>
            </div>
          )}

          {request.total_cost != null && request.total_cost > 0 && (
            <div>
              <dt className="text-sm font-medium text-slate-400">Estimated Cost</dt>
              <dd className="text-sm text-slate-200 mt-0.5">${request.total_cost.toFixed(2)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Requester Info */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Requester</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400">Name</p>
            <p className="text-sm text-slate-200">{request.requester_name || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Email</p>
            <p className="text-sm text-slate-200">{request.requester_email || '—'}</p>
          </div>
          {request.requester_department && (
            <div>
              <p className="text-sm text-slate-400">Department</p>
              <p className="text-sm text-slate-200">{request.requester_department}</p>
            </div>
          )}
          {request.requester_title && (
            <div>
              <p className="text-sm text-slate-400">Title</p>
              <p className="text-sm text-slate-200">{request.requester_title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Timeline</h2>
        <div className="space-y-4">
          {timeline.map((event, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${event.color} mt-0.5`} />
                {i < timeline.length - 1 && (
                  <div className="w-0.5 h-8 bg-slate-700 mt-1" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">{event.label}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(event.date)}
                  {event.detail && ` — ${event.detail}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        {request.item_description && (
          <span title={request.item_description}>Catalog: {request.item_name}</span>
        )}
        {request.estimated_fulfillment_days && (
          <span>Est. fulfillment: ~{request.estimated_fulfillment_days} days</span>
        )}
      </div>

      {/* Back */}
      <div className="pt-2">
        <Link href="/portal/requests" className="text-sm text-slate-400 hover:text-brand-400">
          &larr; Back to Requests
        </Link>
      </div>
    </div>
  )
}
