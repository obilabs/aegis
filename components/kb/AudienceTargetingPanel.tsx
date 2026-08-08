'use client'

import { useState, useEffect, useCallback } from 'react'

interface SelectOption {
  id: string
  name: string
}

export type AudienceKind = 'none' | 'internal' | 'targeted'

interface AudienceTargetingPanelProps {
  audienceKind: AudienceKind
  requiredForRoles: string[]
  requiredForCompanies: string[]
  requiredForLocations: string[]
  requiredForDepartments: string[]
  requiredForJobTitles: string[]
  requiredForEmploymentTypes: string[]
  requiredForContactGroups: string[]
  onAudienceKindChange: (kind: AudienceKind) => void
  onRequiredForRolesChange: (ids: string[]) => void
  onRequiredForCompaniesChange: (ids: string[]) => void
  onRequiredForLocationsChange: (ids: string[]) => void
  onRequiredForDepartmentsChange: (ids: string[]) => void
  onRequiredForJobTitlesChange: (ids: string[]) => void
  onRequiredForEmploymentTypesChange: (ids: string[]) => void
  onRequiredForContactGroupsChange: (ids: string[]) => void
  validationError?: string | null
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  loading,
}: {
  label: string
  options: SelectOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  loading: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const toggleOption = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(s => s !== id))
    else onChange([...selected, id])
  }
  const selectedNames = options.filter(o => selected.includes(o.id)).map(o => o.name)
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors"
      >
        {loading ? <span className="text-slate-500">Loading...</span>
          : selectedNames.length > 0
            ? <span className="truncate block">{selectedNames.length <= 2 ? selectedNames.join(', ') : `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} more`}</span>
            : <span className="text-slate-500">Select {label.toLowerCase()}...</span>}
        <svg className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          {options.length === 0
            ? <div className="px-3 py-2 text-sm text-slate-500">No options available</div>
            : options.map(option => (
              <button key={option.id} type="button" onClick={() => toggleOption(option.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(option.id) ? 'bg-brand-500 border-brand-500' : 'border-slate-600'}`}>
                  {selected.includes(option.id) && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className="text-slate-200 truncate">{option.name}</span>
              </button>
            ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {options.filter(o => selected.includes(o.id)).map(option => (
            <span key={option.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-brand-500/15 text-brand-400 border border-brand-500/20 rounded">
              {option.name}
              <button type="button" onClick={() => toggleOption(option.id)} className="hover:text-brand-300">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const KIND_OPTIONS: { value: AudienceKind; label: string; description: string }[] = [
  { value: 'internal', label: 'All employees', description: 'Every employee must acknowledge. External contacts (customers, vendors, partners) are not required.' },
  { value: 'targeted', label: 'Specific audience', description: 'Pick which roles / departments / job titles / etc. must acknowledge.' },
  { value: 'none', label: 'Nobody', description: 'Informational only — no acknowledgment is tracked.' },
]

/**
 * Audience targeting for who MUST acknowledge a policy / pass a quiz.
 * Distinct from AudienceScopingPanel (which controls who can READ the article).
 *
 * Spec: openspec/changes/policy-audience/proposal.md (D42-D48)
 * Migration 081 added required_for_audience_kind + 7 required_for_* arrays.
 *
 * Renders only when the article is acknowledgment-required (caller decides
 * based on requires_acknowledgment + article_type).
 */
export default function AudienceTargetingPanel({
  audienceKind,
  requiredForRoles, requiredForCompanies, requiredForLocations,
  requiredForDepartments, requiredForJobTitles, requiredForEmploymentTypes,
  requiredForContactGroups,
  onAudienceKindChange,
  onRequiredForRolesChange, onRequiredForCompaniesChange, onRequiredForLocationsChange,
  onRequiredForDepartmentsChange, onRequiredForJobTitlesChange, onRequiredForEmploymentTypesChange,
  onRequiredForContactGroupsChange,
  validationError,
}: AudienceTargetingPanelProps) {
  const [roles, setRoles] = useState<SelectOption[]>([])
  const [companies, setCompanies] = useState<SelectOption[]>([])
  const [locations, setLocations] = useState<SelectOption[]>([])
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [jobTitles, setJobTitles] = useState<SelectOption[]>([])
  const [employmentTypes, setEmploymentTypes] = useState<SelectOption[]>([])
  const [contactGroups, setContactGroups] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, companiesRes, locationsRes, deptsRes, jtRes, etRes, cgRes] = await Promise.all([
        fetch('/api/settings/roles').then(r => r.json()).catch(() => ({ roles: [] })),
        fetch('/api/portal/companies').then(r => r.json()).catch(() => ({ companies: [] })),
        fetch('/api/portal/locations').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/departments').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/job-titles').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/employment-types').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/contact-groups').then(r => r.json()).catch(() => ({ items: [] })),
      ])
      setRoles((rolesRes.roles || []).map((r: any) => ({ id: r.id, name: r.name })))
      setCompanies((companiesRes.companies || []).map((c: any) => ({ id: c.id, name: c.name })))
      setLocations((locationsRes.items || []).map((l: any) => ({ id: l.id, name: l.name })))
      setDepartments((deptsRes.items || []).map((d: any) => ({ id: d.id, name: d.name })))
      setJobTitles((jtRes.items || []).map((j: any) => ({ id: j.id, name: j.name })))
      setEmploymentTypes((etRes.items || []).map((e: any) => ({ id: e.id, name: e.name })))
      setContactGroups((cgRes.items || cgRes.groups || []).map((g: any) => ({ id: g.id, name: g.name })))
    } catch (error) {
      console.error('Failed to fetch audience options:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (audienceKind === 'targeted') fetchOptions()
  }, [audienceKind, fetchOptions])

  const totalSelected =
    requiredForRoles.length + requiredForCompanies.length + requiredForLocations.length +
    requiredForDepartments.length + requiredForJobTitles.length +
    requiredForEmploymentTypes.length + requiredForContactGroups.length

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Acknowledgment Audience
          </h3>
          <p className="text-xs text-slate-500 mt-1">Who must acknowledge this article</p>
        </div>
        {audienceKind === 'targeted' && totalSelected > 0 && (
          <span className="px-2 py-0.5 text-xs bg-brand-500/15 text-brand-400 rounded">
            {totalSelected} target{totalSelected !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {KIND_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              audienceKind === opt.value
                ? 'bg-brand-500/10 border-brand-500/40'
                : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
            }`}
          >
            <input
              type="radio"
              name="audience-kind"
              checked={audienceKind === opt.value}
              onChange={() => onAudienceKindChange(opt.value)}
              className="mt-0.5 accent-brand-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">{opt.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
            </div>
          </label>
        ))}
      </div>

      {validationError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <svg className="h-4 w-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-xs text-red-400">{validationError}</p>
        </div>
      )}

      {audienceKind === 'targeted' && (
        <>
          <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <svg className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <p className="text-xs text-blue-300/80">
              A user must acknowledge if they match <strong className="text-blue-300">ANY</strong> of the selected criteria. Pick at least one axis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MultiSelect label="Roles" options={roles} selected={requiredForRoles} onChange={onRequiredForRolesChange} loading={loading} />
            <MultiSelect label="Departments" options={departments} selected={requiredForDepartments} onChange={onRequiredForDepartmentsChange} loading={loading} />
            <MultiSelect label="Job Titles" options={jobTitles} selected={requiredForJobTitles} onChange={onRequiredForJobTitlesChange} loading={loading} />
            <MultiSelect label="Employment Types" options={employmentTypes} selected={requiredForEmploymentTypes} onChange={onRequiredForEmploymentTypesChange} loading={loading} />
            <MultiSelect label="Companies" options={companies} selected={requiredForCompanies} onChange={onRequiredForCompaniesChange} loading={loading} />
            <MultiSelect label="Locations" options={locations} selected={requiredForLocations} onChange={onRequiredForLocationsChange} loading={loading} />
            <MultiSelect label="Contact Groups" options={contactGroups} selected={requiredForContactGroups} onChange={onRequiredForContactGroupsChange} loading={loading} />
          </div>
        </>
      )}
    </div>
  )
}
