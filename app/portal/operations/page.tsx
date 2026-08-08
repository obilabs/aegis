'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoardPerson {
  id: string
  ticket_id: string
  person_name: string
  person_email: string
  job_title_name: string
  department: string
  start_date: string
  manager_name: string
  buddy_name: string
  status: string
  progress: { completed: number; total: number }
}

interface ServiceCategory {
  key: string
  label: string
  total: number
  completed: number
}

interface MatrixCell {
  task_id: string
  title: string
  is_completed: boolean
  is_required: boolean
  assigned_to_name: string
}

interface BoardData {
  people: BoardPerson[]
  service_categories: ServiceCategory[]
  matrix: Record<string, Record<string, MatrixCell>>
}

interface JobTitle {
  id: string
  name: string
  department: string
  entitlement_count: number
}

interface Entitlement {
  id: string
  entitlement_type: string
  resource_name: string
  service_category: string
  is_required: boolean
}

interface JobTitleDetail {
  id: string
  name: string
  department: string
  entitlements: Entitlement[]
}

interface PeopleUser {
  id: string
  name: string
  email: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEntitlementBadgeClasses(type: string): string {
  switch (type) {
    case 'saas_service':
      return 'bg-blue-500/20 text-blue-400'
    case 'hardware':
      return 'bg-orange-500/20 text-orange-400'
    case 'access':
      return 'bg-purple-500/20 text-purple-400'
    case 'software':
      return 'bg-cyan-500/20 text-cyan-400'
    case 'accessory':
      return 'bg-pink-500/20 text-pink-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

function formatEntitlementType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs to match codebase pattern)
// ---------------------------------------------------------------------------

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
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

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-slate-200 bg-slate-800 border border-slate-700 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function OperationsBoardPage() {
  const router = useRouter()

  // Board state
  const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding' | 'completed'>('onboarding')
  const [boardData, setBoardData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showOnboardModal, setShowOnboardModal] = useState(false)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
  const [selectedJobTitle, setSelectedJobTitle] = useState<JobTitle | null>(null)
  const [jobTitleDetail, setJobTitleDetail] = useState<JobTitleDetail | null>(null)
  const [loadingJobTitleDetail, setLoadingJobTitleDetail] = useState(false)
  const [personForm, setPersonForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    start_date: '',
    manager_id: '',
    buddy_id: '',
    location_id: '',
  })
  const [removedEntitlements, setRemovedEntitlements] = useState<string[]>([])
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // People list for manager/buddy selects
  const [users, setUsers] = useState<PeopleUser[]>([])

  // Completing columns
  const [completingColumn, setCompletingColumn] = useState<string | null>(null)

  // ---------- Data fetching ----------

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const statusParam = activeTab === 'completed' ? 'completed' : 'active'
      const typeParam = activeTab === 'completed' ? 'onboarding' : activeTab
      const res = await fetch(`/api/portal/operations/board?type=${typeParam}&status=${statusParam}`)
      if (!res.ok) throw new Error('Failed to load operations board')
      const data = await res.json()
      setBoardData(data)
    } catch (err: unknown) {
      console.error('Board fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load operations board')
      setBoardData(null)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const fetchJobTitles = async () => {
    try {
      const res = await fetch('/api/portal/settings/job-titles')
      if (res.ok) {
        const data = await res.json()
        setJobTitles(data.job_titles || [])
      }
    } catch {
      console.error('Failed to fetch job titles')
    }
  }

  const fetchJobTitleDetail = async (id: string) => {
    setLoadingJobTitleDetail(true)
    try {
      const res = await fetch(`/api/portal/settings/job-titles/${id}`)
      if (res.ok) {
        const data = await res.json()
        setJobTitleDetail(data.job_title || null)
      }
    } catch {
      console.error('Failed to fetch job title detail')
    } finally {
      setLoadingJobTitleDetail(false)
    }
  }

  const fetchUsers = async () => {
    try {
      // NOTE: If /api/portal/people doesn't exist yet, this will gracefully fail
      // and the manager/buddy dropdowns will show empty options
      const res = await fetch('/api/portal/people')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {
      // Non-critical: users list may not be available yet
      setUsers([])
    }
  }

  // ---------- Actions ----------

  const handleColumnComplete = async (categoryKey: string) => {
    if (!boardData) return

    // Gather all incomplete task_ids in this column
    const taskIds: string[] = []
    for (const person of boardData.people) {
      const cell = boardData.matrix[person.ticket_id]?.[categoryKey]
      if (cell && !cell.is_completed) {
        taskIds.push(cell.task_id)
      }
    }

    if (taskIds.length === 0) return

    setCompletingColumn(categoryKey)
    try {
      const res = await fetch('/api/portal/operations/batch-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds }),
      })
      if (!res.ok) throw new Error('Failed to complete tasks')
      await fetchBoard()
    } catch (err) {
      console.error('Batch complete error:', err)
    } finally {
      setCompletingColumn(null)
    }
  }

  const openOnboardModal = () => {
    // Reset wizard state
    setWizardStep(1)
    setSelectedJobTitle(null)
    setJobTitleDetail(null)
    setPersonForm({
      first_name: '',
      last_name: '',
      email: '',
      start_date: '',
      manager_id: '',
      buddy_id: '',
      location_id: '',
    })
    setRemovedEntitlements([])
    setAdditionalNotes('')
    setSubmitting(false)
    setSubmitSuccess(false)
    setShowOnboardModal(true)

    // Fetch data for the wizard
    fetchJobTitles()
    fetchUsers()
  }

  const handleSelectJobTitle = (jt: JobTitle) => {
    setSelectedJobTitle(jt)
    fetchJobTitleDetail(jt.id)
  }

  const handleSubmitOnboarding = async () => {
    if (!selectedJobTitle) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/operations/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title_id: selectedJobTitle.id,
          person: {
            first_name: personForm.first_name,
            last_name: personForm.last_name,
            email: personForm.email,
            start_date: personForm.start_date,
            manager_id: personForm.manager_id || null,
            location_id: personForm.location_id || null,
            buddy_id: personForm.buddy_id || null,
          },
          removed_entitlements: removedEntitlements,
          additional_notes: additionalNotes,
        }),
      })
      if (!res.ok) throw new Error('Failed to start onboarding')
      setSubmitSuccess(true)
      // Refresh board after short delay so user sees success message
      setTimeout(() => {
        setShowOnboardModal(false)
        fetchBoard()
      }, 1500)
    } catch (err) {
      console.error('Onboarding submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const isStep2Valid =
    personForm.first_name.trim() !== '' &&
    personForm.last_name.trim() !== '' &&
    personForm.email.trim() !== '' &&
    personForm.start_date.trim() !== ''

  // ---------- Render helpers ----------

  const renderTabs = () => {
    const tabs: { key: typeof activeTab; label: string }[] = [
      { key: 'onboarding', label: 'Onboarding' },
      { key: 'offboarding', label: 'Offboarding' },
      { key: 'completed', label: 'Completed' },
    ]

    return (
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
        {tabs.map((tab) => (
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
    )
  }

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="p-4 bg-slate-800 rounded-2xl mb-6">
        <UsersIcon className="h-12 w-12 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        No active {activeTab === 'completed' ? 'completed' : activeTab} requests
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        {activeTab === 'onboarding'
          ? 'Start by creating a new onboarding request'
          : activeTab === 'offboarding'
            ? 'No offboarding processes are currently active'
            : 'No completed operations to display'}
      </p>
      {activeTab === 'onboarding' && (
        <button
          onClick={openOnboardModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          New Onboarding
        </button>
      )}
    </div>
  )

  const renderMatrixView = () => {
    if (!boardData) return null
    const { people, service_categories, matrix } = boardData

    if (people.length === 0) return renderEmptyState()

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            {/* Header */}
            <thead>
              <tr className="bg-slate-800/50">
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300 w-64 min-w-[16rem]">
                  Person
                </th>
                {service_categories.map((cat) => (
                  <th
                    key={cat.key}
                    className="text-center px-3 py-3 text-sm font-semibold text-slate-300 min-w-[8rem]"
                  >
                    <div>{cat.label}</div>
                    <div className="text-xs font-normal text-slate-500 mt-0.5">
                      {cat.completed}/{cat.total} done
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-800">
              {people.map((person) => {
                const progressPct =
                  person.progress.total > 0
                    ? Math.round((person.progress.completed / person.progress.total) * 100)
                    : 0

                return (
                  <tr
                    key={person.id}
                    className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/portal/tickets/${person.ticket_id}`)}
                  >
                    {/* Person cell */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm text-slate-100">
                          {person.person_name}
                        </span>
                        <span className="text-xs text-slate-500">{person.job_title_name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">
                            {formatDate(person.start_date)}
                          </span>
                          <div className="flex-1 max-w-[80px] h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {person.progress.completed}/{person.progress.total}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category cells */}
                    {service_categories.map((cat) => {
                      const cell = matrix[person.ticket_id]?.[cat.key]

                      if (!cell) {
                        return (
                          <td key={cat.key} className="px-3 py-3 text-center">
                            <span className="text-slate-700">--</span>
                          </td>
                        )
                      }

                      const tooltipText = `${cell.title}${cell.assigned_to_name ? ` (${cell.assigned_to_name})` : ''}`

                      return (
                        <td
                          key={cat.key}
                          className="px-3 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip text={tooltipText}>
                            <div className="inline-flex flex-col items-center gap-1">
                              {cell.is_completed ? (
                                <div className="p-1.5 bg-brand-500/10 rounded-lg">
                                  <CheckIcon className="h-4 w-4 text-brand-400" />
                                </div>
                              ) : (
                                <div className="p-1.5 bg-slate-800 rounded-lg">
                                  <CircleIcon className="h-4 w-4 text-slate-500" />
                                </div>
                              )}
                              {cell.is_required && (
                                <span className="px-1 py-0.5 text-[9px] font-semibold bg-red-500/20 text-red-400 rounded">
                                  REQ
                                </span>
                              )}
                            </div>
                          </Tooltip>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>

            {/* Footer with complete buttons */}
            {activeTab !== 'completed' && (
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td className="px-4 py-3" />
                  {service_categories.map((cat) => {
                    const incompleteCount = cat.total - cat.completed
                    const isCompleting = completingColumn === cat.key

                    return (
                      <td key={cat.key} className="px-3 py-3 text-center">
                        {incompleteCount > 0 ? (
                          <button
                            onClick={() => handleColumnComplete(cat.key)}
                            disabled={isCompleting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-600/20 text-brand-400 rounded-lg hover:bg-brand-600/30 transition-colors disabled:opacity-50"
                          >
                            {isCompleting ? (
                              <div className="animate-spin rounded-full h-3 w-3 border border-brand-400 border-t-transparent" />
                            ) : (
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                            )}
                            Complete All
                          </button>
                        ) : (
                          <span className="text-xs text-brand-500/60">All done</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  // ---------- Wizard Steps ----------

  const renderWizardStep1 = () => (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">
        Select the job title for the new team member. This determines their default entitlements.
      </div>
      {jobTitles.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No job titles configured. Create job titles in Settings first.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {jobTitles.map((jt) => (
            <button
              key={jt.id}
              onClick={() => handleSelectJobTitle(jt)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedJobTitle?.id === jt.id
                  ? 'bg-brand-500/10 border-brand-500/40 ring-1 ring-brand-500/30'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-slate-200">{jt.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{jt.department}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {jt.entitlement_count} entitlement{jt.entitlement_count !== 1 ? 's' : ''}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 text-slate-600" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Entitlements preview when job title selected */}
      {selectedJobTitle && (
        <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Default Entitlements
          </h4>
          {loadingJobTitleDetail ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : jobTitleDetail ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {jobTitleDetail.entitlements.map((ent) => (
                <div key={ent.id} className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${getEntitlementBadgeClasses(ent.entitlement_type)}`}>
                    {formatEntitlementType(ent.entitlement_type)}
                  </span>
                  <span className="text-slate-300">{ent.resource_name}</span>
                  {ent.is_required && (
                    <span className="px-1 py-0.5 text-[9px] font-semibold bg-red-500/20 text-red-400 rounded">
                      REQ
                    </span>
                  )}
                </div>
              ))}
              {jobTitleDetail.entitlements.length === 0 && (
                <p className="text-xs text-slate-500">No entitlements configured for this job title.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )

  const renderWizardStep2 = () => (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">
        Enter the details for the person being onboarded.
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* First Name */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            First Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={personForm.first_name}
            onChange={(e) => setPersonForm({ ...personForm, first_name: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            placeholder="Jane"
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Last Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={personForm.last_name}
            onChange={(e) => setPersonForm({ ...personForm, last_name: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            placeholder="Doe"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          value={personForm.email}
          onChange={(e) => setPersonForm({ ...personForm, email: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          placeholder="jane.doe@company.com"
        />
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Start Date <span className="text-red-400">*</span>
        </label>
        <input
          type="date"
          value={personForm.start_date}
          onChange={(e) => setPersonForm({ ...personForm, start_date: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Manager */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Manager</label>
          <select
            value={personForm.manager_id}
            onChange={(e) => setPersonForm({ ...personForm, manager_id: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          >
            <option value="">-- Select --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Buddy */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Buddy</label>
          <select
            value={personForm.buddy_id}
            onChange={(e) => setPersonForm({ ...personForm, buddy_id: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          >
            <option value="">-- Select --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )

  const renderWizardStep3 = () => (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">
        Review the onboarding details below. Uncheck any entitlements you want to exclude.
      </div>

      {/* Summary */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">Name:</span>{' '}
            <span className="text-slate-200 font-medium">
              {personForm.first_name} {personForm.last_name}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Email:</span>{' '}
            <span className="text-slate-200">{personForm.email}</span>
          </div>
          <div>
            <span className="text-slate-500">Start Date:</span>{' '}
            <span className="text-slate-200">{personForm.start_date}</span>
          </div>
          <div>
            <span className="text-slate-500">Job Title:</span>{' '}
            <span className="text-slate-200">{selectedJobTitle?.name}</span>
          </div>
          <div>
            <span className="text-slate-500">Department:</span>{' '}
            <span className="text-slate-200">{selectedJobTitle?.department}</span>
          </div>
          {personForm.manager_id && (
            <div>
              <span className="text-slate-500">Manager:</span>{' '}
              <span className="text-slate-200">
                {users.find((u) => u.id === personForm.manager_id)?.name || personForm.manager_id}
              </span>
            </div>
          )}
          {personForm.buddy_id && (
            <div>
              <span className="text-slate-500">Buddy:</span>{' '}
              <span className="text-slate-200">
                {users.find((u) => u.id === personForm.buddy_id)?.name || personForm.buddy_id}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Entitlements checklist */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Entitlements
        </h4>
        {jobTitleDetail && jobTitleDetail.entitlements.length > 0 ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {jobTitleDetail.entitlements.map((ent) => {
              const isRemoved = removedEntitlements.includes(ent.id)
              return (
                <label
                  key={ent.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isRemoved
                      ? 'bg-slate-800/30 border-slate-800 opacity-50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!isRemoved}
                    onChange={() => {
                      if (isRemoved) {
                        setRemovedEntitlements(removedEntitlements.filter((id) => id !== ent.id))
                      } else {
                        setRemovedEntitlements([...removedEntitlements, ent.id])
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0"
                  />
                  <div className="flex items-center gap-2 flex-1 text-sm">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getEntitlementBadgeClasses(ent.entitlement_type)}`}>
                      {formatEntitlementType(ent.entitlement_type)}
                    </span>
                    <span className={isRemoved ? 'text-slate-500 line-through' : 'text-slate-200'}>
                      {ent.resource_name}
                    </span>
                    {ent.is_required && (
                      <span className="px-1 py-0.5 text-[9px] font-semibold bg-red-500/20 text-red-400 rounded">
                        REQ
                      </span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No entitlements to review.</p>
        )}
      </div>

      {/* Additional notes */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Additional Notes
        </label>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
          placeholder="Any special requirements or instructions..."
        />
      </div>
    </div>
  )

  const renderModal = () => {
    if (!showOnboardModal) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => !submitting && setShowOnboardModal(false)}
        />

        {/* Panel */}
        <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">New Onboarding</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Step {wizardStep} of 3 &mdash;{' '}
                {wizardStep === 1
                  ? 'Select Job Title'
                  : wizardStep === 2
                    ? 'Person Details'
                    : 'Review'}
              </p>
            </div>
            <button
              onClick={() => !submitting && setShowOnboardModal(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex-1 flex items-center gap-2">
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      step <= wizardStep ? 'bg-brand-500' : 'bg-slate-700'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {submitSuccess ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-3 bg-brand-500/20 rounded-full mb-4">
                  <CheckCircleIcon className="h-10 w-10 text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1">
                  Onboarding Started
                </h3>
                <p className="text-sm text-slate-400">
                  {personForm.first_name} {personForm.last_name}&apos;s onboarding has been initiated.
                </p>
              </div>
            ) : (
              <>
                {wizardStep === 1 && renderWizardStep1()}
                {wizardStep === 2 && renderWizardStep2()}
                {wizardStep === 3 && renderWizardStep3()}
              </>
            )}
          </div>

          {/* Footer */}
          {!submitSuccess && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
              <div>
                {wizardStep > 1 && (
                  <button
                    onClick={() => setWizardStep(wizardStep - 1)}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Back
                  </button>
                )}
              </div>

              <div>
                {wizardStep < 3 ? (
                  <button
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={
                      (wizardStep === 1 && !selectedJobTitle) ||
                      (wizardStep === 2 && !isStep2Valid)
                    }
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitOnboarding}
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Start Onboarding
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------- Main render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <ClipboardIcon className="h-7 w-7" />
            Operations Board
          </h1>
          <p className="text-slate-400 mt-1">
            Manage onboarding and offboarding across your organization
          </p>
        </div>
        <button
          onClick={openOnboardModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors font-medium text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          New Onboarding
        </button>
      </div>

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchBoard}
            className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        renderMatrixView()
      )}

      {/* Infrastructure Documentation */}
      <div className="border-t border-slate-800 pt-6 mt-2">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Infrastructure</h2>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/portal/operations/networks"
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">Networks</h3>
            </div>
            <p className="text-sm text-slate-500">Document networks, subnets, VLANs, and DHCP</p>
          </Link>

          <Link href="/portal/operations/domains"
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors">Domains</h3>
            </div>
            <p className="text-sm text-slate-500">Track domain registrations, DNS records, and expiry</p>
          </Link>

          <Link href="/portal/operations/certificates"
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-brand-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand-500/20 rounded-lg">
                <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors">Certificates</h3>
            </div>
            <p className="text-sm text-slate-500">Monitor SSL certificates, expiry dates, and renewals</p>
          </Link>
        </div>
      </div>

      {/* Onboarding Modal */}
      {renderModal()}
    </div>
  )
}
