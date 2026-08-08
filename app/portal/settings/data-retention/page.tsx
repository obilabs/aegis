'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'

interface RetentionPolicy {
  id: string
  entity_type: string
  retention_mode: 'manual_only' | 'auto_purge'
  retention_days: number | null
  exempt_if_closed: boolean
}

const ENTITY_LABELS: Record<string, { label: string; description: string }> = {
  contacts: { label: 'Contacts', description: 'Employee, customer, vendor, and partner records' },
  tickets: { label: 'Tickets', description: 'Support tickets and service requests' },
  assets: { label: 'Assets', description: 'Hardware, software, and infrastructure assets' },
  credentials: { label: 'Credentials', description: 'Passwords, API keys, and certificates' },
  kb_articles: { label: 'KB Articles', description: 'Knowledge base articles and documentation' },
  documents: { label: 'Documents', description: 'Uploaded files and generated documents' },
}

export default function DataRetentionPage() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingDays, setEditingDays] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPolicies()
  }, [])

  async function fetchPolicies() {
    try {
      const res = await fetch('/api/settings/data-retention')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPolicies(data.policies)
      // Initialize editingDays from policies
      const days: Record<string, string> = {}
      for (const p of data.policies) {
        days[p.entity_type] = p.retention_days?.toString() || '365'
      }
      setEditingDays(days)
    } catch {
      setMessage({ type: 'error', text: 'Failed to load retention policies' })
    } finally {
      setLoading(false)
    }
  }

  async function updatePolicy(entityType: string, updates: Partial<RetentionPolicy>) {
    setSaving(entityType)
    setMessage(null)
    try {
      const res = await fetch(`/api/settings/data-retention/${entityType}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update')
      }
      const data = await res.json()
      setPolicies(prev => prev.map(p => p.entity_type === entityType ? data.policy : p))
      setMessage({ type: 'success', text: `${ENTITY_LABELS[entityType]?.label || entityType} retention updated` })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(null)
    }
  }

  function handleModeToggle(entityType: string, currentMode: string) {
    const newMode = currentMode === 'manual_only' ? 'auto_purge' : 'manual_only'
    const updates: Partial<RetentionPolicy> = { retention_mode: newMode as any }
    if (newMode === 'auto_purge') {
      updates.retention_days = parseInt(editingDays[entityType] || '365') || 365
    } else {
      updates.retention_days = null
    }
    updatePolicy(entityType, updates)
  }

  function handleDaysSave(entityType: string) {
    const days = parseInt(editingDays[entityType] || '365')
    if (days < 365) {
      setMessage({ type: 'error', text: 'Minimum retention period is 365 days' })
      return
    }
    updatePolicy(entityType, { retention_days: days })
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/portal/settings" className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-4">
          <ArrowLeftIcon className="h-4 w-4" />
          Settings
        </Link>
        <div className="flex items-center gap-3">
          <ArchiveBoxIcon className="h-8 w-8 text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Data Retention</h1>
            <p className="text-slate-400 text-sm mt-1">
              Configure how long soft-deleted records are retained before permanent purge.
              Default: Manual Only (no auto-purge).
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Policies Table */}
      <div className="space-y-4">
        {policies.map(policy => {
          const info = ENTITY_LABELS[policy.entity_type] || { label: policy.entity_type, description: '' }
          const isAutoPurge = policy.retention_mode === 'auto_purge'
          const isSaving = saving === policy.entity_type

          return (
            <div
              key={policy.entity_type}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium">{info.label}</h3>
                  <p className="text-slate-400 text-sm mt-0.5">{info.description}</p>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm ${isAutoPurge ? 'text-amber-400' : 'text-slate-400'}`}>
                    {isAutoPurge ? 'Auto-Purge' : 'Manual Only'}
                  </span>
                  <button
                    onClick={() => handleModeToggle(policy.entity_type, policy.retention_mode)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isAutoPurge ? 'bg-amber-500' : 'bg-slate-600'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isAutoPurge ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Auto-purge settings (shown when enabled) */}
              {isAutoPurge && (
                <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-400">Retention period:</label>
                    <input
                      type="number"
                      min="365"
                      value={editingDays[policy.entity_type] || '365'}
                      onChange={e => setEditingDays(prev => ({ ...prev, [policy.entity_type]: e.target.value }))}
                      className="w-24 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-sm text-slate-400">days</span>
                    <button
                      onClick={() => handleDaysSave(policy.entity_type)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-brand-500/20 text-brand-400 rounded text-sm hover:bg-brand-500/30 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>

                  {/* Exempt if closed toggle (tickets only) */}
                  {policy.entity_type === 'tickets' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updatePolicy('tickets', { exempt_if_closed: !policy.exempt_if_closed })}
                        disabled={isSaving}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          policy.exempt_if_closed ? 'bg-brand-500' : 'bg-slate-600'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          policy.exempt_if_closed ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                      <span className="text-sm text-slate-400">Exempt closed tickets from purge</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-300 mb-2">How it works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Manual Only</strong> — deleted records are kept indefinitely. Admins can manually purge from the trash view.</li>
          <li><strong>Auto-Purge</strong> — deleted records older than the retention period are permanently removed daily at 2:00 AM UTC.</li>
          <li>Minimum retention period is 365 days.</li>
          <li>Audit logs are never purged regardless of settings.</li>
          <li>Records under legal hold are always exempt from purge.</li>
        </ul>
      </div>
    </div>
  )
}
