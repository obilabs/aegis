'use client'

import { useState, useEffect } from 'react'

export interface FormField {
  name: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox'
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
  source?: string  // 'applications' or 'application.access_levels'
}

interface DynamicFormRendererProps {
  fields: FormField[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  errors?: Record<string, string>
}

interface AppOption {
  id: string
  name: string
  access_levels: string[]
}

export default function DynamicFormRenderer({ fields, values, onChange, errors }: DynamicFormRendererProps) {
  const [applications, setApplications] = useState<AppOption[]>([])
  const [loadingApps, setLoadingApps] = useState(false)

  // Load applications if any field has source: 'applications'
  useEffect(() => {
    const hasAppField = fields.some(f => f.source === 'applications')
    if (hasAppField) {
      setLoadingApps(true)
      fetch('/api/portal/applications')
        .then(res => res.json())
        .then(data => setApplications(data.applications || []))
        .catch(() => {})
        .finally(() => setLoadingApps(false))
    }
  }, [fields])

  function setValue(name: string, value: any) {
    const next = { ...values, [name]: value }

    // When application changes, clear access level
    const field = fields.find(f => f.name === name)
    if (field?.source === 'applications') {
      const accessField = fields.find(f => f.source === 'application.access_levels')
      if (accessField) {
        next[accessField.name] = ''
      }
    }

    onChange(next)
  }

  function getAccessLevels(): string[] {
    const appField = fields.find(f => f.source === 'applications')
    if (!appField) return []
    const selectedAppId = values[appField.name]
    const app = applications.find(a => a.id === selectedAppId)
    return app?.access_levels || []
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const error = errors?.[field.name]
        const inputBase = "w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 focus:outline-none"
        const inputClass = `${inputBase} ${error ? 'border-red-500' : 'border-slate-600 focus:border-brand-500'}`

        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {field.type === 'text' && (
              <input
                type="text"
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
                placeholder={field.placeholder}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
                rows={3}
                placeholder={field.placeholder}
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
                placeholder={field.placeholder}
              />
            )}

            {field.type === 'date' && (
              <input
                type="date"
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
              />
            )}

            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values[field.name] || false}
                  onChange={(e) => setValue(field.name, e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-brand-500"
                />
                <span className="text-sm text-slate-300">{field.label}</span>
              </label>
            )}

            {field.type === 'select' && field.source === 'applications' && (
              <select
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
                disabled={loadingApps}
              >
                <option value="">{loadingApps ? 'Loading...' : 'Select an application'}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            )}

            {field.type === 'select' && field.source === 'application.access_levels' && (
              <select
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
              >
                <option value="">Select access level</option>
                {getAccessLevels().map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            )}

            {field.type === 'select' && !field.source && field.options && (
              <select
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={inputClass}
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Validate form values against field definitions.
 * Returns a map of field name → error message.
 */
export function validateFormFields(fields: FormField[], values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    if (field.required) {
      const val = values[field.name]
      if (val === undefined || val === null || val === '' || val === false) {
        errors[field.name] = `${field.label} is required`
      }
    }
  }

  return errors
}
