'use client'

import { useState, useEffect } from 'react'

interface TicketType {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  default_priority: string
  requires_approval: boolean
  is_visible: boolean
  description_template: string | null
  sla_response_minutes: number | null
  sla_resolution_minutes: number | null
}

const TYPE_ICONS: Record<string, string> = {
  Incident: '\u26A0\uFE0F',
  'Service Request': '\uD83D\uDCCB',
  Problem: '\uD83D\uDD0D',
  'Change Request': '\uD83D\uDD00',
}

const TYPE_COLORS: Record<string, string> = {
  Incident: 'red',
  'Service Request': 'blue',
  Problem: 'purple',
  'Change Request': 'amber',
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return '--'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

export default function TicketTypesPage() {
  const [types, setTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TicketType | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Edit form state
  const [editTemplate, setEditTemplate] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editApproval, setEditApproval] = useState(false)
  const [editSlaResponse, setEditSlaResponse] = useState('')
  const [editSlaResolution, setEditSlaResolution] = useState('')

  useEffect(() => {
    fetch('/api/portal/settings/ticket-types')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.types) setTypes(data.types)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleEdit = (type: TicketType) => {
    setEditing(type)
    setEditTemplate(type.description_template || '')
    setEditPriority(type.default_priority || 'medium')
    setEditApproval(type.requires_approval)
    setEditSlaResponse(type.sla_response_minutes?.toString() || '')
    setEditSlaResolution(type.sla_resolution_minutes?.toString() || '')
    setSaveMsg('')
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setSaveMsg('')

    try {
      const body: Record<string, unknown> = {
        description_template: editTemplate || null,
        default_priority: editPriority,
        requires_approval: editApproval,
        sla_response_minutes: editSlaResponse ? parseInt(editSlaResponse, 10) : null,
        sla_resolution_minutes: editSlaResolution ? parseInt(editSlaResolution, 10) : null,
      }

      const res = await fetch(`/api/portal/settings/ticket-types/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setTypes(prev => prev.map(t => t.id === updated.id ? updated : t))
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save')
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Ticket Types</h1>
        <p className="text-slate-400 mt-1">Configure ticket types, templates, SLA targets, and approval requirements</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Type List */}
        <div className="lg:col-span-1 space-y-3">
          {types.map(type => {
            const colorName = TYPE_COLORS[type.name] || 'slate'
            const isSelected = editing?.id === type.id
            return (
              <button
                key={type.id}
                onClick={() => handleEdit(type)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-brand-500/10 border-brand-500/50'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_ICONS[type.name] || type.icon || '\u2753'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200">{type.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>Priority: {type.default_priority}</span>
                      <span>SLA: {formatMinutes(type.sla_response_minutes)} / {formatMinutes(type.sla_resolution_minutes)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {type.requires_approval && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                        Approval
                      </span>
                    )}
                    {type.description_template && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-500/20 text-brand-400 rounded">
                        Template
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {types.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No ticket types configured. Run the setup wizard to create defaults.
            </div>
          )}
        </div>

        {/* Edit Panel */}
        <div className="lg:col-span-2">
          {editing ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_ICONS[editing.name] || '\u2753'}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{editing.name}</h2>
                    <p className="text-sm text-slate-400">Configure type settings and description template</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Description Template */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description Template
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Pre-fills the description when creating tickets of this type. Use [brackets] for placeholder text.
                </p>
                <textarea
                  rows={8}
                  value={editTemplate}
                  onChange={(e) => setEditTemplate(e.target.value)}
                  placeholder="Enter a template that will appear when users create this ticket type..."
                  className="w-full px-4 py-3 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none font-mono"
                />
              </div>

              {/* Default Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Priority
                </label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high', 'critical'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                        editPriority === p
                          ? p === 'low' ? 'bg-slate-500/10 border-slate-500/50 text-slate-300' :
                            p === 'medium' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' :
                            p === 'high' ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' :
                            'bg-red-500/10 border-red-500/50 text-red-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Requires Approval */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Requires Approval
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    New tickets of this type will start in "Pending Approval" status
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditApproval(!editApproval)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editApproval ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editApproval ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* SLA Targets */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  SLA Targets (minutes)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">First Response</label>
                    <input
                      type="number"
                      value={editSlaResponse}
                      onChange={(e) => setEditSlaResponse(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                    />
                    {editSlaResponse && (
                      <p className="text-xs text-slate-500 mt-1">= {formatMinutes(parseInt(editSlaResponse, 10))}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Resolution</label>
                    <input
                      type="number"
                      value={editSlaResolution}
                      onChange={(e) => setEditSlaResolution(e.target.value)}
                      placeholder="e.g. 480"
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                    />
                    {editSlaResolution && (
                      <p className="text-xs text-slate-500 mt-1">= {formatMinutes(parseInt(editSlaResolution, 10))}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                {saveMsg && (
                  <span className={`text-sm ${saveMsg === 'Saved' ? 'text-brand-400' : 'text-red-400'}`}>
                    {saveMsg}
                  </span>
                )}
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 font-medium transition-colors text-sm"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-12 flex flex-col items-center justify-center text-center">
              <svg className="h-12 w-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              <p className="text-slate-400 text-sm">Select a ticket type from the left to configure its settings</p>
              <p className="text-slate-500 text-xs mt-1">Edit templates, SLA targets, and approval requirements</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
