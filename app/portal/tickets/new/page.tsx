'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense, useCallback } from 'react'
import { LinkItems, type LinkedItem } from '@/components/LinkItems'
import { TicketSearch } from '@/components/TicketSearch'

interface TicketTypeConfig {
  id: string
  name: string
  description_template: string | null
  default_priority: string
  requires_approval: boolean
  is_visible: boolean
}

interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  parent_id: string | null
  depth: number
}

const TYPE_META: Record<string, { title: string; subtitle: string; backHref: string }> = {
  incident: {
    title: 'Report an Issue',
    subtitle: 'Something is broken or not working correctly',
    backHref: '/portal/tickets',
  },
  problem: {
    title: 'Problem Investigation',
    subtitle: 'Investigate the root cause of recurring issues',
    backHref: '/portal/tickets',
  },
  change: {
    title: 'Change Request',
    subtitle: 'Propose a change to infrastructure or services',
    backHref: '/portal/tickets',
  },
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'No rush', color: 'slate' },
  { value: 'medium', label: 'Medium', desc: 'Normal priority', color: 'yellow' },
  { value: 'high', label: 'High', desc: 'Urgent', color: 'orange' },
  { value: 'critical', label: 'Critical', desc: 'Business critical', color: 'red' },
]

const RISK_LEVELS = [
  { value: 'low', label: 'Low', desc: 'Minimal impact, easily reversible' },
  { value: 'medium', label: 'Medium', desc: 'Some impact, standard change window' },
  { value: 'high', label: 'High', desc: 'Significant impact, requires careful planning' },
]

const CHANGE_TYPES = [
  {
    value: 'standard',
    label: 'Standard',
    desc: 'Routine, pre-approved change (software install, user provisioning)',
    approval: 'No approval needed',
    color: 'brand',
  },
  {
    value: 'normal',
    label: 'Normal',
    desc: 'Planned change requiring review (server migration, network update)',
    approval: 'Requires approval',
    color: 'yellow',
  },
  {
    value: 'emergency',
    label: 'Emergency',
    desc: 'Urgent fix for a critical issue (security patch, outage recovery)',
    approval: 'Expedited approval + post-review',
    color: 'red',
  },
]

const CHANGE_AREAS = [
  'Infrastructure',
  'Application',
  'Network',
  'Security',
  'Access/Identity',
  'Cloud',
  'Database',
  'Policy/Process',
]

const CHANGE_TEMPLATES = {
  description: `What is being changed and why?
[Describe what you are changing and the business reason]

Expected outcome:
[What will be different after this change?]`,
  implementation_plan: `Pre-implementation steps:
1. [Backup / snapshot current state]
2. [Notify affected users/teams]

Implementation steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Post-implementation verification:
1. [Verify service is operational]
2. [Confirm no degradation]`,
  rollback_plan: `If the change fails or causes issues:
1. [Revert to previous state / restore backup]
2. [Verify rollback is successful]
3. [Notify stakeholders of rollback]

Rollback time estimate: [X minutes/hours]`,
}

interface UserAsset {
  id: string
  name: string
  asset_tag: string | null
  type_name: string | null
}

// Fallback category icons when DB icon is null
const CATEGORY_ICONS: Record<string, string> = {
  Hardware: '\uD83D\uDDA5\uFE0F',
  Software: '\uD83D\uDCBF',
  Network: '\uD83C\uDF10',
  Email: '\uD83D\uDCE7',
  Security: '\uD83D\uDD12',
  Account: '\uD83D\uDD11',
  General: '\u2753',
  Other: '\u2753',
}

function NewTicketForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ticketType = searchParams.get('type') || 'incident'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [types, setTypes] = useState<TicketTypeConfig[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showTypePicker, setShowTypePicker] = useState(false)

  // Track the template currently in the description for smart replacement
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    subject: searchParams.get('subject') || '',
    description: searchParams.get('description') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    contact_email: '',
    // Change Request fields
    risk_level: 'medium',
    change_type: '' as string,
    change_areas: [] as string[],
    implementation_plan: '',
    rollback_plan: '',
    scheduled_start: '',
    scheduled_end: '',
    // Problem fields
    impact: '',
    related_ticket_ids: [] as string[],
  })

  // Linked items for the LinkItems component (pre-ticket-creation, managed locally)
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([])
  const [userAssets, setUserAssets] = useState<UserAsset[]>([])

  const meta = TYPE_META[ticketType] || TYPE_META.incident
  const currentType = types.find(t => t.name.toLowerCase().replace(/\s+/g, '_').replace('_request', '') === ticketType
    || t.name.toLowerCase() === ticketType
    || (ticketType === 'change' && t.name === 'Change Request')
    || (ticketType === 'incident' && t.name === 'Incident')
    || (ticketType === 'problem' && t.name === 'Problem')
  )

  // Fetch types and categories on mount
  useEffect(() => {
    fetch('/api/portal/ticket-types')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.types) {
          setTypes(data.types)
          // Set default priority from type if not already set by URL param
          if (!searchParams.get('priority')) {
            const typeMatch = data.types.find((t: TicketTypeConfig) =>
              (ticketType === 'incident' && t.name === 'Incident') ||
              (ticketType === 'problem' && t.name === 'Problem') ||
              (ticketType === 'change' && t.name === 'Change Request')
            )
            if (typeMatch?.default_priority) {
              setFormData(prev => ({ ...prev, priority: typeMatch.default_priority }))
            }
          }
        }
      })
      .catch(() => {})

    if (ticketType !== 'problem') {
      fetch('/api/portal/categories')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.categories) setCategories(data.categories)
        })
        .catch(() => {})
    }
  }, [ticketType, searchParams])

  // Fetch user's assigned assets for auto-linking
  useEffect(() => {
    fetch('/api/portal/assets/mine')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.assets) setUserAssets(data.assets)
      })
      .catch(() => {})
  }, [])

  // Apply type template on mount if no description from URL params
  // For change requests, apply structured templates to each field
  useEffect(() => {
    if (ticketType === 'change' && !searchParams.get('description')) {
      setFormData(prev => ({
        ...prev,
        description: prev.description || CHANGE_TEMPLATES.description,
        implementation_plan: prev.implementation_plan || CHANGE_TEMPLATES.implementation_plan,
        rollback_plan: prev.rollback_plan || CHANGE_TEMPLATES.rollback_plan,
      }))
      setActiveTemplate(CHANGE_TEMPLATES.description)
    } else if (!searchParams.get('description') && currentType?.description_template && !formData.description) {
      setFormData(prev => ({ ...prev, description: currentType.description_template! }))
      setActiveTemplate(currentType.description_template)
    }
  }, [currentType, searchParams, ticketType])

  // Set default priority if not set
  useEffect(() => {
    if (!formData.priority) {
      setFormData(prev => ({ ...prev, priority: ticketType === 'problem' ? 'high' : 'medium' }))
    }
  }, [ticketType, formData.priority])

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    setFormData(prev => ({ ...prev, category: categoryId }))

    // Fetch category template
    try {
      const res = await fetch(`/api/portal/categories/${categoryId}/template`)
      if (!res.ok) return
      const data = await res.json()

      // Apply subject prefix
      if (data.subject_prefix) {
        setFormData(prev => {
          // Only prepend if subject doesn't already start with a prefix
          const hasPrefix = categories.some(c => {
            const prefix = c.name + ': '
            return prev.subject.startsWith(prefix)
          })
          if (!hasPrefix && !prev.subject) {
            return { ...prev, subject: data.subject_prefix }
          }
          return prev
        })
      }

      // Apply description template — only if description matches previous template or is empty
      const template = data.description_template || currentType?.description_template || null
      if (template) {
        setFormData(prev => {
          if (!prev.description || prev.description === activeTemplate) {
            return { ...prev, description: template }
          }
          return prev
        })
        setActiveTemplate(template)
      }
    } catch {
      // Non-critical
    }
  }, [categories, currentType, activeTemplate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Find category name from id
    const selectedCategory = categories.find(c => c.id === formData.category)

    const body: Record<string, unknown> = {
      subject: formData.subject,
      description: formData.description,
      priority: formData.priority,
      category: selectedCategory?.name || formData.category,
      contact_email: formData.contact_email || undefined,
      type: ticketType,
    }

    // Add change request fields
    if (ticketType === 'change') {
      body.change_type = formData.change_type || undefined
      body.change_areas = formData.change_areas.length > 0 ? formData.change_areas : undefined
      body.risk_level = formData.risk_level
      body.implementation_plan = formData.implementation_plan || undefined
      body.rollback_plan = formData.rollback_plan || undefined
      body.scheduled_start = formData.scheduled_start || undefined
      body.scheduled_end = formData.scheduled_end || undefined
    }

    // Add problem fields
    if (ticketType === 'problem') {
      body.impact = formData.impact || undefined
      body.related_ticket_ids = formData.related_ticket_ids.length > 0 ? formData.related_ticket_ids : undefined
    }

    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create ticket')
      }

      const data = await res.json()

      // Create links for linked items (non-blocking)
      if (linkedItems.length > 0 && data.id) {
        for (const item of linkedItems) {
          fetch(`/api/portal/tickets/${data.id}/links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType: item.entityType, targetId: item.id }),
          }).catch(() => {})
        }
      }

      router.push(`/portal/tickets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket')
      setLoading(false)
    }
  }

  const visibleTypes = types.filter(t => t.is_visible && t.name !== 'Service Request')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={meta.backHref}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{meta.title}</h1>
            {visibleTypes.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTypePicker(!showTypePicker)}
                  className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
                >
                  [change]
                </button>
                {showTypePicker && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                    {visibleTypes.map(t => {
                      const typeKey = t.name === 'Incident' ? 'incident' : t.name === 'Problem' ? 'problem' : 'change'
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setShowTypePicker(false)
                            router.push(`/portal/tickets/new?type=${typeKey}`)
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            typeKey === ticketType
                              ? 'bg-brand-500/10 text-brand-400'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {t.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-slate-400 mt-1">{meta.subtitle}</p>
        </div>
      </div>

      {/* Approval notice for change requests — based on change_type */}
      {ticketType === 'change' && formData.change_type && formData.change_type !== 'standard' && (
        <div className={`${formData.change_type === 'emergency' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'} border rounded-lg p-4 flex items-start gap-3`}>
          <InfoIcon className={`h-5 w-5 ${formData.change_type === 'emergency' ? 'text-red-400' : 'text-amber-400'} mt-0.5 flex-shrink-0`} />
          <div>
            <p className={`text-sm font-medium ${formData.change_type === 'emergency' ? 'text-red-400' : 'text-amber-400'}`}>
              {formData.change_type === 'emergency' ? 'Emergency — Expedited Approval' : 'Requires Approval'}
            </p>
            <p className={`text-xs mt-0.5 ${formData.change_type === 'emergency' ? 'text-red-400/70' : 'text-amber-400/70'}`}>
              {formData.change_type === 'emergency'
                ? 'This emergency change will be fast-tracked for approval and requires a post-implementation review.'
                : 'This change request will be sent for approval before implementation can begin.'}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection — for incidents and service requests only */}
        {ticketType !== 'problem' && ticketType !== 'change' && categories.length > 0 && (() => {
          const topLevel = categories.filter(c => !c.parent_id)
          const selectedParent = topLevel.find(c => c.id === formData.category)
            || topLevel.find(c => categories.some(sub => sub.parent_id === c.id && sub.id === formData.category))
          const subcategories = selectedParent
            ? categories.filter(c => c.parent_id === selectedParent.id)
            : []

          return (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                What type of issue is this?
              </label>
              {/* Parent categories */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {topLevel.map((cat) => {
                  const isParentSelected = selectedParent?.id === cat.id
                  const isDirectSelection = formData.category === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        const children = categories.filter(c => c.parent_id === cat.id)
                        if (children.length === 0) {
                          handleCategorySelect(cat.id)
                        } else {
                          // Select parent to show subcategories, but don't set as final category yet
                          setFormData(prev => ({ ...prev, category: cat.id }))
                        }
                      }}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        isParentSelected || isDirectSelection
                          ? 'bg-brand-500/10 border-brand-500/50 text-brand-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl block mb-2">
                        {CATEGORY_ICONS[cat.name] || '\u2753'}
                      </span>
                      <span className="text-sm font-medium">{cat.name}</span>
                    </button>
                  )
                })}
              </div>

              {/* Subcategories — shown when parent with children is selected */}
              {subcategories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Select a more specific category:
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleCategorySelect(sub.id)}
                        className={`p-3 rounded-lg border text-left transition-all text-sm ${
                          formData.category === sub.id
                            ? 'bg-brand-500/10 border-brand-500/50 text-brand-400'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                    {/* Option to keep parent category without specifying subcategory */}
                    <button
                      type="button"
                      onClick={() => handleCategorySelect(selectedParent!.id)}
                      className={`p-3 rounded-lg border text-left transition-all text-sm ${
                        formData.category === selectedParent!.id
                          ? 'bg-brand-500/10 border-brand-500/50 text-brand-400'
                          : 'bg-slate-800/30 border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                      }`}
                    >
                      Other / Not sure
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Change Type Selection — for change requests only */}
        {ticketType === 'change' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-4">
                What kind of change is this?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CHANGE_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => {
                      const riskMap: Record<string, string> = { standard: 'low', normal: 'medium', emergency: 'high' }
                      setFormData(prev => ({
                        ...prev,
                        change_type: ct.value,
                        risk_level: riskMap[ct.value] || 'medium',
                      }))
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      formData.change_type === ct.value
                        ? ct.color === 'brand' ? 'bg-brand-500/10 border-brand-500/50'
                          : ct.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50'
                          : 'bg-red-500/10 border-red-500/50'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${
                      formData.change_type === ct.value
                        ? ct.color === 'brand' ? 'text-brand-400'
                          : ct.color === 'yellow' ? 'text-yellow-400'
                          : 'text-red-400'
                        : 'text-slate-200'
                    }`}>
                      {ct.label}
                    </span>
                    <span className="text-xs text-slate-500 block mt-1">{ct.desc}</span>
                    <span className={`text-xs block mt-2 ${
                      ct.color === 'brand' ? 'text-brand-500/70'
                        : ct.color === 'yellow' ? 'text-yellow-500/70'
                        : 'text-red-500/70'
                    }`}>
                      {ct.approval}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Change Area chips — shown after type selection */}
            {formData.change_type && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  What areas are affected?
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANGE_AREAS.map((area) => {
                    const selected = formData.change_areas.includes(area)
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            change_areas: selected
                              ? prev.change_areas.filter(a => a !== area)
                              : [...prev.change_areas, area],
                          }))
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          selected
                            ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {area}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subject & Description */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="subject"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of the issue"
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              required
              rows={8}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Please provide as much detail as possible..."
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none font-mono"
            />
            {activeTemplate && formData.description === activeTemplate && (
              <p className="text-xs text-slate-600 mt-1.5">
                Fill in the template above, replacing the bracketed sections with your details.
              </p>
            )}
          </div>
        </div>

        {/* Problem-specific: Impact + Related Incidents */}
        {ticketType === 'problem' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <SearchIcon className="h-4 w-4 text-purple-400" />
              Problem Investigation Details
            </h3>
            <div>
              <label htmlFor="impact" className="block text-sm font-medium text-slate-300 mb-2">
                Impact Assessment
              </label>
              <textarea
                id="impact"
                rows={3}
                value={formData.impact}
                onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                placeholder="How many users are affected? What business processes are impacted?"
                className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
              />
            </div>

            {/* Link Related Incidents */}
            <TicketSearch
              selectedIds={formData.related_ticket_ids}
              onSelect={(ids) => setFormData(prev => ({ ...prev, related_ticket_ids: ids }))}
              label="Link Related Incidents"
              placeholder="Search by ticket number or subject..."
            />
          </div>
        )}

        {/* Change Request-specific fields */}
        {ticketType === 'change' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <BranchIcon className="h-4 w-4 text-amber-400" />
              Change Details
            </h3>

            {/* Risk Level */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Risk Level
              </label>
              <div className="flex flex-wrap gap-3">
                {RISK_LEVELS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, risk_level: r.value })}
                    className={`flex-1 min-w-[140px] p-3 rounded-lg border text-left transition-all ${
                      formData.risk_level === r.value
                        ? r.value === 'low' ? 'bg-brand-500/10 border-brand-500/50' :
                          r.value === 'medium' ? 'bg-yellow-500/10 border-yellow-500/50' :
                          'bg-red-500/10 border-red-500/50'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      formData.risk_level === r.value
                        ? r.value === 'low' ? 'text-brand-400' :
                          r.value === 'medium' ? 'text-yellow-400' :
                          'text-red-400'
                        : 'text-slate-300'
                    }`}>
                      {r.label}
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Implementation Plan */}
            <div>
              <label htmlFor="implementation_plan" className="block text-sm font-medium text-slate-300 mb-2">
                Implementation Plan
              </label>
              <textarea
                id="implementation_plan"
                rows={4}
                value={formData.implementation_plan}
                onChange={(e) => setFormData({ ...formData, implementation_plan: e.target.value })}
                placeholder="Step-by-step plan for implementing this change..."
                className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
              />
            </div>

            {/* Rollback Plan */}
            <div>
              <label htmlFor="rollback_plan" className="block text-sm font-medium text-slate-300 mb-2">
                Rollback Plan
              </label>
              <textarea
                id="rollback_plan"
                rows={3}
                value={formData.rollback_plan}
                onChange={(e) => setFormData({ ...formData, rollback_plan: e.target.value })}
                placeholder="How to revert if something goes wrong..."
                className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
              />
            </div>

            {/* Scheduled Window */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduled_start" className="block text-sm font-medium text-slate-300 mb-2">
                  Scheduled Start
                </label>
                <input
                  type="datetime-local"
                  id="scheduled_start"
                  value={formData.scheduled_start}
                  onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                  className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>
              <div>
                <label htmlFor="scheduled_end" className="block text-sm font-medium text-slate-300 mb-2">
                  Scheduled End
                </label>
                <input
                  type="datetime-local"
                  id="scheduled_end"
                  value={formData.scheduled_end}
                  onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                  className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Priority & Contact */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Priority
            </label>
            <div className="flex flex-wrap gap-3">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={`flex-1 min-w-[120px] p-3 rounded-lg border text-left transition-all ${
                    formData.priority === p.value
                      ? p.color === 'slate' ? 'bg-slate-500/10 border-slate-500/50' :
                        p.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50' :
                        p.color === 'orange' ? 'bg-orange-500/10 border-orange-500/50' :
                        'bg-red-500/10 border-red-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    formData.priority === p.value
                      ? p.color === 'slate' ? 'text-slate-300' :
                        p.color === 'yellow' ? 'text-yellow-400' :
                        p.color === 'orange' ? 'text-orange-400' :
                        'text-red-400'
                      : 'text-slate-300'
                  }`}>
                    {p.label}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-slate-300 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              id="contact_email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="your@email.com"
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            <p className="text-xs text-slate-500 mt-2">Leave blank to use your account email</p>
          </div>
        </div>

        {/* Link Items — assets, KB, documents */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-brand-400" />
            Linked Items
          </h3>

          {/* Quick-link user's assigned assets */}
          {userAssets.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Your devices</p>
              <div className="flex flex-wrap gap-1.5">
                {userAssets.map(asset => {
                  const isLinked = linkedItems.some(li => li.id === asset.id && li.entityType === 'asset')
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        if (isLinked) {
                          setLinkedItems(prev => prev.filter(li => !(li.id === asset.id && li.entityType === 'asset')))
                        } else {
                          setLinkedItems(prev => [...prev, {
                            id: asset.id,
                            name: asset.name,
                            subtitle: asset.asset_tag || undefined,
                            type: asset.type_name || undefined,
                            entityType: 'asset',
                          }])
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-all ${
                        isLinked
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <MonitorIcon className="h-3 w-3" />
                      {asset.name}
                      {asset.asset_tag && <span className="text-slate-500">{asset.asset_tag}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <LinkItems
            allowedTypes={['asset', 'ticket', 'kb_article', 'document']}
            linkedItems={linkedItems}
            onLink={(item) => setLinkedItems(prev => [...prev, item])}
            onUnlink={(item) => setLinkedItems(prev => prev.filter(li => !(li.id === item.id && li.entityType === item.entityType)))}
          />
        </div>

        {/* Attachments */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Attachments
          </label>
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition-colors cursor-pointer">
            <UploadIcon className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Drag and drop files here, or <span className="text-brand-400">browse</span>
            </p>
            <p className="text-xs text-slate-600 mt-1">PNG, JPG, PDF up to 10MB</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/portal/tickets"
            className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !formData.subject || !formData.description}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Creating...
              </>
            ) : (
              <>
                <SendIcon className="h-5 w-5" />
                {ticketType === 'change'
                  ? (formData.change_type === 'standard' ? 'Submit Change' : 'Submit for Approval')
                  : 'Submit Ticket'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewTicketPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    }>
      <NewTicketForm />
    </Suspense>
  )
}

// Inline SVG icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

function BranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6v6m0 0a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0v3a3 3 0 0 1-3 3H9" />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </svg>
  )
}
