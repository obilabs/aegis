'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import DynamicFormRenderer, { validateFormFields } from '@/components/features/DynamicFormRenderer'
import type { FormField } from '@/components/features/DynamicFormRenderer'

interface CatalogItem {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  requires_approval: boolean
  estimated_fulfillment_days: number | null
  request_form: FormField[]
  category_name: string | null
}

export default function NewRequestPage() {
  const params = useParams()
  const router = useRouter()
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [justification, setJustification] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: string; request_number: number } | null>(null)

  useEffect(() => {
    async function fetchItem() {
      try {
        const res = await fetch(`/api/portal/catalog/${params.slug}`)
        if (!res.ok) {
          setError(res.status === 404 ? 'Catalog item not found' : 'Failed to load')
          return
        }
        const data = await res.json()
        // Parse request_form if it's a string
        if (typeof data.request_form === 'string') {
          data.request_form = JSON.parse(data.request_form)
        }
        setItem(data)
      } catch {
        setError('Failed to load catalog item')
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
  }, [params.slug])

  async function handleSubmit() {
    if (!item) return

    // Validate
    const fields = item.request_form || []
    const errors = validateFormFields(fields, formValues)

    // Check if justification field exists in form; if not, add separate validation
    const hasJustificationField = fields.some(f => f.name === 'justification')
    if (!hasJustificationField && item.requires_approval && !justification.trim()) {
      errors._justification = 'Justification is required for approval'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setSubmitting(true)

    try {
      const res = await fetch('/api/portal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog_item_id: item.id,
          form_responses: formValues,
          justification: justification || formValues.justification || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSubmitted(data)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit request')
      }
    } catch {
      setError('Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-300">{error}</h2>
        <Link href="/portal/requests/catalog" className="text-brand-400 hover:text-brand-300 mt-2 inline-block">
          Back to Catalog
        </Link>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="p-4 bg-brand-500/10 rounded-full inline-block mb-4">
          <svg className="h-12 w-12 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Request Submitted</h2>
        <p className="text-slate-400 mt-2">
          Your request #{submitted.request_number} has been submitted
          {item?.requires_approval ? ' and is pending approval.' : ' and is being processed.'}
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Link
            href={`/portal/requests/${submitted.id}`}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
          >
            View Request
          </Link>
          <Link
            href="/portal/requests"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm"
          >
            All Requests
          </Link>
        </div>
      </div>
    )
  }

  if (!item) return null

  const fields = item.request_form || []
  const hasJustificationField = fields.some(f => f.name === 'justification')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal/requests/catalog" className="hover:text-brand-400">
          Service Catalog
        </Link>
        <span>/</span>
        <span className="text-slate-200">{item.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{item.name}</h1>
        {item.description && (
          <p className="text-slate-400 mt-2">{item.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-sm text-slate-500">
          {item.estimated_fulfillment_days && (
            <span>Estimated: ~{item.estimated_fulfillment_days} days</span>
          )}
          {item.requires_approval && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
              Requires Approval
            </span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Request Details</h2>

        <DynamicFormRenderer
          fields={fields}
          values={formValues}
          onChange={setFormValues}
          errors={formErrors}
        />

        {/* Separate justification for approval items that don't include it in the form */}
        {item.requires_approval && !hasJustificationField && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Business Justification <span className="text-red-400">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 focus:outline-none ${
                formErrors._justification ? 'border-red-500' : 'border-slate-600 focus:border-brand-500'
              }`}
              rows={3}
              placeholder="Why do you need this?"
            />
            {formErrors._justification && (
              <p className="text-sm text-red-400 mt-1">{formErrors._justification}</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/portal/requests/catalog"
          className="text-slate-400 hover:text-slate-200 text-sm"
        >
          Back to Catalog
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-medium"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </div>
  )
}
