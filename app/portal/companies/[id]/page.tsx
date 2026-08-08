'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface CompanyDetail {
  id: string
  name: string
  type: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  industry?: string
  notes?: string
  is_active: boolean
  contact_count: number
  asset_count: number
  created_at: string
  updated_at?: string
}

function getTypeColor(type: string) {
  switch (type) {
    case 'client': return 'bg-brand-500/20 text-brand-400'
    case 'customer': return 'bg-brand-500/20 text-brand-400'
    case 'vendor': return 'bg-blue-500/20 text-blue-400'
    case 'partner': return 'bg-purple-500/20 text-purple-400'
    case 'prospect': return 'bg-amber-500/20 text-amber-400'
    case 'internal': return 'bg-slate-500/20 text-slate-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editZip, setEditZip] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/companies/${params.id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setCompany(null)
          return
        }
        throw new Error('Failed to fetch')
      }
      const data = await res.json()
      setCompany(data)
    } catch {
      setError('Failed to load company')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { fetchCompany() }, [fetchCompany])

  function startEdit() {
    if (!company) return
    setEditName(company.name)
    setEditType(company.type)
    setEditEmail(company.email || '')
    setEditPhone(company.phone || '')
    setEditWebsite(company.website || '')
    setEditAddress(company.address || '')
    setEditCity(company.city || '')
    setEditState(company.state || '')
    setEditZip(company.zip || '')
    setEditCountry(company.country || '')
    setEditIndustry(company.industry || '')
    setEditNotes(company.notes || '')
    setEditing(true)
    setSaveMsg('')
  }

  async function handleSave() {
    if (!company) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/portal/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          type: editType,
          email: editEmail || null,
          phone: editPhone || null,
          website: editWebsite || null,
          address: editAddress || null,
          city: editCity || null,
          state: editState || null,
          zip: editZip || null,
          country: editCountry || null,
          industry: editIndustry || null,
          notes: editNotes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      setEditing(false)
      setSaveMsg('Company updated')
      await fetchCompany()
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Company not found</p>
        <Link href="/portal/companies" className="text-brand-400 hover:text-brand-300 text-sm mt-2 inline-block">
          Back to companies
        </Link>
      </div>
    )
  }

  const location = [company.city, company.state, company.country].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/portal/companies"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mt-1"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>

            <div className="h-16 w-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-slate-400">
                {company.name.substring(0, 2).toUpperCase()}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getTypeColor(company.type)}`}>
                  {company.type}
                </span>
              </div>

              {company.industry && <p className="text-slate-400 mt-1">{company.industry}</p>}

              <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                {company.email && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                    {company.email}
                  </span>
                )}
                {company.phone && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    {company.phone}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    {location}
                  </span>
                )}
                {company.website && (
                  <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    {company.website}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-sm text-brand-400">{saveMsg}</span>}
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                Edit
              </button>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">Edit Company</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
              <select value={editType} onChange={(e) => setEditType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500">
                <option value="internal">Internal</option>
                <option value="client">Client</option>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="partner">Partner</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Website</label>
              <input type="text" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Industry</label>
              <input type="text" value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
            <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
              <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">State</label>
              <input type="text" value={editState} onChange={(e) => setEditState(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">ZIP</label>
              <input type="text" value={editZip} onChange={(e) => setEditZip(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Country</label>
              <input type="text" value={editCountry} onChange={(e) => setEditCountry(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none" />
          </div>
        </div>
      )}

      {/* Details (view mode) */}
      {!editing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-200 mb-4">Company Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Email</p><p className="text-slate-200">{company.email || '\u2014'}</p></div>
                <div><p className="text-slate-500">Phone</p><p className="text-slate-200">{company.phone || '\u2014'}</p></div>
                <div><p className="text-slate-500">Website</p><p className="text-slate-200">{company.website || '\u2014'}</p></div>
                <div><p className="text-slate-500">Industry</p><p className="text-slate-200">{company.industry || '\u2014'}</p></div>
                <div><p className="text-slate-500">Address</p><p className="text-slate-200">{company.address || '\u2014'}</p></div>
                <div><p className="text-slate-500">Location</p><p className="text-slate-200">{location || '\u2014'}</p></div>
              </div>
              {company.notes && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-slate-500 text-sm">Notes</p>
                  <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap">{company.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-200 mb-4">Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Contacts</span>
                  <Link href={`/portal/contacts?company=${company.id}`} className="text-brand-400 hover:text-brand-300">{company.contact_count}</Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assets</span>
                  <Link href={`/portal/assets?company=${company.id}`} className="text-brand-400 hover:text-brand-300">{company.asset_count}</Link>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-200 mb-4">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-slate-500">Created</span><span className="text-slate-400">{new Date(company.created_at).toLocaleDateString()}</span></div>
                {company.updated_at && <div className="flex items-center justify-between"><span className="text-slate-500">Updated</span><span className="text-slate-400">{new Date(company.updated_at).toLocaleDateString()}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
