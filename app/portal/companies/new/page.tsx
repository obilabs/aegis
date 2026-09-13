'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

// Mirrors the enum accepted by POST /api/portal/companies.
const COMPANY_TYPES = [
  { value: 'customer', label: 'Customer' },
  { value: 'client', label: 'Client' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'partner', label: 'Partner' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'internal', label: 'Internal' },
]

const inputClass =
  'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none'

export default function NewCompanyPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', type: 'customer', email: '', phone: '', website: '', industry: '', city: '', country: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()]),
    )
    try {
      const res = await fetch('/api/portal/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const fieldErrors = data.details?.fieldErrors
          ? Object.entries(data.details.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ')
          : ''
        throw new Error(fieldErrors || data.error || 'Failed to create company')
      }
      router.push(`/portal/companies/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/companies"
          aria-label="Back to companies"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Company</h1>
          <p className="text-slate-400 mt-1">Add a customer, vendor or partner organization</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="company-name" className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input id="company-name" required maxLength={200} value={form.name} onChange={set('name')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="company-type" className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select id="company-type" value={form.type} onChange={set('type')} className={inputClass}>
              {COMPANY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="company-industry" className="block text-sm font-medium text-slate-300 mb-1">Industry</label>
            <input id="company-industry" maxLength={100} value={form.industry} onChange={set('industry')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="company-email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input id="company-email" type="email" value={form.email} onChange={set('email')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="company-phone" className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
            <input id="company-phone" type="tel" maxLength={50} value={form.phone} onChange={set('phone')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="company-website" className="block text-sm font-medium text-slate-300 mb-1">Website</label>
            <input id="company-website" maxLength={500} value={form.website} onChange={set('website')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="company-city" className="block text-sm font-medium text-slate-300 mb-1">City</label>
            <input id="company-city" maxLength={100} value={form.city} onChange={set('city')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="company-country" className="block text-sm font-medium text-slate-300 mb-1">Country</label>
            <input id="company-country" maxLength={100} value={form.country} onChange={set('country')} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="company-notes" className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea id="company-notes" rows={3} value={form.notes} onChange={set('notes')} className={inputClass} />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4" role="alert">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/portal/companies" className="px-4 py-2 text-slate-400 hover:text-slate-200">Cancel</Link>
          <Button type="submit" isLoading={saving}>Create Company</Button>
        </div>
      </form>
    </div>
  )
}
