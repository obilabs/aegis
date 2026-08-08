'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Group {
  id: string
  name: string
  description: string | null
  group_type: 'user' | 'asset'
  membership_type: 'static' | 'dynamic' | 'hybrid'
  rule_logic: 'AND' | 'OR'
  member_count: number
  last_evaluated_at: string | null
  created_at: string
  updated_at: string
}

interface GroupDetail extends Group {
  rules: GroupRule[]
}

interface GroupRule {
  id: string
  field_name: string
  operator: string
  value: string
  sort_order: number
}

interface Member {
  id: string
  name: string
  email?: string
  department?: string
  job_title?: string
  asset_tag?: string
  type?: string
  subtype?: string
  status?: string
  membership_source: 'static' | 'dynamic'
}

interface EvaluateResult {
  added: number
  removed: number
  unchanged: number
}

type TypeFilter = 'all' | 'user' | 'asset'
type DetailTab = 'rules' | 'members'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_FIELDS = [
  { value: 'department', label: 'Department' },
  { value: 'department_id_new', label: 'Department ID' },
  { value: 'location_id', label: 'Location' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'job_title_id', label: 'Job Title ID' },
  { value: 'contact_type', label: 'Contact Type' },
  { value: 'email', label: 'Email' },
  { value: 'is_vip', label: 'Is VIP' },
  { value: 'is_technical', label: 'Is Technical' },
  { value: 'reports_to_id', label: 'Reports To' },
]

const ASSET_FIELDS = [
  { value: 'type_id', label: 'Asset Type' },
  { value: 'subtype_id', label: 'Asset Subtype' },
  { value: 'model_id', label: 'Model' },
  { value: 'vendor_id', label: 'Vendor' },
  { value: 'os_id', label: 'Operating System' },
  { value: 'status', label: 'Status' },
  { value: 'location_id', label: 'Location' },
  { value: 'external_source', label: 'External Source' },
  { value: 'is_managed', label: 'Is Managed' },
]

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'in_list', label: 'in list' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'is_under', label: 'is under (hierarchy)' },
]

const VALUE_HIDDEN_OPERATORS = ['is_empty', 'is_not_empty']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function membershipColor(type: string) {
  switch (type) {
    case 'dynamic': return 'bg-brand-500/20 text-brand-400'
    case 'static': return 'bg-blue-500/20 text-blue-400'
    case 'hybrid': return 'bg-amber-500/20 text-amber-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

function typeColor(type: string) {
  switch (type) {
    case 'user': return 'bg-cyan-500/20 text-cyan-400'
    case 'asset': return 'bg-purple-500/20 text-purple-400'
    case 'contact': return 'bg-pink-500/20 text-pink-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

function operatorLabel(op: string) {
  return OPERATORS.find(o => o.value === op)?.label ?? op
}

function fieldLabel(fieldValue: string, groupType: 'user' | 'asset') {
  const fields = groupType === 'user' ? USER_FIELDS : ASSET_FIELDS
  return fields.find(f => f.value === fieldValue)?.label ?? fieldValue
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, matching codebase pattern)
// ---------------------------------------------------------------------------

function UsersGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  )
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  )
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )
}

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
    </svg>
  )
}

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Spinner Component
// ---------------------------------------------------------------------------

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-4 w-4 border' : 'h-8 w-8 border-2'
  return (
    <div className={`animate-spin rounded-full ${cls} border-brand-500 border-t-transparent`} />
  )
}

// ---------------------------------------------------------------------------
// Toast Banner
// ---------------------------------------------------------------------------

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-600/90 backdrop-blur-sm text-white rounded-lg shadow-xl border border-brand-500/50">
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 p-0.5 hover:bg-brand-500 rounded transition-colors">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirm Dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
            <ExclamationIcon className="h-6 w-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading && <Spinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create / Edit Group Modal
// ---------------------------------------------------------------------------

function GroupFormModal({
  group,
  onSave,
  onCancel,
}: {
  group: Partial<Group> | null
  onSave: (data: {
    name: string
    description: string
    group_type: 'user' | 'asset'
    membership_type: 'static' | 'dynamic' | 'hybrid'
    rule_logic: 'AND' | 'OR'
  }) => void
  onCancel: () => void
}) {
  const isEdit = group?.id != null
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [groupType, setGroupType] = useState<'user' | 'asset'>(group?.group_type ?? 'user')
  const [membershipType, setMembershipType] = useState<'static' | 'dynamic' | 'hybrid'>(group?.membership_type ?? 'dynamic')
  const [ruleLogic, setRuleLogic] = useState<'AND' | 'OR'>(group?.rule_logic ?? 'AND')
  const [saving, setSaving] = useState(false)

  const showRuleLogic = membershipType === 'dynamic' || membershipType === 'hybrid'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim(), group_type: groupType, membership_type: membershipType, rule_logic: ruleLogic })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEdit ? 'Edit Group' : 'Create Group'}
          </h2>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering Team, Windows Laptops"
              required
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this group's purpose"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
            />
          </div>

          {/* Group Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Group Type</label>
            <div className="flex gap-2">
              {(['user', 'asset'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGroupType(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    groupType === t
                      ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {t === 'user' ? <UserIcon className="h-4 w-4" /> : <ServerIcon className="h-4 w-4" />}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Membership Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Membership Type</label>
            <div className="flex gap-2">
              {(['dynamic', 'static', 'hybrid'] as const).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMembershipType(mt)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    membershipType === mt
                      ? mt === 'dynamic'
                        ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                        : mt === 'static'
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                          : 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  <span className="capitalize">{mt}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {membershipType === 'dynamic' && 'Members are determined automatically by rules'}
              {membershipType === 'static' && 'Members are added manually'}
              {membershipType === 'hybrid' && 'Rules populate members, but you can also add manually'}
            </p>
          </div>

          {/* Rule Logic */}
          {showRuleLogic && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Rule Logic</label>
              <div className="flex gap-2">
                {(['AND', 'OR'] as const).map((rl) => (
                  <button
                    key={rl}
                    type="button"
                    onClick={() => setRuleLogic(rl)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      ruleLogic === rl
                        ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {rl}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {ruleLogic === 'AND' ? 'All rules must match' : 'Any rule can match'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
            >
              {saving && <Spinner size="sm" />}
              {isEdit ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Rule Inline Form
// ---------------------------------------------------------------------------

function AddRuleForm({
  groupType,
  onAdd,
  onCancel,
}: {
  groupType: 'user' | 'asset'
  onAdd: (rule: { field_name: string; operator: string; value: string }) => void
  onCancel: () => void
}) {
  const fields = groupType === 'user' ? USER_FIELDS : ASSET_FIELDS
  const [fieldName, setFieldName] = useState(fields[0]?.value ?? '')
  const [operator, setOperator] = useState('equals')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const hideValue = VALUE_HIDDEN_OPERATORS.includes(operator)

  const handleSubmit = async () => {
    if (!fieldName || !operator) return
    if (!hideValue && !value.trim()) return
    setSaving(true)
    try {
      await onAdd({ field_name: fieldName, operator, value: hideValue ? '' : value.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Field */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Field</label>
          <select
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {fields.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Operator */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Operator</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Value</label>
          {hideValue ? (
            <div className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-500 italic">
              No value needed
            </div>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value..."
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || (!hideValue && !value.trim())}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
        >
          {saving && <Spinner size="sm" />}
          Add Rule
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group Detail Panel
// ---------------------------------------------------------------------------

function GroupDetailPanel({
  group,
  groupDetail,
  members,
  activeTab,
  onTabChange,
  onAddRule,
  onDeleteRule,
  onEvaluate,
  evaluateResult,
  evaluating,
  loadingDetail,
  loadingMembers,
  onClose,
}: {
  group: Group
  groupDetail: GroupDetail | null
  members: Member[]
  activeTab: DetailTab
  onTabChange: (tab: DetailTab) => void
  onAddRule: (rule: { field_name: string; operator: string; value: string }) => Promise<void>
  onDeleteRule: (ruleId: string) => void
  onEvaluate: () => void
  evaluateResult: EvaluateResult | null
  evaluating: boolean
  loadingDetail: boolean
  loadingMembers: boolean
  onClose: () => void
}) {
  const [showAddRule, setShowAddRule] = useState(false)
  const isDynamic = group.membership_type === 'dynamic' || group.membership_type === 'hybrid'
  const rules = groupDetail?.rules ?? []

  const handleAddRule = async (rule: { field_name: string; operator: string; value: string }) => {
    await onAddRule(rule)
    setShowAddRule(false)
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${group.group_type === 'user' ? 'bg-cyan-500/20' : 'bg-purple-500/20'}`}>
            {group.group_type === 'user'
              ? <UserIcon className="h-4 w-4 text-cyan-400" />
              : <ServerIcon className="h-4 w-4 text-purple-400" />
            }
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{group.name}</h3>
            {group.description && (
              <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {isDynamic && (
          <button
            onClick={() => onTabChange('rules')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rules'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Rules
            {rules.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-300 rounded-full">
                {rules.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => onTabChange('members')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <UsersGroupIcon className="h-4 w-4" />
          Members
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-300 rounded-full">
            {group.member_count}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {loadingDetail ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : activeTab === 'rules' && isDynamic ? (
          <div className="space-y-4">
            {/* Rule Logic Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">Match:</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                  group.rule_logic === 'AND'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {group.rule_logic === 'AND' ? 'ALL rules (AND)' : 'ANY rule (OR)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onEvaluate}
                  disabled={evaluating || rules.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-400 bg-brand-500/10 border border-brand-500/30 rounded-lg hover:bg-brand-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {evaluating ? <Spinner size="sm" /> : <PlayIcon className="h-3.5 w-3.5" />}
                  Evaluate Now
                </button>
              </div>
            </div>

            {/* Evaluate Result Banner */}
            {evaluateResult && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-500/10 border border-brand-500/30 rounded-lg">
                <svg className="h-4 w-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="text-sm text-brand-300">
                  Evaluated: <span className="font-semibold">{evaluateResult.added} added</span>,{' '}
                  <span className="font-semibold">{evaluateResult.removed} removed</span>,{' '}
                  <span className="font-semibold">{evaluateResult.unchanged} unchanged</span>
                </span>
              </div>
            )}

            {/* Rules List */}
            {rules.length === 0 ? (
              <div className="text-center py-8">
                <FunnelIcon className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No rules defined yet</p>
                <p className="text-xs text-slate-500 mt-1">Add rules to automatically populate group members</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg group"
                  >
                    {/* Rule number */}
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[10px] font-bold text-slate-500 bg-slate-800 rounded-full">
                      {idx + 1}
                    </span>

                    {/* Rule description pills */}
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-300 rounded">
                        {fieldLabel(rule.field_name, group.group_type)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {operatorLabel(rule.operator)}
                      </span>
                      {!VALUE_HIDDEN_OPERATORS.includes(rule.operator) && (
                        <span className="px-2 py-1 text-xs font-medium bg-brand-500/10 text-brand-400 rounded">
                          {rule.value}
                        </span>
                      )}
                    </div>

                    {/* Logic connector (shown between rules) */}
                    {idx < rules.length - 1 && (
                      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        group.rule_logic === 'AND'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {group.rule_logic}
                      </span>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="flex-shrink-0 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete rule"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Rule */}
            {showAddRule ? (
              <AddRuleForm
                groupType={group.group_type}
                onAdd={handleAddRule}
                onCancel={() => setShowAddRule(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddRule(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-400 border border-dashed border-slate-700 rounded-lg hover:border-brand-500/50 hover:text-brand-400 transition-colors w-full justify-center"
              >
                <PlusIcon className="h-4 w-4" />
                Add Rule
              </button>
            )}
          </div>
        ) : (
          /* Members Tab */
          <div>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <UsersGroupIcon className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No members yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  {isDynamic
                    ? 'Add rules and evaluate to populate members'
                    : 'Add members manually to this group'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {group.group_type === 'user' ? (
                        <>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Department</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Job Title</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Source</th>
                        </>
                      ) : (
                        <>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Asset Tag</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Type</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Status</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Source</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                        {group.group_type === 'user' ? (
                          <>
                            <td className="py-2.5 px-3 text-slate-200 font-medium">{member.name}</td>
                            <td className="py-2.5 px-3 text-slate-400">{member.email}</td>
                            <td className="py-2.5 px-3 text-slate-400 hidden md:table-cell">{member.department ?? '-'}</td>
                            <td className="py-2.5 px-3 text-slate-400 hidden lg:table-cell">{member.job_title ?? '-'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${
                                member.membership_source === 'dynamic' ? 'bg-brand-500/20 text-brand-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {member.membership_source}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-slate-200 font-medium">{member.name}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-xs">{member.asset_tag}</td>
                            <td className="py-2.5 px-3 text-slate-400 hidden md:table-cell">{member.type ?? '-'}{member.subtype ? ` / ${member.subtype}` : ''}</td>
                            <td className="py-2.5 px-3 hidden lg:table-cell">
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-300 rounded capitalize">
                                {member.status ?? '-'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${
                                member.membership_source === 'dynamic' ? 'bg-brand-500/20 text-brand-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {member.membership_source}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [activeTab, setActiveTab] = useState<DetailTab>('rules')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [evaluateResult, setEvaluateResult] = useState<EvaluateResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const detailRef = useRef<HTMLDivElement>(null)

  // ---- Data fetching ----

  const fetchGroups = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('group_type', typeFilter)
      const res = await fetch(`/api/portal/groups?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch groups')
      const data = await res.json()
      setGroups(data.groups ?? data.data ?? data ?? [])
    } catch (err) {
      console.error('Failed to fetch groups:', err)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    setLoading(true)
    fetchGroups()
  }, [fetchGroups])

  const fetchGroupDetail = useCallback(async (groupId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/portal/groups/${groupId}`)
      if (!res.ok) throw new Error('Failed to fetch group detail')
      const data = await res.json()
      setGroupDetail(data.group ?? data.data ?? data)
    } catch (err) {
      console.error('Failed to fetch group detail:', err)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const fetchMembers = useCallback(async (groupId: string) => {
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/portal/groups/${groupId}/members`)
      if (!res.ok) throw new Error('Failed to fetch members')
      const data = await res.json()
      setMembers(data.members ?? data.data ?? data ?? [])
    } catch (err) {
      console.error('Failed to fetch members:', err)
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  // When a group is selected, fetch detail + members
  useEffect(() => {
    if (selectedGroup) {
      setEvaluateResult(null)
      fetchGroupDetail(selectedGroup.id)
      fetchMembers(selectedGroup.id)

      // Auto-select correct tab
      const isDynamic = selectedGroup.membership_type === 'dynamic' || selectedGroup.membership_type === 'hybrid'
      setActiveTab(isDynamic ? 'rules' : 'members')
    }
  }, [selectedGroup, fetchGroupDetail, fetchMembers])

  // ---- Actions ----

  const handleCreateGroup = async (data: {
    name: string
    description: string
    group_type: 'user' | 'asset'
    membership_type: 'static' | 'dynamic' | 'hybrid'
    rule_logic: 'AND' | 'OR'
  }) => {
    const res = await fetch('/api/portal/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create group')
    setShowCreate(false)
    setToast(`Group "${data.name}" created`)
    await fetchGroups()
  }

  const handleEditGroup = async (data: {
    name: string
    description: string
    group_type: 'user' | 'asset'
    membership_type: 'static' | 'dynamic' | 'hybrid'
    rule_logic: 'AND' | 'OR'
  }) => {
    if (!editGroup) return
    const res = await fetch(`/api/portal/groups/${editGroup.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update group')
    setEditGroup(null)
    setToast(`Group "${data.name}" updated`)
    await fetchGroups()
    if (selectedGroup?.id === editGroup.id) {
      fetchGroupDetail(editGroup.id)
    }
  }

  const handleDeleteGroup = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/portal/groups/${confirmDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete group')
      setToast(`Group "${confirmDelete.name}" deleted`)
      if (selectedGroup?.id === confirmDelete.id) {
        setSelectedGroup(null)
        setGroupDetail(null)
        setMembers([])
      }
      setConfirmDelete(null)
      await fetchGroups()
    } catch (err) {
      console.error('Failed to delete group:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddRule = async (rule: { field_name: string; operator: string; value: string }) => {
    if (!selectedGroup) return
    const res = await fetch(`/api/portal/groups/${selectedGroup.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    })
    if (!res.ok) throw new Error('Failed to add rule')
    setToast('Rule added')
    await fetchGroupDetail(selectedGroup.id)
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!selectedGroup) return
    const res = await fetch(`/api/portal/groups/${selectedGroup.id}/rules/${ruleId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete rule')
    setToast('Rule removed')
    await fetchGroupDetail(selectedGroup.id)
  }

  const handleEvaluate = async () => {
    if (!selectedGroup) return
    setEvaluating(true)
    setEvaluateResult(null)
    try {
      const res = await fetch(`/api/portal/groups/${selectedGroup.id}/evaluate`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to evaluate')
      const data = await res.json()
      const result: EvaluateResult = data.result ?? data.data ?? data
      setEvaluateResult(result)
      setToast(`Evaluated: ${result.added} added, ${result.removed} removed, ${result.unchanged} unchanged`)
      // Refresh members + group data after evaluation
      fetchMembers(selectedGroup.id)
      fetchGroups()
    } catch (err) {
      console.error('Failed to evaluate:', err)
    } finally {
      setEvaluating(false)
    }
  }

  const handleSelectGroup = (group: Group) => {
    if (selectedGroup?.id === group.id) {
      setSelectedGroup(null)
      setGroupDetail(null)
      setMembers([])
    } else {
      setSelectedGroup(group)
      // Scroll to detail after a tick
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }

  // ---- Filtering ----

  const filteredGroups = groups.filter((g) => {
    if (typeFilter !== 'all' && g.group_type !== typeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        g.name.toLowerCase().includes(q) ||
        (g.description ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const typeCounts = {
    all: groups.length,
    user: groups.filter((g) => g.group_type === 'user').length,
    asset: groups.filter((g) => g.group_type === 'asset').length,
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Group"
          message={`Are you sure you want to delete "${confirmDelete.name}"? This will remove all rules and member associations. This action cannot be undone.`}
          confirmLabel="Delete Group"
          onConfirm={handleDeleteGroup}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <GroupFormModal
          group={null}
          onSave={handleCreateGroup}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Edit Modal */}
      {editGroup && (
        <GroupFormModal
          group={editGroup}
          onSave={handleEditGroup}
          onCancel={() => setEditGroup(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <UsersGroupIcon className="h-7 w-7" />
            Groups
          </h1>
          <p className="text-slate-400 mt-1">Organize people and assets with smart rules</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors font-medium text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          New Group
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {([
            { key: 'all' as TypeFilter, label: 'All', count: typeCounts.all },
            { key: 'user' as TypeFilter, label: 'User Groups', count: typeCounts.user },
            { key: 'asset' as TypeFilter, label: 'Asset Groups', count: typeCounts.asset },
          ]).map((chip) => (
            <button
              key={chip.key}
              onClick={() => setTypeFilter(chip.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                typeFilter === chip.key
                  ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {chip.label}
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                typeFilter === chip.key
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 sm:max-w-xs">
          <div className="relative">
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-1.5 pl-9 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <UsersGroupIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">
            {groups.length === 0 ? 'No groups yet' : 'No groups match your filters'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {groups.length === 0
              ? 'Create your first group to start organizing people and assets'
              : 'Try adjusting your search or filter criteria'}
          </p>
          {groups.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors text-sm font-medium"
            >
              <PlusIcon className="h-4 w-4" />
              Create Group
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isSelected = selectedGroup?.id === group.id
            return (
              <div key={group.id}>
                {/* Group Card */}
                <div
                  className={`bg-slate-800 rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-500/50 ring-1 ring-brand-500/20'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => handleSelectGroup(group)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                      group.group_type === 'user' ? 'bg-cyan-500/20' : 'bg-purple-500/20'
                    }`}>
                      {group.group_type === 'user'
                        ? <UserIcon className="h-5 w-5 text-cyan-400" />
                        : <ServerIcon className="h-5 w-5 text-purple-400" />
                      }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-100">{group.name}</h3>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${typeColor(group.group_type)}`}>
                          {group.group_type}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${membershipColor(group.membership_type)}`}>
                          {group.membership_type}
                        </span>
                        {(group.membership_type === 'dynamic' || group.membership_type === 'hybrid') && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            group.rule_logic === 'AND'
                              ? 'bg-blue-500/15 text-blue-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {group.rule_logic}
                          </span>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{group.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <UsersGroupIcon className="h-3.5 w-3.5" />
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </span>
                        <span>Evaluated {formatTimeAgo(group.last_evaluated_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditGroup(group)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Edit group"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      {(group.membership_type === 'dynamic' || group.membership_type === 'hybrid') && (
                        <button
                          onClick={async () => {
                            setSelectedGroup(group)
                            setEvaluating(true)
                            setEvaluateResult(null)
                            try {
                              const res = await fetch(`/api/portal/groups/${group.id}/evaluate`, { method: 'POST' })
                              if (!res.ok) throw new Error('Failed to evaluate')
                              const data = await res.json()
                              const result: EvaluateResult = data.result ?? data.data ?? data
                              setEvaluateResult(result)
                              setToast(`Evaluated: ${result.added} added, ${result.removed} removed, ${result.unchanged} unchanged`)
                              fetchGroups()
                              fetchMembers(group.id)
                            } catch (err) {
                              console.error('Evaluate failed:', err)
                            } finally {
                              setEvaluating(false)
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-colors"
                          title="Evaluate now"
                        >
                          <PlayIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(group)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete group"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                      <div className="pl-1 text-slate-500">
                        {isSelected
                          ? <ChevronUpIcon className="h-4 w-4" />
                          : <ChevronDownIcon className="h-4 w-4" />
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isSelected && (
                  <div ref={detailRef} className="mt-2">
                    <GroupDetailPanel
                      group={group}
                      groupDetail={groupDetail}
                      members={members}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      onAddRule={handleAddRule}
                      onDeleteRule={handleDeleteRule}
                      onEvaluate={handleEvaluate}
                      evaluateResult={evaluateResult}
                      evaluating={evaluating}
                      loadingDetail={loadingDetail}
                      loadingMembers={loadingMembers}
                      onClose={() => {
                        setSelectedGroup(null)
                        setGroupDetail(null)
                        setMembers([])
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
