'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Option { id: string; name: string }

// Mirrors the statuses accepted by POST /api/portal/assets.
const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'storage', label: 'In storage' },
  { value: 'retired', label: 'Retired' },
  { value: 'disposed', label: 'Disposed' },
]

const inputClass =
  'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none'

export default function NewAssetPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', asset_tag: '', type_id: '', status: 'active', make: '', model: '', serial_number: '',
    hostname: '', company_id: '', contact_id: '', warranty_expire: '', notes: '',
  })
  const [types, setTypes] = useState<Option[]>([])
  const [companies, setCompanies] = useState<Option[]>([])
  const [contacts, setContacts] = useState<Option[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/portal/settings/asset-types')
      .then(r => (r.ok ? r.json() : { assetTypes: [] }))
      .then(d => setTypes((d.assetTypes || []).filter((t: { is_active?: boolean }) => t.is_active !== false)))
      .catch(() => {})
    fetch('/api/portal/companies')
      .then(r => (r.ok ? r.json() : { companies: [] }))
      .then(d => setCompanies(d.companies || []))
      .catch(() => {})
    fetch('/api/portal/contacts')
      .then(r => (r.ok ? r.json() : { contacts: [] }))
      .then(d => setContacts((d.contacts || []).map((c: { id: string; first_name: string; last_name: string; email?: string }) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ''}`,
      }))))
      .catch(() => {})
  }, [])

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
      const res = await fetch('/api/portal/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create asset')
      router.push(`/portal/assets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/assets"
          aria-label="Back to assets"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Asset</h1>
          <p className="text-slate-400 mt-1">Add hardware or software to the inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="asset-name" className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input id="asset-name" required maxLength={255} value={form.name} onChange={set('name')} className={inputClass} placeholder="e.g. LAPTOP-042" />
          </div>
          <div>
            <label htmlFor="asset-tag" className="block text-sm font-medium text-slate-300 mb-1">Asset tag</label>
            <input id="asset-tag" maxLength={100} value={form.asset_tag} onChange={set('asset_tag')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="asset-status" className="block text-sm font-medium text-slate-300 mb-1">Status</label>
            <select id="asset-status" value={form.status} onChange={set('status')} className={inputClass}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="asset-type" className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select id="asset-type" value={form.type_id} onChange={set('type_id')} className={inputClass}>
              <option value="">{types.length ? 'No type' : 'No asset types defined yet'}</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="asset-serial" className="block text-sm font-medium text-slate-300 mb-1">Serial number</label>
            <input id="asset-serial" maxLength={100} value={form.serial_number} onChange={set('serial_number')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="asset-make" className="block text-sm font-medium text-slate-300 mb-1">Make</label>
            <input id="asset-make" maxLength={100} value={form.make} onChange={set('make')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="asset-model" className="block text-sm font-medium text-slate-300 mb-1">Model</label>
            <input id="asset-model" maxLength={100} value={form.model} onChange={set('model')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="asset-hostname" className="block text-sm font-medium text-slate-300 mb-1">Hostname</label>
            <input id="asset-hostname" maxLength={255} value={form.hostname} onChange={set('hostname')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="asset-warranty" className="block text-sm font-medium text-slate-300 mb-1">Warranty expires</label>
            <input id="asset-warranty" type="date" value={form.warranty_expire} onChange={set('warranty_expire')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="asset-company" className="block text-sm font-medium text-slate-300 mb-1">Company</label>
            <select id="asset-company" value={form.company_id} onChange={set('company_id')} className={inputClass}>
              <option value="">None</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="asset-contact" className="block text-sm font-medium text-slate-300 mb-1">Assigned to</label>
            <select id="asset-contact" value={form.contact_id} onChange={set('contact_id')} className={inputClass}>
              <option value="">Unassigned</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="asset-notes" className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea id="asset-notes" rows={3} value={form.notes} onChange={set('notes')} className={inputClass} />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4" role="alert">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/portal/assets" className="px-4 py-2 text-slate-400 hover:text-slate-200">Cancel</Link>
          <Button type="submit" isLoading={saving}>Create Asset</Button>
        </div>
      </form>
    </div>
  )
}
