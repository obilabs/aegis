'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OperatingSystem {
  id: string
  platform: string
  name: string
  version: string | null
  build: string | null
  is_active: boolean
  sort_order: number
}

const PLATFORMS = ['windows', 'macos', 'linux', 'ios', 'android', 'chromeos'] as const

const platformLabels: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  ios: 'iOS',
  android: 'Android',
  chromeos: 'ChromeOS',
}

const platformColors: Record<string, string> = {
  windows: 'text-blue-400 bg-blue-500/20',
  macos: 'text-slate-300 bg-slate-500/20',
  linux: 'text-amber-400 bg-amber-500/20',
  ios: 'text-slate-300 bg-slate-500/20',
  android: 'text-green-400 bg-green-500/20',
  chromeos: 'text-cyan-400 bg-cyan-500/20',
}

export default function OperatingSystemsPage() {
  const [osList, setOsList] = useState<OperatingSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ platform: 'windows', name: '', version: '', build: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchOS()
  }, [platformFilter])

  async function fetchOS() {
    try {
      const url = platformFilter === 'all'
        ? '/api/portal/settings/operating-systems'
        : `/api/portal/settings/operating-systems?platform=${platformFilter}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOsList(data.operating_systems || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/portal/settings/operating-systems/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/portal/settings/operating-systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
      setShowAdd(false)
      setEditingId(null)
      setForm({ platform: 'windows', name: '', version: '', build: '' })
      fetchOS()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this operating system entry?')) return
    try {
      await fetch(`/api/portal/settings/operating-systems/${id}`, { method: 'DELETE' })
      fetchOS()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  function startEdit(os: OperatingSystem) {
    setEditingId(os.id)
    setForm({ platform: os.platform, name: os.name, version: os.version || '', build: os.build || '' })
    setShowAdd(true)
  }

  const grouped = osList.reduce((acc, os) => {
    if (!acc[os.platform]) acc[os.platform] = []
    acc[os.platform].push(os)
    return acc
  }, {} as Record<string, OperatingSystem[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link href="/portal/settings" className="hover:text-slate-200">Settings</Link>
            <span>/</span>
            <span className="text-slate-200">Operating Systems</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Operating Systems</h1>
          <p className="text-slate-400 mt-1">Predefined OS entries for asset assignment</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setForm({ platform: 'windows', name: '', version: '', build: '' }) }}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors text-sm font-medium"
        >
          Add OS
        </button>
      </div>

      {/* Platform filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            platformFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          All
        </button>
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              platformFilter === p ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {platformLabels[p]}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">{editingId ? 'Edit' : 'Add'} Operating System</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={form.platform}
              onChange={e => setForm({ ...form, platform: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{platformLabels[p]}</option>
              ))}
            </select>
            <input
              placeholder="Name (e.g. Windows 11 Pro)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <input
              placeholder="Version (e.g. 24H2)"
              value={form.version}
              onChange={e => setForm({ ...form, version: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <div className="flex gap-2">
              <input
                placeholder="Build (optional)"
                value={form.build}
                onChange={e => setForm({ ...form, build: e.target.value })}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 flex-1"
              />
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setEditingId(null) }}
                className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OS List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 p-4 animate-pulse">
              <div className="h-5 bg-slate-700 rounded w-32 mb-3" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-700 rounded w-48" />
                <div className="h-4 bg-slate-700 rounded w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : osList.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <p className="text-slate-400">No operating systems defined yet.</p>
          <p className="text-sm text-slate-500 mt-1">
            Go to <Link href="/portal/settings/master-data" className="text-brand-400 hover:underline">Master Data</Link> to seed default values, or add them manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(platformFilter === 'all' ? Object.keys(grouped).sort() : [platformFilter]).map(platform => {
            const items = grouped[platform]
            if (!items || items.length === 0) return null
            return (
              <div key={platform} className="bg-slate-800 rounded-lg border border-slate-700">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${platformColors[platform] || 'text-slate-400 bg-slate-700'}`}>
                    {platformLabels[platform] || platform}
                  </span>
                  <span className="text-xs text-slate-500">{items.length} entries</span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {items.map(os => (
                    <div key={os.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-200">{os.name}</span>
                        {os.version && (
                          <span className="text-xs text-slate-500">v{os.version}</span>
                        )}
                        {os.build && (
                          <span className="text-xs text-slate-600">Build {os.build}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(os)}
                          className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(os.id)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
