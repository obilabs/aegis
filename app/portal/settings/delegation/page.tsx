'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DelegationRule {
  id: string
  name: string
  description: string
  delegator_type: string
  delegator_id: string | null
  delegator_name: string | null
  action: string
  target_scope: string
  target_group_id: string | null
  requires_justification: boolean
  max_cost: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

interface DelegationTransfer {
  id: string
  delegator_id: string
  delegator_name: string
  delegator_email: string
  delegate_id: string
  delegate_name: string
  delegate_email: string
  delegation_type: string
  actions: string[] | null
  starts_at: string
  ends_at: string
  notify_on_action: boolean
  reason: string | null
  is_active: boolean
  created_at: string
}

interface PeopleUser {
  id: string
  name: string
  email: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DELEGATOR_TYPES = [
  { value: 'user', label: 'User' },
  { value: 'role', label: 'Role' },
  { value: 'group_owner', label: 'Group Owner' },
  { value: 'manager', label: 'Manager' },
]

const ACTIONS = [
  { value: 'request_for', label: 'Request For' },
  { value: 'approve_for', label: 'Approve For' },
  { value: 'view_assignments', label: 'View Assignments' },
  { value: 'initiate_offboarding', label: 'Initiate Offboarding' },
  { value: 'manage_access', label: 'Manage Access' },
]

const TARGET_SCOPES = [
  { value: 'self', label: 'Self' },
  { value: 'direct_reports', label: 'Direct Reports' },
  { value: 'department', label: 'Department' },
  { value: 'group_members', label: 'Group Members' },
  { value: 'all', label: 'All' },
]

const DELEGATION_TYPES = [
  { value: 'approvals', label: 'Approvals Only' },
  { value: 'all', label: 'Everything' },
  { value: 'specific_actions', label: 'Specific Actions' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getActionBadgeClass(action: string): string {
  switch (action) {
    case 'request_for':
      return 'bg-blue-500/20 text-blue-400'
    case 'approve_for':
      return 'bg-brand-500/20 text-brand-400'
    case 'view_assignments':
      return 'bg-cyan-500/20 text-cyan-400'
    case 'initiate_offboarding':
      return 'bg-orange-500/20 text-orange-400'
    case 'manage_access':
      return 'bg-purple-500/20 text-purple-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

function getDelegationTypeBadgeClass(type: string): string {
  switch (type) {
    case 'approvals':
      return 'bg-brand-500/20 text-brand-400'
    case 'all':
      return 'bg-purple-500/20 text-purple-400'
    case 'specific_actions':
      return 'bg-blue-500/20 text-blue-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

function getTransferStatus(transfer: DelegationTransfer): { label: string; className: string } {
  const now = new Date()
  const starts = new Date(transfer.starts_at)
  const ends = new Date(transfer.ends_at)

  if (!transfer.is_active) {
    return { label: 'Deactivated', className: 'bg-red-500/20 text-red-400' }
  }
  if (ends < now) {
    return { label: 'Expired', className: 'bg-slate-500/20 text-slate-400' }
  }
  if (starts > now) {
    return { label: 'Upcoming', className: 'bg-blue-500/20 text-blue-400' }
  }
  return { label: 'Active', className: 'bg-brand-500/20 text-brand-400' }
}

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

function defaultRuleForm() {
  return {
    name: '',
    description: '',
    delegator_type: 'user',
    delegator_id: '' as string,
    action: 'request_for',
    target_scope: 'direct_reports',
    requires_justification: false,
    max_cost: '' as string,
    is_active: true,
    starts_at: '',
    ends_at: '',
  }
}

function defaultTransferForm() {
  return {
    delegator_id: '',
    delegate_id: '',
    delegation_type: 'approvals',
    actions: [] as string[],
    starts_at: '',
    ends_at: '',
    notify_on_action: true,
    reason: '',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DelegationPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'rules' | 'transfers'>('rules')

  // Data state
  const [rules, setRules] = useState<DelegationRule[]>([])
  const [transfers, setTransfers] = useState<DelegationTransfer[]>([])
  const [users, setUsers] = useState<PeopleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Rule modal state
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleForm, setRuleForm] = useState(defaultRuleForm())
  const [savingRule, setSavingRule] = useState(false)

  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)
  const [transferForm, setTransferForm] = useState(defaultTransferForm())
  const [savingTransfer, setSavingTransfer] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'rule' | 'transfer'; id: string } | null>(null)

  // -------------------------------------------
  // Fetchers
  // -------------------------------------------

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/settings/delegation/rules')
      if (!res.ok) throw new Error('Failed to load delegation rules')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load delegation rules')
    }
  }, [])

  const fetchTransfers = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/settings/delegation/transfers')
      if (!res.ok) throw new Error('Failed to load delegation transfers')
      const data = await res.json()
      setTransfers(data.transfers || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load delegation transfers')
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

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      setError(null)
      await Promise.all([fetchRules(), fetchTransfers(), fetchUsers()])
      setLoading(false)
    }
    loadAll()
  }, [fetchRules, fetchTransfers, fetchUsers])

  // -------------------------------------------
  // Rule CRUD
  // -------------------------------------------

  const handleNewRule = () => {
    setEditingRuleId(null)
    setRuleForm(defaultRuleForm())
    setShowRuleModal(true)
  }

  const handleEditRule = (rule: DelegationRule) => {
    setEditingRuleId(rule.id)
    setRuleForm({
      name: rule.name,
      description: rule.description || '',
      delegator_type: rule.delegator_type,
      delegator_id: rule.delegator_id || '',
      action: rule.action,
      target_scope: rule.target_scope,
      requires_justification: rule.requires_justification,
      max_cost: rule.max_cost !== null ? String(rule.max_cost) : '',
      is_active: rule.is_active,
      starts_at: rule.starts_at ? rule.starts_at.slice(0, 10) : '',
      ends_at: rule.ends_at ? rule.ends_at.slice(0, 10) : '',
    })
    setShowRuleModal(true)
  }

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) return
    setSavingRule(true)
    try {
      const url = editingRuleId
        ? `/api/portal/settings/delegation/rules/${editingRuleId}`
        : '/api/portal/settings/delegation/rules'
      const res = await fetch(url, {
        method: editingRuleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleForm.name,
          description: ruleForm.description,
          delegator_type: ruleForm.delegator_type,
          delegator_id: ruleForm.delegator_type === 'user' && ruleForm.delegator_id ? ruleForm.delegator_id : null,
          action: ruleForm.action,
          target_scope: ruleForm.target_scope,
          requires_justification: ruleForm.requires_justification,
          max_cost: ruleForm.max_cost ? parseFloat(ruleForm.max_cost) : null,
          is_active: ruleForm.is_active,
          starts_at: ruleForm.starts_at || null,
          ends_at: ruleForm.ends_at || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to save rule')
        return
      }
      setShowRuleModal(false)
      await fetchRules()
    } catch (err) {
      console.error('Error saving rule:', err)
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/portal/settings/delegation/rules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRules(rules.filter((r) => r.id !== id))
        setDeleteTarget(null)
      }
    } catch (err) {
      console.error('Error deleting rule:', err)
    }
  }

  // -------------------------------------------
  // Transfer CRUD
  // -------------------------------------------

  const handleNewTransfer = () => {
    setEditingTransferId(null)
    setTransferForm(defaultTransferForm())
    setShowTransferModal(true)
  }

  const handleEditTransfer = (transfer: DelegationTransfer) => {
    setEditingTransferId(transfer.id)
    setTransferForm({
      delegator_id: transfer.delegator_id,
      delegate_id: transfer.delegate_id,
      delegation_type: transfer.delegation_type,
      actions: transfer.actions || [],
      starts_at: transfer.starts_at ? transfer.starts_at.slice(0, 10) : '',
      ends_at: transfer.ends_at ? transfer.ends_at.slice(0, 10) : '',
      notify_on_action: transfer.notify_on_action,
      reason: transfer.reason || '',
    })
    setShowTransferModal(true)
  }

  const handleSaveTransfer = async () => {
    if (!transferForm.delegator_id || !transferForm.delegate_id || !transferForm.starts_at || !transferForm.ends_at) return
    if (transferForm.delegator_id === transferForm.delegate_id) {
      alert('Delegator and delegate must be different people.')
      return
    }
    if (new Date(transferForm.ends_at) <= new Date(transferForm.starts_at)) {
      alert('End date must be after start date.')
      return
    }
    setSavingTransfer(true)
    try {
      const url = editingTransferId
        ? `/api/portal/settings/delegation/transfers/${editingTransferId}`
        : '/api/portal/settings/delegation/transfers'
      const res = await fetch(url, {
        method: editingTransferId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegator_id: transferForm.delegator_id,
          delegate_id: transferForm.delegate_id,
          delegation_type: transferForm.delegation_type,
          actions: transferForm.delegation_type === 'specific_actions' ? transferForm.actions : null,
          starts_at: transferForm.starts_at,
          ends_at: transferForm.ends_at,
          notify_on_action: transferForm.notify_on_action,
          reason: transferForm.reason || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to save transfer')
        return
      }
      setShowTransferModal(false)
      await fetchTransfers()
    } catch (err) {
      console.error('Error saving transfer:', err)
    } finally {
      setSavingTransfer(false)
    }
  }

  const handleDeleteTransfer = async (id: string) => {
    try {
      const res = await fetch(`/api/portal/settings/delegation/transfers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTransfers(transfers.filter((t) => t.id !== id))
        setDeleteTarget(null)
      }
    } catch (err) {
      console.error('Error deleting transfer:', err)
    }
  }

  const handleDeactivateTransfer = async (transfer: DelegationTransfer) => {
    try {
      const res = await fetch(`/api/portal/settings/delegation/transfers/${transfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })
      if (res.ok) {
        await fetchTransfers()
      }
    } catch (err) {
      console.error('Error deactivating transfer:', err)
    }
  }

  // -------------------------------------------
  // Transfer action toggle helper
  // -------------------------------------------

  const toggleTransferAction = (action: string) => {
    setTransferForm((prev) => {
      const current = prev.actions
      if (current.includes(action)) {
        return { ...prev, actions: current.filter((a) => a !== action) }
      }
      return { ...prev, actions: [...current, action] }
    })
  }

  // -------------------------------------------
  // Render
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
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Link
            href="/portal/settings"
            className="hover:text-brand-400 flex items-center gap-1"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Settings
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Delegation</h1>
        <p className="text-slate-400 mt-1">
          Manage delegation rules and out-of-office transfers
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          {([
            { key: 'rules' as const, label: 'Rules' },
            { key: 'transfers' as const, label: 'Transfers' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.key
                  ? 'bg-slate-800 text-brand-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={activeTab === 'rules' ? handleNewRule : handleNewTransfer}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {activeTab === 'rules' ? 'New Rule' : 'New Transfer'}
        </button>
      </div>

      {/* ================================================================== */}
      {/* Rules Tab                                                          */}
      {/* ================================================================== */}
      {activeTab === 'rules' && (
        <>
          {rules.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 rounded-xl border border-slate-800">
              <p className="text-slate-400">No delegation rules configured</p>
              <p className="text-sm text-slate-500 mt-1">
                Create rules to define who can perform actions on behalf of others
              </p>
              <button
                onClick={handleNewRule}
                className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                Create Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-4"
                >
                  {/* Active indicator */}
                  <div className="flex-shrink-0">
                    {rule.is_active ? (
                      <span className="block h-2.5 w-2.5 rounded-full bg-brand-400" title="Active" />
                    ) : (
                      <span className="block h-2.5 w-2.5 rounded-full bg-slate-600" title="Inactive" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-100">{rule.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getActionBadgeClass(rule.action)}`}>
                        {formatLabel(rule.action)}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-700/50 text-slate-400">
                        {formatLabel(rule.target_scope)}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">{rule.description}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      Delegator: {formatLabel(rule.delegator_type)}
                      {rule.delegator_name ? `: ${rule.delegator_name}` : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEditRule(rule)}
                      className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: 'rule', id: rule.id })}
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
        </>
      )}

      {/* ================================================================== */}
      {/* Transfers Tab                                                      */}
      {/* ================================================================== */}
      {activeTab === 'transfers' && (
        <>
          {transfers.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 rounded-xl border border-slate-800">
              <p className="text-slate-400">No delegation transfers</p>
              <p className="text-sm text-slate-500 mt-1">
                Create transfers for out-of-office handoffs between team members
              </p>
              <button
                onClick={handleNewTransfer}
                className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                New Transfer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer) => {
                const status = getTransferStatus(transfer)
                return (
                  <div
                    key={transfer.id}
                    className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-4"
                  >
                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100">{transfer.delegator_name}</span>
                        <ArrowRightIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-100">{transfer.delegate_name}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDelegationTypeBadgeClass(transfer.delegation_type)}`}>
                          {formatLabel(transfer.delegation_type)}
                        </span>
                        {transfer.notify_on_action && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-700/50 text-slate-400">
                            Notify
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{formatDate(transfer.starts_at)} - {formatDate(transfer.ends_at)}</span>
                        {transfer.reason && (
                          <span className="truncate max-w-xs">{transfer.reason}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {transfer.is_active && new Date(transfer.ends_at) >= new Date() && (
                        <button
                          onClick={() => handleDeactivateTransfer(transfer)}
                          className="px-2 py-1 text-xs text-slate-400 hover:text-orange-400 transition-colors"
                          title="Deactivate"
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleEditTransfer(transfer)}
                        className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'transfer', id: transfer.id })}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* Delete Confirmation Dialog                                         */}
      {/* ================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              Delete {deleteTarget.type === 'rule' ? 'Rule' : 'Transfer'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to delete this delegation {deleteTarget.type}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteTarget.type === 'rule') {
                    handleDeleteRule(deleteTarget.id)
                  } else {
                    handleDeleteTransfer(deleteTarget.id)
                  }
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Rule Create/Edit Modal                                             */}
      {/* ================================================================== */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto pt-8 pb-8">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            {/* Modal header */}
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingRuleId ? 'Edit Rule' : 'New Rule'}
              </h3>
              <button
                onClick={() => setShowRuleModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g., Managers can request SaaS for reports"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Describe what this rule allows"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                />
              </div>

              {/* Delegator Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Delegator Type</label>
                <select
                  value={ruleForm.delegator_type}
                  onChange={(e) => setRuleForm({ ...ruleForm, delegator_type: e.target.value, delegator_id: '' })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {DELEGATOR_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>

              {/* User dropdown if delegator_type === 'user' */}
              {ruleForm.delegator_type === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Delegator User</label>
                  <select
                    value={ruleForm.delegator_id}
                    onChange={(e) => setRuleForm({ ...ruleForm, delegator_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="">Select user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Action</label>
                <select
                  value={ruleForm.action}
                  onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>

              {/* Target Scope */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target Scope</label>
                <select
                  value={ruleForm.target_scope}
                  onChange={(e) => setRuleForm({ ...ruleForm, target_scope: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {TARGET_SCOPES.map((ts) => (
                    <option key={ts.value} value={ts.value}>{ts.label}</option>
                  ))}
                </select>
              </div>

              {/* Checkboxes row */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.requires_justification}
                    onChange={(e) => setRuleForm({ ...ruleForm, requires_justification: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  Requires Justification
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleForm.is_active}
                    onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  Active
                </label>
              </div>

              {/* Max Cost */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Max Cost (optional)</label>
                <input
                  type="number"
                  value={ruleForm.max_cost}
                  onChange={(e) => setRuleForm({ ...ruleForm, max_cost: e.target.value })}
                  placeholder="e.g., 5000"
                  min={0}
                  step="0.01"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Starts At (optional)</label>
                  <input
                    type="date"
                    value={ruleForm.starts_at}
                    onChange={(e) => setRuleForm({ ...ruleForm, starts_at: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Ends At (optional)</label>
                  <input
                    type="date"
                    value={ruleForm.ends_at}
                    onChange={(e) => setRuleForm({ ...ruleForm, ends_at: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!ruleForm.name.trim() || savingRule}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {savingRule ? 'Saving...' : editingRuleId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Transfer Create/Edit Modal                                         */}
      {/* ================================================================== */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto pt-8 pb-8">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            {/* Modal header */}
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingTransferId ? 'Edit Transfer' : 'New Transfer'}
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Delegator */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Delegator (who is going out of office) <span className="text-red-400">*</span>
                </label>
                <select
                  value={transferForm.delegator_id}
                  onChange={(e) => setTransferForm({ ...transferForm, delegator_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  <option value="">Select user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              {/* Delegate */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Delegate (who is taking over) <span className="text-red-400">*</span>
                </label>
                <select
                  value={transferForm.delegate_id}
                  onChange={(e) => setTransferForm({ ...transferForm, delegate_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  <option value="">Select user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                {transferForm.delegator_id && transferForm.delegate_id && transferForm.delegator_id === transferForm.delegate_id && (
                  <p className="text-xs text-red-400 mt-1">Delegator and delegate must be different people.</p>
                )}
              </div>

              {/* Delegation Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Delegation Type</label>
                <select
                  value={transferForm.delegation_type}
                  onChange={(e) => setTransferForm({ ...transferForm, delegation_type: e.target.value, actions: [] })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {DELEGATION_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>

              {/* Specific actions checkboxes */}
              {transferForm.delegation_type === 'specific_actions' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Actions to delegate</label>
                  <div className="space-y-2">
                    {ACTIONS.map((a) => (
                      <label key={a.value} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={transferForm.actions.includes(a.value)}
                          onChange={() => toggleTransferAction(a.value)}
                          className="rounded border-slate-600"
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Start Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={transferForm.starts_at}
                    onChange={(e) => setTransferForm({ ...transferForm, starts_at: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    End Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={transferForm.ends_at}
                    onChange={(e) => setTransferForm({ ...transferForm, ends_at: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              </div>
              {transferForm.starts_at && transferForm.ends_at && new Date(transferForm.ends_at) <= new Date(transferForm.starts_at) && (
                <p className="text-xs text-red-400">End date must be after start date.</p>
              )}

              {/* Notify on Action */}
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={transferForm.notify_on_action}
                  onChange={(e) => setTransferForm({ ...transferForm, notify_on_action: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Notify delegator when delegate acts on their behalf
              </label>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Reason (optional)</label>
                <textarea
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="e.g., On vacation"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTransfer}
                disabled={
                  !transferForm.delegator_id ||
                  !transferForm.delegate_id ||
                  !transferForm.starts_at ||
                  !transferForm.ends_at ||
                  transferForm.delegator_id === transferForm.delegate_id ||
                  new Date(transferForm.ends_at) <= new Date(transferForm.starts_at) ||
                  savingTransfer
                }
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {savingTransfer ? 'Saving...' : editingTransferId ? 'Update Transfer' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
