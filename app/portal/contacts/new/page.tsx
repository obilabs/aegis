'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { InlineCreateDropdown } from '@/components/InlineCreateDropdown'

interface LookupItem {
  id: string
  name: string
  [key: string]: any
}

type ContactType = 'employee' | 'customer' | 'vendor' | 'partner'

export default function NewContactPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contactType, setContactType] = useState<ContactType>('employee')

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  // FK fields
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [jobTitleId, setJobTitleId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Dropdown options
  const [departments, setDepartments] = useState<LookupItem[]>([])
  const [jobTitles, setJobTitles] = useState<LookupItem[]>([])
  const [locations, setLocations] = useState<LookupItem[]>([])
  const [companies, setCompanies] = useState<LookupItem[]>([])

  // Flags
  const [isPrimary, setIsPrimary] = useState(false)
  const [isVip, setIsVip] = useState(false)
  const [hasPortalAccess, setHasPortalAccess] = useState(false)

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

  useEffect(() => { fetchLookups() }, [fetchLookups])

  const isEmployee = contactType === 'employee'
  const needsCompany = ['customer', 'vendor', 'partner'].includes(contactType)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/portal/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          mobile: mobile || null,
          title: title || null,
          contact_type: contactType,
          department_id: departmentId,
          job_title_id: jobTitleId,
          location_id: locationId,
          company_id: companyId,
          is_primary: isPrimary,
          is_vip: isVip,
          has_portal_access: hasPortalAccess,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create contact')
      }

      const contact = await res.json()
      router.push(`/portal/contacts/${contact.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/portal/contacts"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Contact</h1>
          <p className="text-slate-400 mt-1">Add a new person to your organization</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Type */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Contact Type <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { value: 'employee', label: 'Employee', desc: 'Internal staff member', color: 'blue' },
              { value: 'customer', label: 'Customer', desc: 'Customer contact', color: 'emerald' },
              { value: 'vendor', label: 'Vendor', desc: 'Supplier contact', color: 'purple' },
              { value: 'partner', label: 'Partner', desc: 'Business partner', color: 'amber' },
            ] as const).map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setContactType(type.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  contactType === type.value
                    ? type.color === 'blue' ? 'bg-blue-500/10 border-blue-500/50' :
                      type.color === 'emerald' ? 'bg-brand-500/10 border-brand-500/50' :
                      type.color === 'purple' ? 'bg-purple-500/10 border-purple-500/50' :
                      'bg-amber-500/10 border-amber-500/50'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <span className={`text-sm font-medium ${
                  contactType === type.value
                    ? type.color === 'blue' ? 'text-blue-400' :
                      type.color === 'emerald' ? 'text-brand-400' :
                      type.color === 'purple' ? 'text-purple-400' :
                      'text-amber-400'
                    : 'text-slate-300'
                }`}>
                  {type.label}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">{type.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              placeholder="email@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Mobile</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Title - only for external contacts */}
          {!isEmployee && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                placeholder="e.g. Account Manager, Sales Director"
              />
            </div>
          )}
        </div>

        {/* Employee-specific fields */}
        {isEmployee && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-medium text-slate-200 mb-2">Employment Details</h3>

            <InlineCreateDropdown
              label="Department"
              required
              value={departmentId}
              onChange={setDepartmentId}
              items={departments}
              placeholder="Select department..."
              emptyMessage="No departments configured yet."
              settingsHref="/portal/settings/master-data"
              onCreateNew={(data) => quickCreate('/api/portal/departments/quick', data)}
              createLabel="Create Department"
            />

            <InlineCreateDropdown
              label="Job Title"
              required
              value={jobTitleId}
              onChange={setJobTitleId}
              items={jobTitles}
              placeholder="Select job title..."
              emptyMessage="No job titles configured yet."
              settingsHref="/portal/settings/job-titles"
              onCreateNew={(data) => quickCreate('/api/portal/job-titles/quick', data)}
              createLabel="Create Job Title"
            />

            <InlineCreateDropdown
              label="Location"
              value={locationId}
              onChange={setLocationId}
              items={locations}
              placeholder="Select location..."
              emptyMessage="No locations configured yet."
              settingsHref="/portal/settings/master-data"
              createFields={[
                { key: 'name', label: 'Name', required: true },
                { key: 'city', label: 'City' },
                { key: 'country', label: 'Country' },
              ]}
              onCreateNew={(data) => quickCreate('/api/portal/locations/quick', data)}
              createLabel="Create Location"
            />
          </div>
        )}

        {/* Company field (for external contacts) */}
        {needsCompany && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-medium text-slate-200 mb-2">Company</h3>

            <InlineCreateDropdown
              label="Company"
              required
              value={companyId}
              onChange={setCompanyId}
              items={companies}
              placeholder="Select company..."
              emptyMessage="No companies added yet."
              settingsHref="/portal/companies"
              createFields={[
                { key: 'name', label: 'Company Name', required: true },
              ]}
              onCreateNew={async (data) => {
                const typeMap: Record<string, string> = {
                  customer: 'client',
                  vendor: 'vendor',
                  partner: 'partner',
                }
                return quickCreate('/api/portal/companies/quick', {
                  ...data,
                  type: typeMap[contactType] || 'customer',
                })
              }}
              createLabel="Create Company"
            />

            <InlineCreateDropdown
              label="Location"
              value={locationId}
              onChange={setLocationId}
              items={locations}
              placeholder="Select location..."
              emptyMessage="No locations configured yet."
              createFields={[
                { key: 'name', label: 'Name', required: true },
                { key: 'city', label: 'City' },
                { key: 'country', label: 'Country' },
              ]}
              onCreateNew={(data) => quickCreate('/api/portal/locations/quick', data)}
              createLabel="Create Location"
            />
          </div>
        )}

        {/* Flags & Notes */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">Options</h3>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="text-sm text-slate-300">Primary Contact</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVip}
                onChange={(e) => setIsVip(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="text-sm text-slate-300">VIP</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasPortalAccess}
                onChange={(e) => setHasPortalAccess(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="text-sm text-slate-300">Portal Access</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
              placeholder="Any additional notes about this contact..."
            />
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
            href="/portal/contacts"
            className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !firstName || !lastName}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Creating...
              </>
            ) : (
              'Create Contact'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
