'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { InlineCreateDropdown } from '@/components/InlineCreateDropdown'
import DeleteContactDialog from '@/components/contacts/DeleteContactDialog'

interface ContactDetail {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  mobile?: string
  title?: string
  contact_type: 'employee' | 'customer' | 'vendor' | 'partner'
  company_id?: string
  company_name?: string
  department_id?: string
  department_name?: string
  job_title_id?: string
  job_title_name?: string
  location_id?: string
  location_name?: string
  is_primary: boolean
  is_technical: boolean
  is_billing: boolean
  is_vip: boolean
  has_portal_access: boolean
  is_deleted: boolean
  notes?: string
  user_id?: string
  user_email?: string
  user_role?: string
  created_at: string
  updated_at?: string
}

interface LookupItem {
  id: string
  name: string
  [key: string]: any
}

function getContactTypeColor(type: string) {
  switch (type) {
    case 'employee': return 'bg-blue-500/20 text-blue-400'
    case 'customer': return 'bg-brand-500/20 text-brand-400'
    case 'vendor': return 'bg-purple-500/20 text-purple-400'
    case 'partner': return 'bg-amber-500/20 text-amber-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  // Edit form state
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null)
  const [editJobTitleId, setEditJobTitleId] = useState<string | null>(null)
  const [editLocationId, setEditLocationId] = useState<string | null>(null)
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editIsPrimary, setEditIsPrimary] = useState(false)
  const [editIsVip, setEditIsVip] = useState(false)
  const [editPortalAccess, setEditPortalAccess] = useState(false)

  // Lookups for edit mode
  const [departments, setDepartments] = useState<LookupItem[]>([])
  const [jobTitles, setJobTitles] = useState<LookupItem[]>([])
  const [locations, setLocations] = useState<LookupItem[]>([])
  const [companies, setCompanies] = useState<LookupItem[]>([])

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/contacts/${params.id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setContact(null)
          return
        }
        throw new Error('Failed to fetch')
      }
      const data = await res.json()
      setContact(data)
    } catch {
      setError('Failed to load contact')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  const fetchLookups = useCallback(async () => {
    const [deptRes, jtRes, locRes, compRes] = await Promise.all([
      fetch('/api/portal/departments').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/portal/job-titles').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/portal/locations').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/portal/companies').then(r => r.json()).catch(() => ({ companies: [] })),
    ])
    setDepartments(deptRes.items || [])
    setJobTitles(jtRes.items || [])
    setLocations(locRes.items || [])
    setCompanies((compRes.companies || []).map((c: any) => ({ id: c.id, name: c.name, type: c.type })))
  }, [])

  useEffect(() => { fetchContact() }, [fetchContact])

  function startEdit() {
    if (!contact) return
    setEditFirstName(contact.first_name)
    setEditLastName(contact.last_name)
    setEditEmail(contact.email || '')
    setEditPhone(contact.phone || '')
    setEditMobile(contact.mobile || '')
    setEditTitle(contact.title || '')
    setEditDepartmentId(contact.department_id || null)
    setEditJobTitleId(contact.job_title_id || null)
    setEditLocationId(contact.location_id || null)
    setEditCompanyId(contact.company_id || null)
    setEditNotes(contact.notes || '')
    setEditIsPrimary(contact.is_primary)
    setEditIsVip(contact.is_vip)
    setEditPortalAccess(contact.has_portal_access)
    fetchLookups()
    setEditing(true)
    setSaveMsg('')
  }

  async function quickCreate(endpoint: string, data: Record<string, string>) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to create')
    }
    const item = await res.json()
    await fetchLookups()
    return item
  }

  async function handleSave() {
    if (!contact) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/portal/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          email: editEmail || null,
          phone: editPhone || null,
          mobile: editMobile || null,
          title: editTitle || null,
          department_id: editDepartmentId,
          job_title_id: editJobTitleId,
          location_id: editLocationId,
          company_id: editCompanyId,
          notes: editNotes || null,
          is_primary: editIsPrimary,
          is_vip: editIsVip,
          has_portal_access: editPortalAccess,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      setEditing(false)
      setSaveMsg('Contact updated')
      await fetchContact()
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(reason?: string) {
    if (!contact) return

    try {
      const res = await fetch(`/api/portal/contacts/${contact.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete_reason: reason }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      router.push('/portal/contacts')
    } catch {
      setError('Failed to delete contact')
      setShowDeleteDialog(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Contact not found</p>
        <Link href="/portal/contacts" className="text-brand-400 hover:text-brand-300 text-sm mt-2 inline-block">
          Back to contacts
        </Link>
      </div>
    )
  }

  const isEmployee = contact.contact_type === 'employee'
  const needsCompany = ['customer', 'vendor', 'partner'].includes(contact.contact_type)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/portal/contacts"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mt-1"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>

            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-white">
                {contact.first_name[0]}{contact.last_name[0]}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {contact.first_name} {contact.last_name}
                </h1>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getContactTypeColor(contact.contact_type)}`}>
                  {contact.contact_type}
                </span>
                {contact.is_vip && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">VIP</span>
                )}
                {contact.is_primary && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-brand-500/10 text-brand-400 rounded-full">Primary</span>
                )}
              </div>

              {contact.title && <p className="text-slate-400 mt-1">{contact.title}</p>}
              {contact.job_title_name && <p className="text-slate-400 mt-1">{contact.job_title_name}</p>}

              <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                {contact.email && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                    {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    {contact.phone}
                  </span>
                )}
                {contact.department_name && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                    {contact.department_name}
                  </span>
                )}
                {contact.company_name && (
                  <Link
                    href={`/portal/companies/${contact.company_id}`}
                    className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                    {contact.company_name}
                  </Link>
                )}
                {contact.location_name && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    {contact.location_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-sm text-brand-400">{saveMsg}</span>}
            {!editing ? (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Delete
                </button>
              </>
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

        {contact.user_id && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-3">
            <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <span className="text-sm text-slate-400">
              Has user account: <span className="text-slate-300">{contact.user_email}</span>
              {contact.user_role && <span className="text-slate-500"> ({contact.user_role})</span>}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">Edit Contact</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
              <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
              <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Mobile</label>
              <input type="tel" value={editMobile} onChange={(e) => setEditMobile(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
          </div>

          {!isEmployee && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500" />
            </div>
          )}

          {isEmployee && (
            <>
              <InlineCreateDropdown label="Department" required value={editDepartmentId} onChange={setEditDepartmentId} items={departments}
                placeholder="Select department..." settingsHref="/portal/settings/master-data"
                onCreateNew={(data) => quickCreate('/api/portal/departments/quick', data)} createLabel="Create Department" />
              <InlineCreateDropdown label="Job Title" required value={editJobTitleId} onChange={setEditJobTitleId} items={jobTitles}
                placeholder="Select job title..." settingsHref="/portal/settings/job-titles"
                onCreateNew={(data) => quickCreate('/api/portal/job-titles/quick', data)} createLabel="Create Job Title" />
            </>
          )}

          {needsCompany && (
            <InlineCreateDropdown label="Company" required value={editCompanyId} onChange={setEditCompanyId} items={companies}
              placeholder="Select company..." createFields={[{ key: 'name', label: 'Company Name', required: true }]}
              onCreateNew={async (data) => {
                const typeMap: Record<string, string> = { customer: 'client', vendor: 'vendor', partner: 'partner' }
                return quickCreate('/api/portal/companies/quick', { ...data, type: typeMap[contact.contact_type] || 'customer' })
              }} createLabel="Create Company" />
          )}

          <InlineCreateDropdown label="Location" value={editLocationId} onChange={setEditLocationId} items={locations}
            placeholder="Select location..." createFields={[{ key: 'name', label: 'Name', required: true }, { key: 'city', label: 'City' }, { key: 'country', label: 'Country' }]}
            onCreateNew={(data) => quickCreate('/api/portal/locations/quick', data)} createLabel="Create Location" />

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editIsPrimary} onChange={(e) => setEditIsPrimary(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30" />
              <span className="text-sm text-slate-300">Primary Contact</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editIsVip} onChange={(e) => setEditIsVip(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30" />
              <span className="text-sm text-slate-300">VIP</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editPortalAccess} onChange={(e) => setEditPortalAccess(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30" />
              <span className="text-sm text-slate-300">Portal Access</span>
            </label>
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
              <h3 className="text-sm font-medium text-slate-200 mb-4">Contact Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Email</p><p className="text-slate-200">{contact.email || '\u2014'}</p></div>
                <div><p className="text-slate-500">Phone</p><p className="text-slate-200">{contact.phone || '\u2014'}</p></div>
                <div><p className="text-slate-500">Mobile</p><p className="text-slate-200">{contact.mobile || '\u2014'}</p></div>
                <div><p className="text-slate-500">Type</p><p className="text-slate-200 capitalize">{contact.contact_type}</p></div>
                {contact.department_name && <div><p className="text-slate-500">Department</p><p className="text-slate-200">{contact.department_name}</p></div>}
                {contact.job_title_name && <div><p className="text-slate-500">Job Title</p><p className="text-slate-200">{contact.job_title_name}</p></div>}
                {contact.location_name && <div><p className="text-slate-500">Location</p><p className="text-slate-200">{contact.location_name}</p></div>}
                {contact.company_name && (
                  <div><p className="text-slate-500">Company</p>
                    <Link href={`/portal/companies/${contact.company_id}`} className="text-brand-400 hover:text-brand-300">{contact.company_name}</Link>
                  </div>
                )}
                {contact.title && <div><p className="text-slate-500">Title</p><p className="text-slate-200">{contact.title}</p></div>}
              </div>
              {contact.notes && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-slate-500 text-sm">Notes</p>
                  <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-200 mb-4">Status</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-slate-400">Portal Access</span><span className={contact.has_portal_access ? 'text-brand-400' : 'text-slate-600'}>{contact.has_portal_access ? 'Yes' : 'No'}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-400">Primary</span><span className={contact.is_primary ? 'text-brand-400' : 'text-slate-600'}>{contact.is_primary ? 'Yes' : 'No'}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-400">VIP</span><span className={contact.is_vip ? 'text-amber-400' : 'text-slate-600'}>{contact.is_vip ? 'Yes' : 'No'}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-400">Technical</span><span className={contact.is_technical ? 'text-blue-400' : 'text-slate-600'}>{contact.is_technical ? 'Yes' : 'No'}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-400">Billing</span><span className={contact.is_billing ? 'text-purple-400' : 'text-slate-600'}>{contact.is_billing ? 'Yes' : 'No'}</span></div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-200 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link href={`/portal/tickets/new?contact=${contact.email}`} className="w-full flex items-center gap-2 p-2 text-left text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" /></svg>
                  Create Ticket
                </Link>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-200 mb-4">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-slate-500">Created</span><span className="text-slate-400">{new Date(contact.created_at).toLocaleDateString()}</span></div>
                {contact.updated_at && <div className="flex items-center justify-between"><span className="text-slate-500">Updated</span><span className="text-slate-400">{new Date(contact.updated_at).toLocaleDateString()}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}
      {contact && (
        <DeleteContactDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          contactId={contact.id}
          contactName={`${contact.first_name} ${contact.last_name}`}
        />
      )}
    </div>
  )
}
