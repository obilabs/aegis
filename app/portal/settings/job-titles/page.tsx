'use client'

import { useState, useEffect } from 'react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BriefcaseIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

interface JobTitle {
  id: string
  name: string
  department: string | null
  description: string | null
  is_active: boolean
  entitlement_count: number
  created_by_name: string | null
  created_at: string
}

interface Entitlement {
  id: string
  entitlement_type: string
  resource_id: string | null
  resource_name: string
  requires_approval: boolean
  service_category: string | null
  default_assignee_type: string
  task_title: string | null
  task_description: string | null
  is_required: boolean
  sort_order: number
}

const ENTITLEMENT_TYPES = [
  { value: 'saas_service', label: 'SaaS / Cloud Service' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'access', label: 'Access / Permission' },
  { value: 'software', label: 'Software License' },
  { value: 'accessory', label: 'Accessory' },
]

const ASSIGNEE_TYPES = [
  { value: 'it_admin', label: 'IT Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'buddy', label: 'Buddy / Mentor' },
  { value: 'app_owner', label: 'App Owner' },
  { value: 'hardware_approver', label: 'Hardware Approver' },
  { value: 'hr', label: 'HR' },
]

export default function JobTitlesPage() {
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loadingEntitlements, setLoadingEntitlements] = useState(false)

  // New/edit job title
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleForm, setTitleForm] = useState({ name: '', department: '', description: '' })
  const [savingTitle, setSavingTitle] = useState(false)

  // New/edit entitlement
  const [showEntitlementModal, setShowEntitlementModal] = useState(false)
  const [editingEntitlementId, setEditingEntitlementId] = useState<string | null>(null)
  const [entitlementForm, setEntitlementForm] = useState({
    entitlement_type: 'saas_service',
    resource_name: '',
    service_category: '',
    default_assignee_type: 'it_admin',
    task_title: '',
    task_description: '',
    is_required: true,
    requires_approval: false,
  })
  const [savingEntitlement, setSavingEntitlement] = useState(false)

  useEffect(() => {
    fetchJobTitles()
  }, [])

  const fetchJobTitles = async () => {
    try {
      const res = await fetch('/api/portal/settings/job-titles')
      if (res.ok) {
        const data = await res.json()
        setJobTitles(data.jobTitles || [])
      }
    } catch (error) {
      console.error('Error fetching job titles:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEntitlements = async (jobTitleId: string) => {
    setLoadingEntitlements(true)
    try {
      const res = await fetch(`/api/portal/settings/job-titles/${jobTitleId}/entitlements`)
      if (res.ok) {
        const data = await res.json()
        setEntitlements(data.entitlements || [])
      }
    } catch (error) {
      console.error('Error fetching entitlements:', error)
    } finally {
      setLoadingEntitlements(false)
    }
  }

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setEntitlements([])
    } else {
      setExpandedId(id)
      fetchEntitlements(id)
    }
  }

  // Job Title CRUD
  const handleNewTitle = () => {
    setTitleForm({ name: '', department: '', description: '' })
    setEditingTitleId(null)
    setShowTitleModal(true)
  }

  const handleEditTitle = (jt: JobTitle) => {
    setTitleForm({ name: jt.name, department: jt.department || '', description: jt.description || '' })
    setEditingTitleId(jt.id)
    setShowTitleModal(true)
  }

  const handleSaveTitle = async () => {
    if (!titleForm.name.trim()) return
    setSavingTitle(true)
    try {
      const url = editingTitleId
        ? `/api/portal/settings/job-titles/${editingTitleId}`
        : '/api/portal/settings/job-titles'
      const res = await fetch(url, {
        method: editingTitleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(titleForm),
      })
      if (res.ok) {
        setShowTitleModal(false)
        fetchJobTitles()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving job title:', error)
    } finally {
      setSavingTitle(false)
    }
  }

  const handleDeleteTitle = async (id: string) => {
    if (!confirm('Delete this job title and all its entitlements?')) return
    try {
      const res = await fetch(`/api/portal/settings/job-titles/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setJobTitles(jobTitles.filter(jt => jt.id !== id))
        if (expandedId === id) {
          setExpandedId(null)
          setEntitlements([])
        }
      }
    } catch (error) {
      console.error('Error deleting job title:', error)
    }
  }

  // Entitlement CRUD
  const handleNewEntitlement = () => {
    setEntitlementForm({
      entitlement_type: 'saas_service',
      resource_name: '',
      service_category: '',
      default_assignee_type: 'it_admin',
      task_title: '',
      task_description: '',
      is_required: true,
      requires_approval: false,
    })
    setEditingEntitlementId(null)
    setShowEntitlementModal(true)
  }

  const handleEditEntitlement = (ent: Entitlement) => {
    setEntitlementForm({
      entitlement_type: ent.entitlement_type,
      resource_name: ent.resource_name,
      service_category: ent.service_category || '',
      default_assignee_type: ent.default_assignee_type,
      task_title: ent.task_title || '',
      task_description: ent.task_description || '',
      is_required: ent.is_required,
      requires_approval: ent.requires_approval,
    })
    setEditingEntitlementId(ent.id)
    setShowEntitlementModal(true)
  }

  const handleSaveEntitlement = async () => {
    if (!entitlementForm.resource_name.trim() || !expandedId) return
    setSavingEntitlement(true)
    try {
      const url = editingEntitlementId
        ? `/api/portal/settings/job-titles/${expandedId}/entitlements/${editingEntitlementId}`
        : `/api/portal/settings/job-titles/${expandedId}/entitlements`
      const res = await fetch(url, {
        method: editingEntitlementId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entitlementForm),
      })
      if (res.ok) {
        setShowEntitlementModal(false)
        fetchEntitlements(expandedId)
        fetchJobTitles() // Refresh counts
      }
    } catch (error) {
      console.error('Error saving entitlement:', error)
    } finally {
      setSavingEntitlement(false)
    }
  }

  const handleDeleteEntitlement = async (entId: string) => {
    if (!expandedId) return
    try {
      const res = await fetch(`/api/portal/settings/job-titles/${expandedId}/entitlements/${entId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEntitlements(entitlements.filter(e => e.id !== entId))
        fetchJobTitles() // Refresh counts
      }
    } catch (error) {
      console.error('Error deleting entitlement:', error)
    }
  }

  const getTypeLabel = (type: string) => ENTITLEMENT_TYPES.find(t => t.value === type)?.label || type
  const getAssigneeLabel = (type: string) => ASSIGNEE_TYPES.find(t => t.value === type)?.label || type
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'saas_service': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'hardware': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'access': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'software': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      case 'accessory': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  // Group job titles by department
  const departments = new Map<string, JobTitle[]>()
  for (const jt of jobTitles) {
    const dept = jt.department || 'No Department'
    if (!departments.has(dept)) departments.set(dept, [])
    departments.get(dept)!.push(jt)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Job Titles</h1>
          <p className="text-slate-400 mt-1">
            Define what resources each role gets on onboarding. Used by the Operations Board.
          </p>
        </div>
        <button
          onClick={handleNewTitle}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Job Title
        </button>
      </div>

      {jobTitles.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
          <BriefcaseIcon className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No job titles defined yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create job titles to define what each role gets during onboarding
          </p>
          <button
            onClick={handleNewTitle}
            className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500"
          >
            Create First Job Title
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(departments.entries()).map(([dept, titles]) => (
            <div key={dept}>
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">{dept}</h2>
              <div className="space-y-2">
                {titles.map((jt) => (
                  <div key={jt.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                    {/* Job title row */}
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                      onClick={() => handleExpand(jt.id)}
                    >
                      {expandedId === jt.id ? (
                        <ChevronDownIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      )}
                      <BriefcaseIcon className="h-5 w-5 text-brand-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{jt.name}</span>
                          {!jt.is_active && (
                            <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">Inactive</span>
                          )}
                        </div>
                        {jt.description && (
                          <p className="text-sm text-slate-400 truncate">{jt.description}</p>
                        )}
                      </div>
                      <span className="text-sm text-slate-500">{jt.entitlement_count} entitlements</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditTitle(jt)}
                          className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTitle(jt.id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded entitlements */}
                    {expandedId === jt.id && (
                      <div className="border-t border-slate-700 bg-slate-900/50">
                        {loadingEntitlements ? (
                          <div className="p-4 text-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent mx-auto" />
                          </div>
                        ) : (
                          <>
                            {entitlements.length === 0 ? (
                              <p className="p-4 text-sm text-slate-500 text-center">
                                No entitlements yet. Add what this role gets on onboarding.
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-700/50">
                                {entitlements.map((ent) => (
                                  <div key={ent.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-slate-800/50">
                                    <div className="pl-8 flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getTypeColor(ent.entitlement_type)}`}>
                                          {getTypeLabel(ent.entitlement_type)}
                                        </span>
                                        <span className="text-sm text-slate-200">{ent.resource_name}</span>
                                        {ent.is_required && (
                                          <span className="px-1 py-0.5 text-[9px] font-medium bg-red-500/20 text-red-400 rounded">REQ</span>
                                        )}
                                        {ent.requires_approval && (
                                          <span className="px-1 py-0.5 text-[9px] font-medium bg-amber-500/20 text-amber-400 rounded">APPROVAL</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                        {ent.service_category && <span>{ent.service_category}</span>}
                                        <span>Assigned to: {getAssigneeLabel(ent.default_assignee_type)}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button
                                        onClick={() => handleEditEntitlement(ent)}
                                        className="p-1.5 text-slate-400 hover:text-brand-400 transition-colors"
                                      >
                                        <PencilIcon className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEntitlement(ent.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                      >
                                        <TrashIcon className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="p-3 border-t border-slate-700/50">
                              <button
                                onClick={handleNewEntitlement}
                                className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300"
                              >
                                <PlusIcon className="h-4 w-4" />
                                Add Entitlement
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Title Modal */}
      {showTitleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingTitleId ? 'Edit Job Title' : 'New Job Title'}
              </h3>
              <button onClick={() => setShowTitleModal(false)} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title Name</label>
                <input
                  type="text"
                  value={titleForm.name}
                  onChange={(e) => setTitleForm({ ...titleForm, name: e.target.value })}
                  placeholder="e.g., Software Engineer"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
                <input
                  type="text"
                  value={titleForm.department}
                  onChange={(e) => setTitleForm({ ...titleForm, department: e.target.value })}
                  placeholder="e.g., Engineering"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={titleForm.description}
                  onChange={(e) => setTitleForm({ ...titleForm, description: e.target.value })}
                  placeholder="Brief description of this role"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowTitleModal(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTitle}
                disabled={!titleForm.name.trim() || savingTitle}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {savingTitle ? 'Saving...' : editingTitleId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entitlement Modal */}
      {showEntitlementModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto pt-8 pb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingEntitlementId ? 'Edit Entitlement' : 'Add Entitlement'}
              </h3>
              <button onClick={() => setShowEntitlementModal(false)} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                  <select
                    value={entitlementForm.entitlement_type}
                    onChange={(e) => setEntitlementForm({ ...entitlementForm, entitlement_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    {ENTITLEMENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Assigned To</label>
                  <select
                    value={entitlementForm.default_assignee_type}
                    onChange={(e) => setEntitlementForm({ ...entitlementForm, default_assignee_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    {ASSIGNEE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Resource Name</label>
                <input
                  type="text"
                  value={entitlementForm.resource_name}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, resource_name: e.target.value })}
                  placeholder="e.g., Google Workspace, MacBook Pro 14"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Service Category
                  <span className="text-slate-500 font-normal ml-1">(groups tasks in Operations Board columns)</span>
                </label>
                <input
                  type="text"
                  value={entitlementForm.service_category}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, service_category: e.target.value })}
                  placeholder="e.g., google_workspace, laptop_assignment"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Task Title Override
                  <span className="text-slate-500 font-normal ml-1">(defaults to resource name)</span>
                </label>
                <input
                  type="text"
                  value={entitlementForm.task_title}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, task_title: e.target.value })}
                  placeholder="e.g., Provision Google Workspace account"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entitlementForm.is_required}
                    onChange={(e) => setEntitlementForm({ ...entitlementForm, is_required: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  Required for onboarding
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entitlementForm.requires_approval}
                    onChange={(e) => setEntitlementForm({ ...entitlementForm, requires_approval: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  Requires approval
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowEntitlementModal(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEntitlement}
                disabled={!entitlementForm.resource_name.trim() || savingEntitlement}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {savingEntitlement ? 'Saving...' : editingEntitlementId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
