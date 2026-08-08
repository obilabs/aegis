'use client'

import { useState, useEffect, useCallback } from 'react'

interface SelectOption {
  id: string
  name: string
}

interface AudienceScopingPanelProps {
  visibility: string
  visibleToRoles: string[]
  visibleToCompanies: string[]
  visibleToLocations: string[]
  visibleToDepartments: string[]
  visibleToJobTitles: string[]
  visibleToEmploymentTypes: string[]
  onVisibleToRolesChange: (ids: string[]) => void
  onVisibleToCompaniesChange: (ids: string[]) => void
  onVisibleToLocationsChange: (ids: string[]) => void
  onVisibleToDepartmentsChange: (ids: string[]) => void
  onVisibleToJobTitlesChange: (ids: string[]) => void
  onVisibleToEmploymentTypesChange: (ids: string[]) => void
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
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const selectedNames = options
    .filter(o => selected.includes(o.id))
    .map(o => o.name)

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors"
      >
        {loading ? (
          <span className="text-slate-500">Loading...</span>
        ) : selectedNames.length > 0 ? (
          <span className="truncate block">
            {selectedNames.length <= 2
              ? selectedNames.join(', ')
              : `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} more`}
          </span>
        ) : (
          <span className="text-slate-500">Select {label.toLowerCase()}...</span>
        )}
        <svg
          className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(option.id)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 flex items-center gap-2 transition-colors"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selected.includes(option.id)
                      ? 'bg-brand-500 border-brand-500'
                      : 'border-slate-600'
                  }`}
                >
                  {selected.includes(option.id) && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className="text-slate-200 truncate">{option.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {options
            .filter(o => selected.includes(o.id))
            .map((option) => (
              <span
                key={option.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-brand-500/15 text-brand-400 border border-brand-500/20 rounded"
              >
                {option.name}
                <button
                  type="button"
                  onClick={() => toggleOption(option.id)}
                  className="hover:text-brand-300"
                >
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

export default function AudienceScopingPanel({
  visibility,
  visibleToRoles,
  visibleToCompanies,
  visibleToLocations,
  visibleToDepartments,
  visibleToJobTitles,
  visibleToEmploymentTypes,
  onVisibleToRolesChange,
  onVisibleToCompaniesChange,
  onVisibleToLocationsChange,
  onVisibleToDepartmentsChange,
  onVisibleToJobTitlesChange,
  onVisibleToEmploymentTypesChange,
  validationError,
}: AudienceScopingPanelProps) {
  const [roles, setRoles] = useState<SelectOption[]>([])
  const [companies, setCompanies] = useState<SelectOption[]>([])
  const [locations, setLocations] = useState<SelectOption[]>([])
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [jobTitles, setJobTitles] = useState<SelectOption[]>([])
  const [employmentTypes, setEmploymentTypes] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, companiesRes, locationsRes, deptsRes, jtRes, etRes] = await Promise.all([
        fetch('/api/settings/roles').then(r => r.json()).catch(() => ({ roles: [] })),
        fetch('/api/portal/companies').then(r => r.json()).catch(() => ({ companies: [] })),
        fetch('/api/portal/locations').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/departments').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/job-titles').then(r => r.json()).catch(() => ({ items: [] })),
        fetch('/api/portal/employment-types').then(r => r.json()).catch(() => ({ items: [] })),
      ])

      setRoles((rolesRes.roles || []).map((r: any) => ({ id: r.id, name: r.name })))
      setCompanies((companiesRes.companies || []).map((c: any) => ({ id: c.id, name: c.name })))
      setLocations((locationsRes.items || []).map((l: any) => ({ id: l.id, name: l.name })))
      setDepartments((deptsRes.items || []).map((d: any) => ({ id: d.id, name: d.name })))
      setJobTitles((jtRes.items || []).map((j: any) => ({ id: j.id, name: j.name })))
      setEmploymentTypes((etRes.items || []).map((e: any) => ({ id: e.id, name: e.name })))
    } catch (error) {
      console.error('Failed to fetch audience options:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visibility === 'private') {
      fetchOptions()
    }
  }, [visibility, fetchOptions])

  // Don't render if visibility is not private
  if (visibility !== 'private') {
    return null
  }

  const totalSelected =
    visibleToRoles.length +
    visibleToCompanies.length +
    visibleToLocations.length +
    visibleToDepartments.length +
    visibleToJobTitles.length +
    visibleToEmploymentTypes.length

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Audience Scoping
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Define who can see this private article
          </p>
        </div>
        {totalSelected > 0 && (
          <span className="px-2 py-0.5 text-xs bg-brand-500/15 text-brand-400 rounded">
            {totalSelected} rule{totalSelected !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Help text: OR-logic explanation */}
      <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <svg className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <p className="text-xs text-blue-300/80">
          Access is granted if the viewer matches <strong className="text-blue-300">ANY</strong> of the selected criteria.
          For example, selecting a department and an employment type means anyone in that department OR with that employment type can view the article.
        </p>
      </div>

      {validationError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <svg className="h-4 w-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-xs text-red-400">{validationError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MultiSelect
          label="Roles"
          options={roles}
          selected={visibleToRoles}
          onChange={onVisibleToRolesChange}
          loading={loading}
        />
        <MultiSelect
          label="Companies"
          options={companies}
          selected={visibleToCompanies}
          onChange={onVisibleToCompaniesChange}
          loading={loading}
        />
        <MultiSelect
          label="Locations"
          options={locations}
          selected={visibleToLocations}
          onChange={onVisibleToLocationsChange}
          loading={loading}
        />
        <MultiSelect
          label="Departments"
          options={departments}
          selected={visibleToDepartments}
          onChange={onVisibleToDepartmentsChange}
          loading={loading}
        />
        <MultiSelect
          label="Job Titles"
          options={jobTitles}
          selected={visibleToJobTitles}
          onChange={onVisibleToJobTitlesChange}
          loading={loading}
        />
        <MultiSelect
          label="Employment Types"
          options={employmentTypes}
          selected={visibleToEmploymentTypes}
          onChange={onVisibleToEmploymentTypesChange}
          loading={loading}
        />
      </div>
    </div>
  )
}
