'use client'

import { useState, useEffect } from 'react'

interface Application {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  access_levels: string[]
  requires_approval: boolean
  approval_levels: number
  provisioning_notes: string | null
  cost_per_license: number | null
  license_type: string | null
  is_active: boolean
  owner_id: string | null
  owner_name: string | null
  vendor_id: string | null
  vendor_name: string | null
  created_at: string
}

const emptyForm = {
  name: '',
  description: '',
  access_levels: ['Standard'],
  requires_approval: true,
  approval_levels: 1,
  provisioning_notes: '',
  cost_per_license: '',
  license_type: '',
}

export default function ApplicationsSettingsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newLevel, setNewLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetchApplications()
  }, [])

  async function fetchApplications() {
    try {
      const res = await fetch('/api/portal/settings/applications')
      if (res.ok) {
        const data = await res.json()
        setApplications(data.applications || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(app: Application) {
    setEditing(app)
    setForm({
      name: app.name,
      description: app.description || '',
      access_levels: app.access_levels || ['Standard'],
      requires_approval: app.requires_approval,
      approval_levels: app.approval_levels,
      provisioning_notes: app.provisioning_notes || '',
      cost_per_license: app.cost_per_license?.toString() || '',
      license_type: app.license_type || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        cost_per_license: form.cost_per_license ? parseFloat(form.cost_per_license) : null,
        license_type: form.license_type || null,
        provisioning_notes: form.provisioning_notes || null,
        description: form.description || null,
      }

      if (editing) {
        await fetch(`/api/portal/settings/applications/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/portal/settings/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setShowModal(false)
      fetchApplications()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(app: Application) {
    await fetch(`/api/portal/settings/applications/${app.id}`, {
      method: app.is_active ? 'DELETE' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !app.is_active }),
    })
    fetchApplications()
  }

  function addAccessLevel() {
    if (newLevel.trim() && !form.access_levels.includes(newLevel.trim())) {
      setForm({ ...form, access_levels: [...form.access_levels, newLevel.trim()] })
      setNewLevel('')
    }
  }

  function removeAccessLevel(level: string) {
    setForm({ ...form, access_levels: form.access_levels.filter(l => l !== level) })
  }

  const visible = showInactive ? applications : applications.filter(a => a.is_active)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Applications</h1>
          <p className="text-slate-400 mt-1">Manage the application registry for service catalog requests</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
        >
          Add Application
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-brand-500"
          />
          Show inactive
        </label>
        <span className="text-sm text-slate-500">{visible.length} application{visible.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Access Levels</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Approval</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Cost</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Owner</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No applications yet. Add your first application to get started.
                </td>
              </tr>
            ) : (
              visible.map((app) => (
                <tr key={app.id} className="hover:bg-slate-700/50">
                  <td className="p-4">
                    <p className="font-medium text-slate-200">{app.name}</p>
                    {app.description && <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[300px]">{app.description}</p>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {app.access_levels?.map((level) => (
                        <span key={level} className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                          {level}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-300">
                    {app.requires_approval ? (
                      <span className="text-amber-400">Required</span>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-300">
                    {app.cost_per_license ? `$${app.cost_per_license}/license` : '—'}
                  </td>
                  <td className="p-4 text-sm text-slate-300">
                    {app.owner_name || '—'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      app.is_active
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {app.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(app)}
                        className="text-sm text-slate-400 hover:text-brand-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(app)}
                        className={`text-sm ${app.is_active ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-brand-400'}`}
                      >
                        {app.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">
                {editing ? 'Edit Application' : 'Add Application'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                  placeholder="e.g., Slack, Jira, Figma"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Access Levels</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.access_levels.map((level) => (
                    <span key={level} className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded flex items-center gap-1">
                      {level}
                      <button onClick={() => removeAccessLevel(level)} className="text-slate-500 hover:text-red-400">&times;</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAccessLevel())}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200"
                    placeholder="Add level (e.g., Viewer, Editor, Admin)"
                  />
                  <button onClick={addAccessLevel} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600">
                    Add
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.requires_approval}
                      onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800 text-brand-500"
                    />
                    Requires approval
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Cost per license</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.cost_per_license}
                    onChange={(e) => setForm({ ...form, cost_per_license: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">License Type</label>
                <input
                  type="text"
                  value={form.license_type}
                  onChange={(e) => setForm({ ...form, license_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200"
                  placeholder="e.g., Per user, Per seat, Site license"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Provisioning Notes</label>
                <textarea
                  value={form.provisioning_notes}
                  onChange={(e) => setForm({ ...form, provisioning_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200"
                  rows={2}
                  placeholder="Instructions for IT staff when provisioning this application"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
