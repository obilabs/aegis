'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClockIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Workflow {
  id: string
  name: string
  description: string
  workflow_type: 'sequential' | 'parallel' | 'any_one'
  escalation_enabled: boolean
  escalation_after_hours: number
  escalation_to: string | null
  escalation_to_name: string | null
  is_active: boolean
  step_count: number
  created_at: string
}

interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  name: string
  approver_type: 'user' | 'role' | 'manager' | 'department_head' | 'group_owner'
  approver_id: string | null
  approver_name: string | null
  approval_mode: 'any' | 'all' | 'majority'
  required_approvals: number
  can_skip: boolean
  skip_if_same_approver: boolean
  timeout_hours: number
  timeout_action: 'escalate' | 'auto_approve' | 'auto_reject'
}

interface User {
  id: string
  name: string
  email: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOW_TYPES: { value: Workflow['workflow_type']; label: string; description: string }[] = [
  { value: 'sequential', label: 'Sequential', description: 'Steps must be approved in order' },
  { value: 'parallel', label: 'Parallel', description: 'All steps evaluated simultaneously' },
  { value: 'any_one', label: 'Any One', description: 'Only one step needs approval' },
]

const APPROVER_TYPES: { value: WorkflowStep['approver_type']; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'role', label: 'Role' },
  { value: 'manager', label: 'Manager' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'group_owner', label: 'Group Owner' },
]

const APPROVAL_MODES: { value: WorkflowStep['approval_mode']; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'all', label: 'All' },
  { value: 'majority', label: 'Majority' },
]

const TIMEOUT_ACTIONS: { value: WorkflowStep['timeout_action']; label: string }[] = [
  { value: 'escalate', label: 'Escalate' },
  { value: 'auto_approve', label: 'Auto-Approve' },
  { value: 'auto_reject', label: 'Auto-Reject' },
]

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function getTypeBadge(type: Workflow['workflow_type']) {
  switch (type) {
    case 'sequential':
      return 'bg-blue-500/20 text-blue-400'
    case 'parallel':
      return 'bg-purple-500/20 text-purple-400'
    case 'any_one':
      return 'bg-amber-500/20 text-amber-400'
  }
}

function getTypeLabel(type: Workflow['workflow_type']) {
  switch (type) {
    case 'sequential':
      return 'Sequential'
    case 'parallel':
      return 'Parallel'
    case 'any_one':
      return 'Any One'
  }
}

function getApproverTypeBadge(type: WorkflowStep['approver_type']) {
  switch (type) {
    case 'user':
      return 'bg-brand-500/20 text-brand-400'
    case 'role':
      return 'bg-blue-500/20 text-blue-400'
    case 'manager':
      return 'bg-orange-500/20 text-orange-400'
    case 'department_head':
      return 'bg-purple-500/20 text-purple-400'
    case 'group_owner':
      return 'bg-cyan-500/20 text-cyan-400'
  }
}

function getApproverTypeLabel(type: WorkflowStep['approver_type']) {
  return APPROVER_TYPES.find((t) => t.value === type)?.label ?? type
}

function getTimeoutActionLabel(action: WorkflowStep['timeout_action']) {
  return TIMEOUT_ACTIONS.find((t) => t.value === action)?.label ?? action
}

// ---------------------------------------------------------------------------
// Default step factory
// ---------------------------------------------------------------------------

function defaultStep(workflowId: string, order: number): Omit<WorkflowStep, 'id'> {
  return {
    workflow_id: workflowId,
    step_order: order,
    name: '',
    approver_type: 'user',
    approver_id: null,
    approver_name: null,
    approval_mode: 'any',
    required_approvals: 1,
    can_skip: false,
    skip_if_same_approver: false,
    timeout_hours: 48,
    timeout_action: 'escalate',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApprovalWorkflowsPage() {
  // List state
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Workflow form
  const [form, setForm] = useState({
    name: '',
    description: '',
    workflow_type: 'sequential' as Workflow['workflow_type'],
    is_active: true,
    escalation_enabled: false,
    escalation_after_hours: 24,
    escalation_to: '' as string,
  })

  // Steps state
  const [steps, setSteps] = useState<WorkflowStep[]>([])

  // Step editing
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [stepForm, setStepForm] = useState<Omit<WorkflowStep, 'id'>>(() => defaultStep('', 1))
  const [savingStep, setSavingStep] = useState(false)

  // Users for dropdowns
  const [users, setUsers] = useState<User[]>([])

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // -------------------------------------------
  // Fetchers
  // -------------------------------------------

  const fetchWorkflows = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/portal/settings/approval-workflows')
      if (!res.ok) throw new Error('Failed to load workflows')
      const data = await res.json()
      setWorkflows(data.workflows || [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/people')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {
      // People endpoint may not be available yet
    }
  }, [])

  const fetchWorkflowDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/portal/settings/approval-workflows/${id}`)
      if (!res.ok) throw new Error('Failed to load workflow')
      const data = await res.json()
      const wf = data.workflow
      setForm({
        name: wf.name,
        description: wf.description || '',
        workflow_type: wf.workflow_type,
        is_active: wf.is_active,
        escalation_enabled: wf.escalation_enabled,
        escalation_after_hours: wf.escalation_after_hours || 24,
        escalation_to: wf.escalation_to || '',
      })
      setSteps(wf.steps || [])
    } catch (err: any) {
      alert(err.message ?? 'Failed to load workflow details')
      setShowModal(false)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
    fetchUsers()
  }, [fetchWorkflows, fetchUsers])

  // -------------------------------------------
  // Workflow CRUD
  // -------------------------------------------

  const handleNew = () => {
    setEditingId(null)
    setForm({
      name: '',
      description: '',
      workflow_type: 'sequential',
      is_active: true,
      escalation_enabled: false,
      escalation_after_hours: 24,
      escalation_to: '',
    })
    setSteps([])
    setEditingStepIndex(null)
    setShowModal(true)
  }

  const handleEdit = (wf: Workflow) => {
    setEditingId(wf.id)
    setEditingStepIndex(null)
    setShowModal(true)
    fetchWorkflowDetail(wf.id)
  }

  const handleSaveWorkflow = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const url = editingId
        ? `/api/portal/settings/approval-workflows/${editingId}`
        : '/api/portal/settings/approval-workflows'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          workflow_type: form.workflow_type,
          is_active: form.is_active,
          escalation_enabled: form.escalation_enabled,
          escalation_after_hours: form.escalation_enabled ? form.escalation_after_hours : null,
          escalation_to: form.escalation_enabled && form.escalation_to ? form.escalation_to : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to save workflow')
        return
      }
      const data = await res.json()
      // If we just created a new workflow, switch to edit mode so steps can be added
      if (!editingId && data.workflow?.id) {
        setEditingId(data.workflow.id)
        setSteps([])
      }
      fetchWorkflows()
    } catch (err) {
      console.error('Error saving workflow:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const res = await fetch(`/api/portal/settings/approval-workflows/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setWorkflows(workflows.filter((w) => w.id !== id))
        setDeletingId(null)
      }
    } catch (err) {
      console.error('Error deleting workflow:', err)
    }
  }

  // -------------------------------------------
  // Step CRUD
  // -------------------------------------------

  const handleAddStep = () => {
    const order = steps.length > 0 ? Math.max(...steps.map((s) => s.step_order)) + 1 : 1
    setStepForm(defaultStep(editingId || '', order))
    setEditingStepIndex(-1) // -1 = new step
  }

  const handleEditStep = (index: number) => {
    const step = steps[index]
    setStepForm({
      workflow_id: step.workflow_id,
      step_order: step.step_order,
      name: step.name,
      approver_type: step.approver_type,
      approver_id: step.approver_id,
      approver_name: step.approver_name,
      approval_mode: step.approval_mode,
      required_approvals: step.required_approvals,
      can_skip: step.can_skip,
      skip_if_same_approver: step.skip_if_same_approver,
      timeout_hours: step.timeout_hours,
      timeout_action: step.timeout_action,
    })
    setEditingStepIndex(index)
  }

  const handleCancelStepEdit = () => {
    setEditingStepIndex(null)
  }

  const handleSaveStep = async () => {
    if (!stepForm.name.trim() || !editingId) return
    setSavingStep(true)
    try {
      const isNew = editingStepIndex === -1
      const stepId = !isNew && editingStepIndex !== null ? steps[editingStepIndex].id : null

      // Resolve approver name if user type
      let approverName = stepForm.approver_name
      if (stepForm.approver_type === 'user' && stepForm.approver_id) {
        const found = users.find((u) => u.id === stepForm.approver_id)
        if (found) approverName = found.name
      }

      const body = {
        ...stepForm,
        approver_name: approverName,
        approver_id: stepForm.approver_type === 'user' ? stepForm.approver_id : null,
      }

      const url = isNew
        ? `/api/portal/settings/approval-workflows/${editingId}/steps`
        : `/api/portal/settings/approval-workflows/${editingId}/steps/${stepId}`

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setEditingStepIndex(null)
        // Reload steps
        await fetchWorkflowDetail(editingId)
        fetchWorkflows()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save step')
      }
    } catch (err) {
      console.error('Error saving step:', err)
    } finally {
      setSavingStep(false)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!editingId) return
    try {
      const res = await fetch(
        `/api/portal/settings/approval-workflows/${editingId}/steps/${stepId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setSteps(steps.filter((s) => s.id !== stepId))
        fetchWorkflows()
      }
    } catch (err) {
      console.error('Error deleting step:', err)
    }
  }

  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    if (!editingId) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= steps.length) return

    const stepA = steps[index]
    const stepB = steps[swapIndex]

    // Swap step_order values
    try {
      await Promise.all([
        fetch(`/api/portal/settings/approval-workflows/${editingId}/steps/${stepA.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step_order: stepB.step_order }),
        }),
        fetch(`/api/portal/settings/approval-workflows/${editingId}/steps/${stepB.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step_order: stepA.step_order }),
        }),
      ])
      await fetchWorkflowDetail(editingId)
    } catch (err) {
      console.error('Error reordering steps:', err)
    }
  }

  // -------------------------------------------
  // Render helpers
  // -------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link
              href="/portal/settings"
              className="hover:text-brand-400 flex items-center gap-1"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Settings
            </Link>
            <span>/</span>
            <span className="text-slate-200">Approval Workflows</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Approval Workflows</h1>
          <p className="text-slate-400 mt-1">
            Configure multi-step approval processes for requests and entitlements
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {workflows.length === 0 && !error && (
        <div className="text-center py-16 bg-slate-900 rounded-xl border border-slate-800">
          <CheckBadgeIcon className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No approval workflows defined yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create workflows to enforce multi-step approvals on requests and entitlements
          </p>
          <button
            onClick={handleNew}
            className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            Create First Workflow
          </button>
        </div>
      )}

      {/* Workflow list */}
      {workflows.length > 0 && (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-4"
            >
              {/* Active indicator */}
              <div className="flex-shrink-0">
                {wf.is_active ? (
                  <span className="block h-2.5 w-2.5 rounded-full bg-brand-400" title="Active" />
                ) : (
                  <span className="block h-2.5 w-2.5 rounded-full bg-slate-600" title="Inactive" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">{wf.name}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeBadge(wf.workflow_type)}`}
                  >
                    {getTypeLabel(wf.workflow_type)}
                  </span>
                </div>
                {wf.description && (
                  <p className="text-sm text-slate-400 mt-0.5 truncate">{wf.description}</p>
                )}
              </div>

              {/* Step count */}
              <span className="text-sm text-slate-500 flex-shrink-0">
                {wf.step_count} {wf.step_count === 1 ? 'step' : 'steps'}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(wf)}
                  className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingId(wf.id)}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* Delete confirmation dialog                                      */}
      {/* ============================================================== */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/20">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Delete Workflow</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to delete this approval workflow? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWorkflow(deletingId)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Workflow detail / edit modal                                     */}
      {/* ============================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto pt-8 pb-8">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            {/* Modal header */}
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingId ? 'Edit Workflow' : 'New Workflow'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
              </div>
            ) : (
              <>
                {/* Workflow settings */}
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g., Manager + VP Approval"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe when this workflow should be used"
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Workflow Type
                      </label>
                      <select
                        value={form.workflow_type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            workflow_type: e.target.value as Workflow['workflow_type'],
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                      >
                        {WORKFLOW_TYPES.map((wt) => (
                          <option key={wt.value} value={wt.value}>
                            {wt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        {WORKFLOW_TYPES.find((t) => t.value === form.workflow_type)?.description}
                      </p>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                          className="rounded border-slate-600"
                        />
                        Active
                      </label>
                    </div>
                  </div>

                  {/* Escalation section */}
                  <div className="border border-slate-800 rounded-lg p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.escalation_enabled}
                        onChange={(e) =>
                          setForm({ ...form, escalation_enabled: e.target.checked })
                        }
                        className="rounded border-slate-600"
                      />
                      Enable Escalation
                    </label>

                    {form.escalation_enabled && (
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Escalation After (hours)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={form.escalation_after_hours}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                escalation_after_hours: parseInt(e.target.value) || 24,
                              })
                            }
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Escalate To</label>
                          <select
                            value={form.escalation_to}
                            onChange={(e) =>
                              setForm({ ...form, escalation_to: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          >
                            <option value="">Select user...</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save workflow button */}
                <div className="px-6 pb-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveWorkflow}
                    disabled={!form.name.trim() || saving}
                    className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                  >
                    {saving
                      ? 'Saving...'
                      : editingId
                        ? 'Update Workflow'
                        : 'Create Workflow'}
                  </button>
                </div>

                {/* Steps section -- only shown when editing an existing workflow */}
                {editingId && (
                  <div className="border-t border-slate-700">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                          Approval Steps
                        </h4>
                        <span className="text-xs text-slate-500">
                          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                        </span>
                      </div>

                      {/* Steps list */}
                      {steps.length === 0 && editingStepIndex === null && (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No steps yet. Add steps to define who needs to approve.
                        </p>
                      )}

                      <div className="space-y-2">
                        {steps.map((step, index) => (
                          <div key={step.id}>
                            {editingStepIndex === index ? (
                              /* Inline edit form for existing step */
                              <StepForm
                                stepForm={stepForm}
                                setStepForm={setStepForm}
                                users={users}
                                saving={savingStep}
                                onSave={handleSaveStep}
                                onCancel={handleCancelStepEdit}
                              />
                            ) : (
                              /* Step display row */
                              <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3 group">
                                {/* Step number */}
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-700 text-xs font-medium text-slate-300 flex-shrink-0">
                                  {index + 1}
                                </span>

                                {/* Step info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-200">
                                      {step.name}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getApproverTypeBadge(step.approver_type)}`}
                                    >
                                      {getApproverTypeLabel(step.approver_type)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                    {step.approver_type === 'user' && step.approver_name && (
                                      <span>{step.approver_name}</span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <ClockIcon className="h-3 w-3" />
                                      {step.timeout_hours}h &rarr;{' '}
                                      {getTimeoutActionLabel(step.timeout_action).toLowerCase()}
                                    </span>
                                    <span>
                                      Mode: {step.approval_mode}
                                    </span>
                                    {step.can_skip && (
                                      <span className="text-amber-400">skippable</span>
                                    )}
                                  </div>
                                </div>

                                {/* Step actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={() => handleMoveStep(index, 'up')}
                                    disabled={index === 0}
                                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                                    title="Move up"
                                  >
                                    <ChevronUpIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveStep(index, 'down')}
                                    disabled={index === steps.length - 1}
                                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                                    title="Move down"
                                  >
                                    <ChevronDownIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleEditStep(index)}
                                    className="p-1.5 text-slate-400 hover:text-brand-400 transition-colors"
                                    title="Edit step"
                                  >
                                    <PencilIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStep(step.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                    title="Delete step"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* New step inline form */}
                        {editingStepIndex === -1 && (
                          <StepForm
                            stepForm={stepForm}
                            setStepForm={setStepForm}
                            users={users}
                            saving={savingStep}
                            onSave={handleSaveStep}
                            onCancel={handleCancelStepEdit}
                          />
                        )}
                      </div>

                      {/* Add step button */}
                      {editingStepIndex === null && (
                        <button
                          onClick={handleAddStep}
                          className="mt-3 flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Step
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step inline form component
// ---------------------------------------------------------------------------

function StepForm({
  stepForm,
  setStepForm,
  users,
  saving,
  onSave,
  onCancel,
}: {
  stepForm: Omit<WorkflowStep, 'id'>
  setStepForm: (fn: Omit<WorkflowStep, 'id'> | ((prev: Omit<WorkflowStep, 'id'>) => Omit<WorkflowStep, 'id'>)) => void
  users: User[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="bg-slate-800 border border-brand-500/30 rounded-lg p-4 space-y-3">
      {/* Row 1: Name + Approver Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Step Name</label>
          <input
            type="text"
            value={stepForm.name}
            onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
            placeholder="e.g., Manager Approval"
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Approver Type</label>
          <select
            value={stepForm.approver_type}
            onChange={(e) =>
              setStepForm({
                ...stepForm,
                approver_type: e.target.value as WorkflowStep['approver_type'],
                approver_id: null,
                approver_name: null,
              })
            }
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {APPROVER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Approver user selector - only when type is user */}
      {stepForm.approver_type === 'user' && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Approver</label>
          <select
            value={stepForm.approver_id || ''}
            onChange={(e) => {
              const user = users.find((u) => u.id === e.target.value)
              setStepForm({
                ...stepForm,
                approver_id: e.target.value || null,
                approver_name: user?.name || null,
              })
            }}
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="">Select user...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Row 2: Approval Mode + Required Approvals */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Approval Mode</label>
          <select
            value={stepForm.approval_mode}
            onChange={(e) =>
              setStepForm({
                ...stepForm,
                approval_mode: e.target.value as WorkflowStep['approval_mode'],
              })
            }
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {APPROVAL_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Required Approvals</label>
          <input
            type="number"
            min={1}
            value={stepForm.required_approvals}
            onChange={(e) =>
              setStepForm({
                ...stepForm,
                required_approvals: parseInt(e.target.value) || 1,
              })
            }
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Timeout (hours)</label>
          <input
            type="number"
            min={1}
            value={stepForm.timeout_hours}
            onChange={(e) =>
              setStepForm({
                ...stepForm,
                timeout_hours: parseInt(e.target.value) || 48,
              })
            }
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
      </div>

      {/* Row 3: Timeout Action + Checkboxes */}
      <div className="flex items-end gap-4">
        <div className="w-40">
          <label className="block text-xs text-slate-400 mb-1">Timeout Action</label>
          <select
            value={stepForm.timeout_action}
            onChange={(e) =>
              setStepForm({
                ...stepForm,
                timeout_action: e.target.value as WorkflowStep['timeout_action'],
              })
            }
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {TIMEOUT_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={stepForm.can_skip}
            onChange={(e) => setStepForm({ ...stepForm, can_skip: e.target.checked })}
            className="rounded border-slate-600"
          />
          Can Skip
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={stepForm.skip_if_same_approver}
            onChange={(e) =>
              setStepForm({ ...stepForm, skip_if_same_approver: e.target.checked })
            }
            className="rounded border-slate-600"
          />
          Skip If Same Approver
        </label>
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!stepForm.name.trim() || saving}
          className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Step'}
        </button>
      </div>
    </div>
  )
}
