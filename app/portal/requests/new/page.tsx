'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    justification: '',
    contact_email: '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          description: formData.description + (formData.justification ? `\n\n**Justification:**\n${formData.justification}` : ''),
          priority: formData.priority,
          type: 'service_request',
          contact_email: formData.contact_email || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit request')
      }

      const data = await res.json()
      router.push(`/portal/tickets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/portal/requests"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Request a Service</h1>
          <p className="text-slate-400 mt-1">I need access, hardware, software, or other IT services</p>
        </div>
      </div>

      {/* Service Catalog teaser */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
        <svg className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <div>
          <p className="text-sm text-blue-300">
            Describe what you need below. A service catalog with guided forms is coming soon.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
              What do you need? <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="subject"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g. Access to Slack, new laptop, software installation..."
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
              Details <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              required
              rows={5}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide details about what you need, who it's for, and any deadlines..."
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
            />
          </div>

          <div>
            <label htmlFor="justification" className="block text-sm font-medium text-slate-300 mb-2">
              Business Justification
            </label>
            <textarea
              id="justification"
              rows={3}
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              placeholder="Why do you need this? How will it help your work?"
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
            />
          </div>
        </div>

        {/* Priority */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              How urgent is this?
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: 'low', label: 'Not urgent', desc: 'When convenient', color: 'slate' },
                { value: 'medium', label: 'Normal', desc: 'Standard timeline', color: 'yellow' },
                { value: 'high', label: 'Urgent', desc: 'Blocking my work', color: 'orange' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={`flex-1 min-w-[130px] p-3 rounded-lg border text-left transition-all ${
                    formData.priority === p.value
                      ? p.color === 'slate' ? 'bg-slate-500/10 border-slate-500/50' :
                        p.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50' :
                        'bg-orange-500/10 border-orange-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    formData.priority === p.value
                      ? p.color === 'slate' ? 'text-slate-300' :
                        p.color === 'yellow' ? 'text-yellow-400' :
                        'text-orange-400'
                      : 'text-slate-300'
                  }`}>
                    {p.label}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/portal/requests"
            className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !formData.subject || !formData.description}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Submitting...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
