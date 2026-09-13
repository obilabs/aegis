'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SHOW_UPCOMING_FEATURES } from '@/lib/features'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MasterDataSettings {
  enforce_departments: boolean
  enforce_locations: boolean
  enforce_job_titles: boolean
  enforce_asset_types: boolean
  enforce_asset_models: boolean
  enforce_vendors: boolean
  enforce_operating_systems: boolean
  allow_inline_creation: boolean
}

const DEFAULT_SETTINGS: MasterDataSettings = {
  enforce_departments: false,
  enforce_locations: false,
  enforce_job_titles: false,
  enforce_asset_types: true,
  enforce_asset_models: false,
  enforce_vendors: false,
  enforce_operating_systems: true,
  allow_inline_creation: true,
}

// ---------------------------------------------------------------------------
// Enforcement field definitions
// ---------------------------------------------------------------------------

interface EnforcementField {
  key: keyof MasterDataSettings
  label: string
  description: string
  manageHref: string | null
  comingSoon: boolean
}

const ALL_ENFORCEMENT_FIELDS: EnforcementField[] = [
  {
    key: 'enforce_departments',
    label: 'Departments',
    description: 'Require department selection from predefined list',
    manageHref: '/portal/settings/departments',
    comingSoon: false,
  },
  {
    key: 'enforce_locations',
    label: 'Locations',
    description: 'Require location selection from predefined list',
    manageHref: null,
    comingSoon: true,
  },
  {
    key: 'enforce_job_titles',
    label: 'Job Titles',
    description: 'Require job title selection from predefined list',
    manageHref: '/portal/settings/job-titles',
    comingSoon: false,
  },
  {
    key: 'enforce_asset_types',
    label: 'Asset Types',
    description: 'Require asset type selection from predefined catalog',
    manageHref: '/portal/settings/asset-catalog',
    comingSoon: false,
  },
  {
    key: 'enforce_asset_models',
    label: 'Asset Models',
    description: 'Require asset model selection from predefined catalog',
    manageHref: '/portal/settings/asset-catalog',
    comingSoon: false,
  },
  {
    key: 'enforce_vendors',
    label: 'Vendors',
    description: 'Require vendor selection from predefined list',
    manageHref: null,
    comingSoon: true,
  },
  {
    key: 'enforce_operating_systems',
    label: 'Operating Systems',
    description: 'Require OS selection from predefined list',
    manageHref: '/portal/settings/operating-systems',
    comingSoon: false,
  },
]

// Fields whose picklist is not built yet are listed only in development builds.
const ENFORCEMENT_FIELDS = ALL_ENFORCEMENT_FIELDS.filter(f => !f.comingSoon || SHOW_UPCOMING_FEATURES)

// ---------------------------------------------------------------------------
// Inline SVG Icons (consistent with other settings pages that use inline SVGs)
// ---------------------------------------------------------------------------

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function ArrowTopRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
  saving = false,
}: {
  enabled: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  saving?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled || saving}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${enabled ? 'bg-brand-600' : 'bg-slate-600'}
      `}
    >
      <span
        className={`
          pointer-events-none relative inline-block h-5 w-5 transform rounded-full
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      >
        {saving && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
          </span>
        )}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-4 w-20 bg-slate-700 rounded mb-3" />
        <div className="h-8 w-48 bg-slate-700 rounded mb-2" />
        <div className="h-4 w-96 bg-slate-700/60 rounded" />
      </div>

      {/* Enforcement card skeleton */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="h-6 w-52 bg-slate-700 rounded mb-1" />
        <div className="h-4 w-80 bg-slate-700/60 rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-700 rounded" />
                <div className="h-3 w-64 bg-slate-700/50 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-16 bg-slate-700/50 rounded" />
                <div className="h-6 w-11 bg-slate-700 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* General settings card skeleton */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="h-6 w-40 bg-slate-700 rounded mb-4" />
        <div className="flex items-center justify-between py-3">
          <div className="space-y-2">
            <div className="h-4 w-40 bg-slate-700 rounded" />
            <div className="h-3 w-72 bg-slate-700/50 rounded" />
          </div>
          <div className="h-6 w-11 bg-slate-700 rounded-full" />
        </div>
      </div>

      {/* Seed data card skeleton */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="h-6 w-28 bg-slate-700 rounded mb-4" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-700 rounded" />
            <div className="h-3 w-80 bg-slate-700/50 rounded" />
          </div>
          <div className="h-9 w-36 bg-slate-700 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function MasterDataSettingsPage() {
  const [settings, setSettings] = useState<MasterDataSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'success' | 'error'>('idle')
  const [seedMessage, setSeedMessage] = useState<string | null>(null)

  // -------------------------------------------
  // Fetch settings on mount
  // -------------------------------------------

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/master-data')
      if (!res.ok) {
        throw new Error('Failed to load master data settings')
      }
      const data = await res.json()
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }))
      }
    } catch (err: unknown) {
      console.error('Error fetching master data settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // -------------------------------------------
  // Toggle handler with optimistic update
  // -------------------------------------------

  async function handleToggle(key: keyof MasterDataSettings, newValue: boolean) {
    // Optimistic update
    const previousValue = settings[key]
    setSettings((prev) => ({ ...prev, [key]: newValue }))
    setSavingKeys((prev) => new Set(prev).add(key))

    try {
      const res = await fetch('/api/settings/master-data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      })

      if (!res.ok) {
        // Revert optimistic update
        setSettings((prev) => ({ ...prev, [key]: previousValue }))
        const data = await res.json().catch(() => ({}))
        console.error('Failed to save setting:', data.error || res.statusText)
      }
    } catch (err) {
      // Revert optimistic update on network error
      setSettings((prev) => ({ ...prev, [key]: previousValue }))
      console.error('Error saving setting:', err)
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // -------------------------------------------
  // Seed handler
  // -------------------------------------------

  async function handleSeed() {
    setSeedStatus('seeding')
    setSeedMessage(null)

    try {
      const res = await fetch('/api/portal/settings/master-data/seed', {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setSeedStatus('success')
        setSeedMessage(data.message || 'Default asset data seeded successfully.')
      } else {
        setSeedStatus('error')
        setSeedMessage(data.error || 'Failed to seed data. Please try again.')
      }
    } catch (err) {
      console.error('Error seeding data:', err)
      setSeedStatus('error')
      setSeedMessage('Network error. Please check your connection and try again.')
    }
  }

  // -------------------------------------------
  // Render
  // -------------------------------------------

  if (loading) {
    return (
      <div className="max-w-3xl">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Link
            href="/portal/settings"
            className="hover:text-brand-400 flex items-center gap-1 transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Settings
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Master Data</h1>
        <p className="text-slate-400 mt-1">
          Control which fields use predefined values vs freetext
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ================================================================== */}
      {/* Enforcement Settings Card                                          */}
      {/* ================================================================== */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Enforcement Settings</h2>
          <p className="text-sm text-slate-400 mt-1">
            When enforced, users must choose from predefined values instead of typing freetext.
          </p>
        </div>

        <div className="divide-y divide-slate-700/50">
          {ENFORCEMENT_FIELDS.map((field) => {
            const isEnabled = settings[field.key] as boolean
            const isSaving = savingKeys.has(field.key)

            return (
              <div
                key={field.key}
                className="px-6 py-4 flex items-center justify-between gap-4"
              >
                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{field.label}</span>
                    {isEnabled && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-500/20 text-brand-400 rounded">
                        ENFORCED
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{field.description}</p>
                </div>

                {/* Manage link */}
                <div className="flex-shrink-0">
                  {field.comingSoon ? (
                    <span className="text-xs text-slate-600 select-none">
                      Coming soon
                    </span>
                  ) : field.manageHref ? (
                    <Link
                      href={field.manageHref}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-400 transition-colors"
                    >
                      Manage
                      <ArrowTopRightIcon className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>

                {/* Toggle */}
                <ToggleSwitch
                  enabled={isEnabled}
                  onChange={(value) => handleToggle(field.key, value)}
                  saving={isSaving}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* ================================================================== */}
      {/* General Settings Card                                              */}
      {/* ================================================================== */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">General Settings</h2>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200">Allow Inline Creation</span>
              {settings.allow_inline_creation && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">
                  ON
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Let users create new lookup values while filling forms (even for enforced fields).
              When disabled, only admins can add new values through the settings pages.
            </p>
          </div>
          <ToggleSwitch
            enabled={settings.allow_inline_creation}
            onChange={(value) => handleToggle('allow_inline_creation', value)}
            saving={savingKeys.has('allow_inline_creation')}
          />
        </div>
      </div>

      {/* ================================================================== */}
      {/* Seed Data Card                                                     */}
      {/* ================================================================== */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DatabaseIcon className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-100">Seed Data</h2>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-200">Seed Default Asset Data</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Pre-populate asset types, subtypes, and operating systems with common values.
              Existing records will not be duplicated.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seedStatus === 'seeding'}
            className={`
              flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${seedStatus === 'success'
                ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                : seedStatus === 'error'
                  ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                  : 'bg-brand-600 text-white hover:bg-brand-500'
              }
            `}
          >
            {seedStatus === 'seeding' && (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {seedStatus === 'success' && (
              <CheckCircleIcon className="h-4 w-4" />
            )}
            {seedStatus === 'error' && (
              <ExclamationTriangleIcon className="h-4 w-4" />
            )}
            {seedStatus === 'seeding'
              ? 'Seeding...'
              : seedStatus === 'success'
                ? 'Seeded'
                : seedStatus === 'error'
                  ? 'Retry'
                  : 'Seed Default Data'
            }
          </button>
        </div>

        {/* Seed status message */}
        {seedMessage && (
          <div
            className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
              seedStatus === 'success'
                ? 'bg-brand-500/10 border border-brand-500/20 text-brand-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {seedStatus === 'success' ? (
              <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
            )}
            {seedMessage}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Info footer                                                        */}
      {/* ================================================================== */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-400">How enforcement works:</strong>{' '}
          When a field is enforced, form inputs switch from freetext to a dropdown
          populated by the corresponding lookup table. Existing freetext values are preserved
          but new entries must match predefined options. Toggle &ldquo;Allow Inline Creation&rdquo;
          to let non-admin users add new values on the fly.
        </p>
      </div>
    </div>
  )
}
