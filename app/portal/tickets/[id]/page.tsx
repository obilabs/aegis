'use client'

import { SafeHtml } from '@/components/SafeHtml'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import dynamic from 'next/dynamic'
import { useFeature } from '@/lib/hooks/useFeatures'
import { LinkItems } from '@/components/LinkItems'
import {
  TicketIcon,
  UserIcon,
  BuildingOfficeIcon,
  ServerStackIcon,
  DocumentTextIcon,
  PencilIcon,
  PaperAirplaneIcon,
  ArrowLeftIcon,
  ClockIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  SparklesIcon,
  ChevronDownIcon,
  ListBulletIcon,
  PlusIcon,
  TrashIcon,
  ShieldExclamationIcon,
  BoltIcon,
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// Dynamically import the rich text editor to avoid SSR issues
const RichTextEditor = dynamic(
  () => import('@/components/editor/RichTextEditor').then(mod => mod.RichTextEditor),
  { ssr: false, loading: () => <div className="h-48 bg-slate-800 rounded-lg animate-pulse" /> }
)

interface Ticket {
  id: string
  ticket_number: number
  prefix: string
  subject: string
  description: string
  status: string
  status_color: string
  status_base: string | null
  priority: string
  category: string
  source: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  root_cause: string | null
  resolution_steps: string | null
  resolution_category: string | null
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    is_deleted: boolean
  } | null
  assigned_to: {
    id: string
    name: string
    email: string
  } | null
  created_by: {
    id: string
    name: string
    email: string
  } | null
  company: {
    id: string
    name: string
  } | null
  asset: {
    id: string
    name: string
    asset_tag: string
  } | null
  location: {
    id: string
    name: string
  } | null
  type_name: string | null
  custom_fields: Record<string, unknown>
}

interface TicketReply {
  id: string
  content: string
  is_internal: boolean
  created_at: string
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  user: {
    id: string
    name: string
    email: string
    department?: string | null
    job_title?: string | null
    company?: string | null
  } | null
  // Present only when the reply was written by a paired MSP. Such a reply has
  // NEITHER `user` NOR `contact` — the author is external to this organization.
  msp?: {
    firm: string | null
    technician_email: string | null
  } | null
  author_type?: 'msp' | 'staff' | 'contact'
}

interface RecentTicket {
  id: string
  ticket_number: number
  prefix: string
  subject: string
  status: string
  status_color: string
  priority: string
  created_at: string
}

interface LinkedAsset {
  id: string
  name: string
  asset_tag: string
  type_name: string
  status: string
}

interface SimilarTicket {
  id: string
  ticket_number: number
  prefix: string
  subject: string
  status: string
  status_color: string
  status_base: string | null
  priority: string
  created_at: string
  root_cause: string | null
  resolution_steps: string | null
  resolution_category: string | null
}

interface SuggestedArticle {
  id: string
  title: string
  slug: string
  summary: string
  category_slug: string
  helpful_ratio: number | null
}

interface TicketTask {
  id: string
  title: string
  is_completed: boolean
  is_required: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
  created_by_name: string | null
  completed_by_name: string | null
  assigned_to: string | null
  service_category: string | null
}

interface ChecklistTemplate {
  id: string
  name: string
  item_count: number
  category_name: string | null
}

interface QueueScore {
  actionState: string
  confidence: number
  baseScore: number
  reasoning: string
  scoredAt: string
  scoredBy: string
  factors: {
    priorityWeight: number
    slaUrgency: number
    actionBoost: number
    waitTimeFactor: number
    customerImpact: number
  }
}

interface SlaInfo {
  isPaused: boolean
  pausedAt: string | null
  totalPausedSeconds: number
  activeSeconds: number
  breached: boolean
  response: {
    targetMinutes: number | null
    dueAt: string | null
    fulfilledAt: string | null
    remainingSeconds: number | null
  }
  resolution: {
    targetMinutes: number | null
    dueAt: string | null
    fulfilledAt: string | null
    remainingSeconds: number | null
  }
}

interface SlaEvent {
  id: string
  fromStatus: string | null
  toStatus: string
  changedBy: string | null
  reason: string | null
  pausedSecondsAtChange: number
  wasPaused: boolean
  createdAt: string
}

const ACTION_STATE_LABELS: Record<string, string> = {
  new_unreviewed: 'New / Unreviewed',
  needs_agent_action: 'Needs Action',
  needs_more_info: 'Needs More Info',
  escalation_needed: 'Escalation Needed',
  waiting_on_user: 'Waiting on User',
  user_will_follow_up: 'User Will Follow Up',
  waiting_on_vendor: 'Waiting on Vendor',
  waiting_on_internal: 'Waiting on Internal',
  waiting_on_approval: 'Waiting on Approval',
  waiting_on_parts: 'Waiting on Parts',
  scheduled: 'Scheduled',
  on_hold: 'On Hold',
  resolution_candidate: 'Resolution Candidate',
}

// Semantic tone per priority / action state.
//
// These REPLACE the colour class strings below for anything rendered through
// <Badge>. Passing those class strings via Badge's `className` would put
// `bg-*`/`border-*` at the same specificity as the primitive's own TONES, and
// the winner would be decided by stylesheet order rather than intent — the
// exact failure that made an MSP reply's accent silently render slate.
const PRIORITY_TONE: Record<string, 'red' | 'amber' | 'blue' | 'slate'> = {
  critical: 'red',
  high: 'amber',
  medium: 'blue',
  low: 'slate',
}

const ACTION_STATE_TONE: Record<string, 'red' | 'amber' | 'blue' | 'slate' | 'purple'> = {
  needs_agent_action: 'red',
  escalation_needed: 'red',
  needs_more_info: 'amber',
  new_unreviewed: 'blue',
  waiting_on_user: 'amber',
  user_will_follow_up: 'slate',
  waiting_on_vendor: 'slate',
  waiting_on_internal: 'purple',
  waiting_on_approval: 'amber',
  waiting_on_parts: 'slate',
}

const ACTION_STATE_COLORS: Record<string, string> = {
  needs_agent_action: 'bg-red-500/20 text-red-400 border-red-500/30',
  escalation_needed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  needs_more_info: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  new_unreviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting_on_user: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  user_will_follow_up: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  waiting_on_vendor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  waiting_on_internal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  waiting_on_approval: 'bg-yellow-600/20 text-yellow-500 border-yellow-600/30',
  waiting_on_parts: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  scheduled: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
  on_hold: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
  resolution_candidate: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
}

function getStatusColor(status: string, color?: string) {
  if (color) {
    return { backgroundColor: `${color}20`, color: color, borderColor: `${color}50` }
  }
  switch (status?.toLowerCase()) {
    case 'new':
    case 'open':
      return { backgroundColor: '#3b82f620', color: '#3b82f6', borderColor: '#3b82f650' }
    case 'in progress':
      return { backgroundColor: '#8b5cf620', color: '#8b5cf6', borderColor: '#8b5cf650' }
    case 'waiting on customer':
    case 'waiting on vendor':
      return { backgroundColor: '#f59e0b20', color: '#f59e0b', borderColor: '#f59e0b50' }
    case 'resolved':
      return { backgroundColor: '#10b98120', color: '#10b981', borderColor: '#10b98150' }
    case 'closed':
      return { backgroundColor: '#6b728020', color: '#6b7280', borderColor: '#6b728050' }
    default:
      return { backgroundColor: '#6b728020', color: '#6b7280', borderColor: '#6b728050' }
  }
}

function getPriorityColor(priority: string) {
  switch (priority?.toLowerCase()) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'low':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Compact timestamp for a reply header.
 *
 * `formatDate` renders "Aug 17, 2026, 1:55 AM" — 21 characters competing with an
 * author, a firm badge and an Internal Note badge on one line. At phone width it
 * was what pushed the row onto a second line and squeezed the firm name into
 * "Northwind e2e fina…".
 *
 * The year is dropped, and only for the CURRENT year: an older ticket still shows
 * it, because "Aug 17" on a two-year-old reply is actively misleading. The full
 * value stays available via `title`.
 */
function formatReplyTime(dateString: string) {
  const d = new Date(dateString)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  if (seconds < 0) return 'overdue'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return `${d}d ${rh}h`
  }
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface TicketAttachment {
  id: string
  file_name: string
  file_type: string | null
  file_size: number | string | null
  created_at: string
  uploaded_by_name: string | null
}

function formatFileSize(bytes: number | string | null) {
  const n = Number(bytes || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isEnabled: aiEditorEnabled } = useFeature('ai_editor')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<TicketReply[]>([])
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([])
  const [similarTickets, setSimilarTickets] = useState<SimilarTicket[]>([])
  const [suggestedArticles, setSuggestedArticles] = useState<SuggestedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [replyType, setReplyType] = useState<'reply' | 'internal_note'>('reply')
  const [submitting, setSubmitting] = useState(false)
  // Ticket attachments (stored in object storage, listed from ticket_attachments)
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [statuses, setStatuses] = useState<{id: string, name: string, color: string, base_status?: string}[]>([])
  // Resolution modal state
  const [showResolutionModal, setShowResolutionModal] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{id: string, name: string} | null>(null)
  const [resolutionData, setResolutionData] = useState({
    root_cause: '',
    resolution_steps: '',
    resolution_category: '',
  })
  // Ticket tasks state
  const [tasks, setTasks] = useState<TicketTask[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([])
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  // Close-ticket incomplete tasks warning
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false)
  const [incompleteReason, setIncompleteReason] = useState('')
  // Queue & SLA context
  const [queueScore, setQueueScore] = useState<QueueScore | null>(null)
  const [slaInfo, setSlaInfo] = useState<SlaInfo | null>(null)
  const [slaHistory, setSlaHistory] = useState<SlaEvent[]>([])
  const [showSlaTimeline, setShowSlaTimeline] = useState(false)
  const [showAiReasoning, setShowAiReasoning] = useState(false)
  const [nextTicketId, setNextTicketId] = useState<string | null>(null)
  // Linked entities (tickets, KB, documents — from new junction tables)
  const [linkedTickets, setLinkedTickets] = useState<Array<{id: string, ticket_number: number, prefix: string, subject: string, priority: string, status: string, status_color: string, type_name: string, relation_type: string, direction: string}>>([])
  const [linkedKbArticles, setLinkedKbArticles] = useState<Array<{id: string, title: string, slug: string, category_name: string, link_type: string}>>([])
  const [linkedDocuments, setLinkedDocuments] = useState<Array<{id: string, title: string, document_type: string, status: string, link_type: string}>>([])
  // History / audit trail
  const [historyEvents, setHistoryEvents] = useState<Array<{id: string, event_type: string, field_name: string, old_value: string | null, new_value: string | null, old_display?: string, new_display?: string, change_source: string, actor_name: string, created_at: string, is_internal?: boolean}>>([])
  const [showHistory, setShowHistory] = useState(false)
  // Edit ticket modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({ subject: '', priority: '', category_id: '', assigned_to: '' })
  const [editCategories, setEditCategories] = useState<{id: string, name: string, parent_id?: string | null}[]>([])
  const [editUsers, setEditUsers] = useState<{id: string, name: string}[]>([])
  const [editSaving, setEditSaving] = useState(false)
  // Shown when a status change or edit is refused, instead of pretending it worked.
  const [actionError, setActionError] = useState('')
  const readError = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => ({}))
    return (data && typeof data.error === 'string' && data.error) || `${fallback} (${res.status})`
  }

  useEffect(() => {
    fetchTicketData()
    fetchAttachments()
    fetchTasks()
    fetchTemplates()
    fetchQueueContext()
    // Record view (fire-and-forget) — triggers New → Open auto-transition
    fetch(`/api/portal/tickets/${params.id}/view`, { method: 'POST' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        // If status transitioned, refresh ticket data to pick up new status
        if (data?.transitioned) {
          fetchTicketData()
        }
      })
      .catch(() => { /* non-critical */ })
  }, [params.id])

  const fetchQueueContext = async () => {
    // Fetch queue score, SLA data, and next ticket in parallel (all non-critical)
    const [scoreRes, slaRes, nextRes] = await Promise.allSettled([
      fetch(`/api/portal/tickets/${params.id}/triage`),
      fetch(`/api/portal/tickets/${params.id}/sla`),
      fetch(`/api/portal/queue?limit=1&exclude=${params.id}`),
    ])

    if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
      const data = await scoreRes.value.json()
      setQueueScore(data.score || null)
    }
    if (slaRes.status === 'fulfilled' && slaRes.value.ok) {
      const data = await slaRes.value.json()
      setSlaInfo(data.sla || null)
      setSlaHistory(data.history || [])
    }
    if (nextRes.status === 'fulfilled' && nextRes.value.ok) {
      const data = await nextRes.value.json()
      // Find highest-scored ticket from any section
      const allTickets = [
        ...(data.mine || []),
        ...(data.team || []),
        ...(data.unassigned || []),
      ]
      if (allTickets.length > 0) {
        setNextTicketId(allTickets[0].id)
      }
    }
  }

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/api/portal/tickets/${params.id}/attachments`)
      if (res.ok) {
        const data = await res.json()
        setAttachments(data.attachments || [])
      }
    } catch { /* list stays as-is */ }
  }

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError('')
    const failed: string[] = []
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch(`/api/portal/tickets/${params.id}/attachments`, { method: 'POST', body: form })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          failed.push(`${file.name}: ${data.error || `upload failed (${res.status})`}`)
        }
      } catch {
        failed.push(`${file.name}: upload failed`)
      }
    }
    if (failed.length) setUploadError(failed.join('; '))
    await fetchAttachments()
    setUploading(false)
  }

  const fetchTicketData = async () => {
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}`)
      if (!response.ok) {
        throw new Error('Ticket not found')
      }
      const data = await response.json()
      setTicket(data.ticket)
      setReplies(data.replies || [])
      setRecentTickets(data.recentTickets || [])
      setLinkedAssets(data.linkedAssets || [])
      setLinkedTickets(data.linkedTickets || [])
      setLinkedKbArticles(data.linkedKbArticles || [])
      setLinkedDocuments(data.linkedDocuments || [])
      setSimilarTickets(data.similarTickets || [])
      setSuggestedArticles(data.suggestedArticles || [])
      setStatuses(data.statuses || [])
    } catch (error) {
      console.error('Error fetching ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return
    
    setSubmitting(true)
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          is_internal: replyType === 'internal_note',
        }),
      })
      
      if (response.ok) {
        const newReply = await response.json()
        setReplies([...replies, newReply])
        setReplyContent('')
      }
    } catch (error) {
      console.error('Error submitting reply:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (statusId: string, statusName: string, baseStatus?: string) => {
    setShowStatusMenu(false)
    if (!ticket) return

    // If changing to a closed base_status, show resolution modal
    const isResolution = baseStatus === 'closed'
    if (isResolution) {
      setPendingStatusChange({ id: statusId, name: statusName })
      setResolutionData({ root_cause: '', resolution_steps: '', resolution_category: '' })
      setShowResolutionModal(true)
      return
    }

    try {
      setActionError('')
      const res = await fetch(`/api/portal/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: statusId }),
      })
      if (!res.ok) {
        setActionError(await readError(res, 'Could not change the status'))
        return
      }
      setTicket({ ...ticket, status: statusName })
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleResolutionSubmit = async (skip: boolean) => {
    if (!ticket || !pendingStatusChange) return

    // Check for incomplete required tasks before closing
    const incompleteTasks = getIncompleteRequiredTasks()
    if (incompleteTasks.length > 0) {
      setShowResolutionModal(false)
      setShowIncompleteWarning(true)
      return
    }

    await performResolutionSubmit(skip)
  }

  const performResolutionSubmit = async (skip: boolean) => {
    if (!ticket || !pendingStatusChange) return

    try {
      const body: Record<string, string> = { status_id: pendingStatusChange.id }
      if (!skip) {
        if (resolutionData.root_cause) body.root_cause = resolutionData.root_cause
        if (resolutionData.resolution_steps) body.resolution_steps = resolutionData.resolution_steps
        if (resolutionData.resolution_category) body.resolution_category = resolutionData.resolution_category
      }

      setActionError('')
      const res = await fetch(`/api/portal/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setActionError(await readError(res, 'Could not resolve the ticket'))
        return
      }

      setTicket({
        ...ticket,
        status: pendingStatusChange.name,
        root_cause: skip ? ticket.root_cause : (resolutionData.root_cause || ticket.root_cause),
        resolution_steps: skip ? ticket.resolution_steps : (resolutionData.resolution_steps || ticket.resolution_steps),
        resolution_category: skip ? ticket.resolution_category : (resolutionData.resolution_category || ticket.resolution_category),
      })
    } catch (error) {
      console.error('Error updating ticket resolution:', error)
    } finally {
      setShowResolutionModal(false)
      setPendingStatusChange(null)
    }
  }

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}/tasks`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim() }),
      })
      if (response.ok) {
        const task = await response.json()
        setTasks([...tasks, task])
        setNewTaskTitle('')
      }
    } catch (error) {
      console.error('Error adding task:', error)
    } finally {
      setAddingTask(false)
    }
  }

  const handleToggleTask = async (taskId: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !isCompleted }),
      })
      if (response.ok) {
        const updated = await response.json()
        setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updated } : t))
      }
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}/tasks/${taskId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== taskId))
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/portal/settings/checklist-templates?active=true')
      if (response.ok) {
        const data = await response.json()
        setChecklistTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const handleApplyTemplate = async (templateId: string) => {
    setShowTemplateMenu(false)
    try {
      const response = await fetch(`/api/portal/tickets/${params.id}/tasks/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      })
      if (response.ok) {
        fetchTasks() // Reload all tasks
      }
    } catch (error) {
      console.error('Error applying template:', error)
    }
  }

  // Check for incomplete required tasks before closing
  const getIncompleteRequiredTasks = () => {
    return tasks.filter(t => t.is_required && !t.is_completed)
  }

  const handleForceClose = async () => {
    if (!pendingStatusChange) return
    // Add the incomplete reason as an internal note, then proceed
    if (incompleteReason.trim()) {
      try {
        await fetch(`/api/portal/tickets/${params.id}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `[Closed with incomplete required tasks] ${incompleteReason}`,
            is_internal: true,
          }),
        })
      } catch {
        // Non-critical — proceed with close anyway
      }
    }
    setShowIncompleteWarning(false)
    setIncompleteReason('')
    await performResolutionSubmit(false)
  }

  const openEditModal = async () => {
    if (!ticket) return
    setEditData({
      subject: ticket.subject,
      priority: ticket.priority,
      category_id: '',
      assigned_to: ticket.assigned_to?.id || '',
    })
    setShowEditModal(true)
    // Fetch categories and users for dropdowns
    try {
      const [catRes, usersRes] = await Promise.all([
        fetch('/api/portal/categories'),
        fetch('/api/portal/users?assignable=true'),
      ])
      if (catRes.ok) {
        const catData = await catRes.json()
        const cats = catData.categories || catData || []
        setEditCategories(Array.isArray(cats) ? cats : [])
        // Pre-select current category
        if (ticket.category) {
          const match = (Array.isArray(cats) ? cats : []).find((c: {name: string}) => c.name === ticket.category)
          if (match) setEditData(prev => ({ ...prev, category_id: match.id }))
        }
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        const users = usersData.users || usersData || []
        setEditUsers(Array.isArray(users) ? users.map((u: { id: string, first_name?: string, last_name?: string, name?: string }) => ({
          id: u.id,
          name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        })) : [])
      }
    } catch {
      // Non-critical — user can still edit subject/priority
    }
  }

  const handleEditSubmit = async () => {
    if (!ticket) return
    setEditSaving(true)
    try {
      const body: Record<string, string> = {}
      if (editData.subject !== ticket.subject) body.subject = editData.subject
      if (editData.priority !== ticket.priority) body.priority = editData.priority
      if (editData.category_id) body.category_id = editData.category_id
      if (editData.assigned_to !== (ticket.assigned_to?.id || '')) {
        body.assigned_to = editData.assigned_to || ''
      }

      if (Object.keys(body).length === 0) {
        setShowEditModal(false)
        return
      }

      const res = await fetch(`/api/portal/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setActionError('')
        setShowEditModal(false)
        fetchTicketData() // Refresh to pick up changes
      } else {
        setActionError(await readError(res, 'Could not save the changes'))
        setShowEditModal(false)
      }
    } catch (error) {
      console.error('Error updating ticket:', error)
    } finally {
      setEditSaving(false)
    }
  }

  const handleClaimTicket = async () => {
    if (!ticket) return
    try {
      const res = await fetch(`/api/portal/tickets/${params.id}/claim`, { method: 'POST' })
      if (res.ok) {
        fetchTicketData()
      }
    } catch (error) {
      console.error('Error claiming ticket:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-300">Ticket not found</h2>
        <Link href="/portal/tickets" className="text-brand-400 hover:text-brand-300 mt-2 inline-block">
          ← Back to Tickets
        </Link>
      </div>
    )
  }

  const ticketNumber = `${ticket.prefix || 'TKT'}-${String(ticket.ticket_number).padStart(4, '0')}`
  const contactName = ticket.contact
    ? `${ticket.contact.first_name} ${ticket.contact.last_name}${ticket.contact.is_deleted ? ' (Deleted)' : ''}`
    : null
  const creatorName = ticket.created_by?.name || null
  const openedByName = contactName || creatorName || 'Unknown'
  const statusStyle = getStatusColor(ticket.status, ticket.status_color)

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400" role="alert" data-testid="ticket-action-error">
          {actionError}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal/tickets" className="hover:text-brand-400 flex items-center gap-1">
          <ArrowLeftIcon className="h-4 w-4" />
          Tickets
        </Link>
        <span>/</span>
        <span className="text-slate-200">{ticketNumber}</span>
      </div>

      {/* Header
          Stacks on narrow viewports. Previously `flex items-start justify-between`
          with two nowrap rows: at 375px the badge row's right edge landed at 408px
          and the ACTION row's at 776px — 400px past the viewport — and because the
          page does not scroll horizontally, "Change Status" and "Edit" were not
          merely misaligned, they were unreachable on a phone. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {/* flex-wrap, so badges reflow instead of overflowing. Every pill is the
              <Badge> primitive: previously this row mixed rounded-full/rounded,
              text-xs/text-sm and py-0.5/py-1 — three shapes in one row. */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone="slate" className="font-mono">{ticketNumber}</Badge>
            {/* Runtime colour: ticket_statuses.color is admin-configurable, so no
                Tailwind class can express it. This is what Badge's `style` escape
                hatch is for. */}
            <Badge style={statusStyle}>{ticket.status}</Badge>
            <Badge tone={PRIORITY_TONE[ticket.priority?.toLowerCase()] ?? 'slate'}>
              {ticket.priority}
            </Badge>
            {queueScore && (
              <Badge tone={ACTION_STATE_TONE[queueScore.actionState] ?? 'slate'}>
                {ACTION_STATE_LABELS[queueScore.actionState] || queueScore.actionState}
              </Badge>
            )}
            {slaInfo?.isPaused && <Badge tone="amber">SLA PAUSED</Badge>}
            {slaInfo?.breached && <Badge tone="red">SLA BREACHED</Badge>}
            {ticket.source && <Badge tone="slate">via {ticket.source}</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{ticket.subject}</h1>
          <p className="text-slate-400 mt-1">
            Opened by {openedByName} • {formatDate(ticket.created_at)}
          </p>
        </div>
        {/* Actions. flex-wrap + shrink-0 so they reflow onto a second line rather
            than being pushed off-screen; on mobile this row now sits UNDER the
            title instead of fighting it for width.

            Every control is <Button size="md"> so they share one height and font.
            Previously "Next Ticket" was text-sm while Claim / Change Status / Edit
            inherited 16px, which is why they never lined up. */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Next Ticket — a Link, so Button renders as its child to keep
              navigation semantics while inheriting the button's shape. */}
          {nextTicketId && (
            <Link href={`/portal/tickets/${nextTicketId}`}>
              <Button variant="secondary" size="md" rightIcon={<span aria-hidden>→</span>}>
                Next Ticket
              </Button>
            </Link>
          )}
          {/* Claim Button — only when unassigned */}
          {!ticket.assigned_to && (
            <Button
              onClick={handleClaimTicket}
              variant="primary"
              size="md"
              leftIcon={<UserIcon className="h-4 w-4" />}
            >
              Claim
            </Button>
          )}
          {/* Status Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              variant="secondary"
              size="md"
              className="relative z-30"
              rightIcon={<ChevronDownIcon className="h-4 w-4" />}
            >
              Change Status
            </Button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30">
                  <div className="p-1">
                    {statuses.map((status) => (
                      <button
                        key={status.id}
                        onClick={() => handleStatusChange(status.id, status.name, status.base_status)}
                        className={`w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2 ${
                          ticket.status === status.name
                            ? 'bg-brand-500/20 text-brand-400'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={openEditModal}
            variant="secondary"
            size="md"
            leftIcon={<PencilIcon className="h-4 w-4" />}
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original Description */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Description</h2>
            </div>
            <SafeHtml
              className="p-4 prose prose-invert prose-sm max-w-none text-slate-300"
              html={ticket.description}
              fallback="No description provided."
            />
          </div>

          {/* Change Request Details (for Change tickets) */}
          {ticket.type_name === 'Change' && ticket.custom_fields && (
            (() => {
              const cf = ticket.custom_fields as Record<string, unknown>
              const changeType = cf.change_type as string | undefined
              const changeAreas = cf.change_areas as string[] | undefined
              const riskLevel = cf.risk_level as string | undefined
              const implementationPlan = cf.implementation_plan as string | undefined
              const rollbackPlan = cf.rollback_plan as string | undefined
              const scheduledStart = cf.scheduled_start as string | undefined
              const scheduledEnd = cf.scheduled_end as string | undefined
              const hasContent = changeType || (changeAreas && changeAreas.length > 0) || riskLevel || implementationPlan || rollbackPlan || scheduledStart || scheduledEnd

              if (!hasContent) return null

              const changeTypeBadge = (type: string) => {
                switch (type?.toLowerCase()) {
                  case 'emergency':
                    return 'bg-red-500/20 text-red-400 border-red-500/30'
                  case 'normal':
                    return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  case 'standard':
                    return 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                  default:
                    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                }
              }

              const riskBadge = (risk: string) => {
                switch (risk?.toLowerCase()) {
                  case 'high':
                    return 'bg-red-500/20 text-red-400 border-red-500/30'
                  case 'medium':
                    return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  case 'low':
                    return 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                  default:
                    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                }
              }

              return (
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                      <WrenchScrewdriverIcon className="h-5 w-5 text-amber-400" />
                      Change Request Details
                    </h2>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Change Type and Risk Level */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {changeType && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Change Type</label>
                          <span className={`inline-flex px-2.5 py-1 text-sm font-medium rounded-full border ${changeTypeBadge(changeType)}`}>
                            {changeType}
                          </span>
                        </div>
                      )}
                      {riskLevel && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Risk Level</label>
                          <span className={`inline-flex px-2.5 py-1 text-sm font-medium rounded-full border ${riskBadge(riskLevel)}`}>
                            {riskLevel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Change Areas */}
                    {changeAreas && changeAreas.length > 0 && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Change Areas</label>
                        <div className="flex flex-wrap gap-1.5">
                          {changeAreas.map((area, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-purple-500/15 text-purple-300 rounded-full border border-purple-500/25">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Schedule */}
                    {(scheduledStart || scheduledEnd) && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">
                          <CalendarDaysIcon className="h-3.5 w-3.5 inline mr-1" />
                          Schedule
                        </label>
                        <div className="flex items-center gap-4 text-sm">
                          {scheduledStart && (
                            <div>
                              <span className="text-slate-500 mr-1">Start:</span>
                              <span className="text-slate-200">{formatDate(scheduledStart)}</span>
                            </div>
                          )}
                          {scheduledEnd && (
                            <div>
                              <span className="text-slate-500 mr-1">End:</span>
                              <span className="text-slate-200">{formatDate(scheduledEnd)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Implementation Plan */}
                    {implementationPlan && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Implementation Plan</label>
                        <div className="bg-slate-900/50 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap border border-slate-700/50">
                          {implementationPlan}
                        </div>
                      </div>
                    )}

                    {/* Rollback Plan */}
                    {rollbackPlan && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                          <ArrowPathIcon className="h-3.5 w-3.5 inline mr-1" />
                          Rollback Plan
                        </label>
                        <div className="bg-slate-900/50 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap border border-slate-700/50">
                          {rollbackPlan}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()
          )}

          {/* Related Incidents (for Problem tickets) */}
          {ticket.type_name === 'Problem' && (() => {
            const relatedIncidents = linkedTickets.filter(
              lt => lt.type_name === 'Incident' && (lt.relation_type === 'caused_by' || lt.relation_type === 'related')
            )
            if (relatedIncidents.length === 0) return null
            return (
              <div className="bg-slate-800 rounded-lg border border-slate-700">
                <div className="p-4 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <BoltIcon className="h-5 w-5 text-red-400" />
                    Related Incidents
                    <span className="text-sm font-normal text-slate-400">({relatedIncidents.length})</span>
                  </h2>
                </div>
                <div className="p-4 grid gap-3 sm:grid-cols-2">
                  {relatedIncidents.map((inc) => {
                    const incNumber = `${inc.prefix || 'INC'}-${String(inc.ticket_number).padStart(4, '0')}`
                    const incStatusStyle = getStatusColor(inc.status, inc.status_color)
                    return (
                      <Link
                        key={inc.id}
                        href={`/portal/tickets/${inc.id}`}
                        className="block p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600 hover:bg-slate-900 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-slate-400">{incNumber}</span>
                          <span
                            className="px-1.5 py-0.5 text-xs rounded-full border"
                            style={incStatusStyle}
                          >
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 truncate">{inc.subject}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`px-1.5 py-0.5 text-xs rounded border ${getPriorityColor(inc.priority)}`}>
                            {inc.priority}
                          </span>
                          <span className="text-xs text-slate-600">{inc.relation_type.replace(/_/g, ' ')}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Related Problem (for Incident tickets) */}
          {ticket.type_name === 'Incident' && (() => {
            const relatedProblem = linkedTickets.find(
              lt => lt.type_name === 'Problem' && (lt.relation_type === 'caused_by' || lt.relation_type === 'related')
            )
            if (!relatedProblem) return null
            const prbNumber = `${relatedProblem.prefix || 'PRB'}-${String(relatedProblem.ticket_number).padStart(4, '0')}`
            const prbStatusStyle = getStatusColor(relatedProblem.status, relatedProblem.status_color)
            return (
              <div className="bg-purple-500/5 rounded-lg border border-purple-500/20">
                <div className="p-4 border-b border-purple-500/20">
                  <h2 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                    <ShieldExclamationIcon className="h-5 w-5" />
                    Related Problem
                  </h2>
                </div>
                <div className="p-4">
                  <Link
                    href={`/portal/tickets/${relatedProblem.id}`}
                    className="flex items-center gap-3 hover:bg-purple-500/5 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">{prbNumber}</span>
                        <span
                          className="px-1.5 py-0.5 text-xs rounded-full border"
                          style={prbStatusStyle}
                        >
                          {relatedProblem.status}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded border ${getPriorityColor(relatedProblem.priority)}`}>
                          {relatedProblem.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">{relatedProblem.subject}</p>
                    </div>
                    <span className="text-brand-400 text-sm flex-shrink-0">View →</span>
                  </Link>
                </div>
              </div>
            )
          })()}

          {/* Ticket Tasks (Checklist) */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <ListBulletIcon className="h-5 w-5" />
                Tasks
                {tasks.length > 0 && (
                  <span className="text-sm font-normal text-slate-400">
                    ({tasks.filter(t => t.is_completed).length}/{tasks.length})
                  </span>
                )}
              </h2>
              {checklistTemplates.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-brand-400 hover:text-brand-300 bg-brand-500/10 rounded-lg hover:bg-brand-500/20 transition-colors"
                  >
                    <ListBulletIcon className="h-4 w-4" />
                    Load Template
                    <ChevronDownIcon className="h-3 w-3" />
                  </button>
                  {showTemplateMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowTemplateMenu(false)} />
                      <div className="absolute right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
                        <div className="p-1">
                          {checklistTemplates.map((tmpl) => (
                            <button
                              key={tmpl.id}
                              onClick={() => handleApplyTemplate(tmpl.id)}
                              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors"
                            >
                              <span className="block">{tmpl.name}</span>
                              <span className="text-xs text-slate-500">{tmpl.item_count} items{tmpl.category_name ? ` · ${tmpl.category_name}` : ''}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="px-4 pt-3">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: `${(tasks.filter(t => t.is_completed).length / tasks.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="p-4 space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 group"
                >
                  <button
                    onClick={() => handleToggleTask(task.id, task.is_completed)}
                    className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                      task.is_completed
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'border-slate-600 hover:border-brand-500'
                    }`}
                  >
                    {task.is_completed && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${task.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {task.title}
                      </span>
                      {task.is_required && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded border border-red-500/30">
                          Required
                        </span>
                      )}
                    </div>
                    {task.service_category && (
                      <span className="text-[11px] text-slate-500">{task.service_category}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {/* Add task inline */}
              <div className="flex items-center gap-3 pt-1">
                <PlusIcon className="h-5 w-5 text-slate-600 flex-shrink-0" />
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !addingTask) handleAddTask()
                  }}
                  placeholder="Add a task..."
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
                  disabled={addingTask}
                />
              </div>
            </div>
          </div>

          {/* Resolution Notes (shown when ticket has resolution data) */}
          {(ticket.root_cause || ticket.resolution_steps) && (
            <div className="bg-brand-500/5 rounded-lg border border-brand-500/20">
              <div className="p-4 border-b border-brand-500/20 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-brand-400 flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5" />
                  Resolution Notes
                </h2>
                {ticket.resolution_category && (
                  <span className="px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded-full border border-brand-500/30">
                    {ticket.resolution_category.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                {ticket.root_cause && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider">What was the problem?</label>
                    <p className="mt-1 text-slate-300 whitespace-pre-wrap">{ticket.root_cause}</p>
                  </div>
                )}
                {ticket.resolution_steps && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider">How was it fixed?</label>
                    <p className="mt-1 text-slate-300 whitespace-pre-wrap">{ticket.resolution_steps}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conversation */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
                Conversation ({replies.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-700">
              {replies.length === 0 ? (
                <p className="p-4 text-slate-500 text-center">No replies yet</p>
              ) : (
                replies.map((reply) => {
                  // An MSP reply used to fall through every branch to 'Unknown',
                  // because a paired firm's technician has no local user or
                  // contact row. The seeded KB article promises the customer can
                  // see who acted, so show the technician and name the firm.
                  const isMsp = !!reply.msp
                  const replyAuthor = isMsp
                    ? (reply.msp?.technician_email || reply.msp?.firm || 'MSP')
                    : reply.user
                      ? reply.user.name
                      : reply.contact
                        ? `${reply.contact.first_name} ${reply.contact.last_name}`
                        : 'Unknown'
                  const isStaff = !!reply.user
                  
                  return (
                    <div 
                      key={reply.id} 
                      className={`p-4 ${
                        // Backgrounds are mutually exclusive on purpose. An
                        // internal MSP note matches BOTH conditions, and two
                        // competing bg-* classes resolve by stylesheet order,
                        // not by the order written here — so the winner was
                        // arbitrary. Internal keeps its established yellow tint;
                        // the MSP signal is carried by the accent below.
                        reply.is_internal ? 'bg-yellow-500/5' : isMsp ? 'bg-violet-500/5' : ''
                      } ${
                        // An inset shadow, NOT border-l-*: the parent's
                        // `divide-slate-700` sets border-color on every child at
                        // the same specificity, and it won — so an internal MSP
                        // note rendered a slate edge and lost the distinction
                        // entirely. Verified in the browser; computed style was
                        // `2px rgb(51,65,85)` where violet was intended.
                        isMsp ? 'shadow-[inset_3px_0_0_0_#a78bfa]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* The avatar showed a bare initial and revealed nothing on
                            hover — the one element in this row carrying no
                            information at all. It now holds the full identity,
                            which is also where a truncated firm name stays
                            readable. shrink-0 so it never squashes. */}
                        <div
                          title={
                            isMsp
                              ? `${replyAuthor}${reply.msp?.firm ? ` — ${reply.msp.firm}` : ''} (external service provider)`
                              : replyAuthor
                          }
                          className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-medium ${
                            isMsp
                              ? 'bg-violet-500/20 text-violet-300'
                              : isStaff
                                ? 'bg-brand-500/20 text-brand-400'
                                : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {replyAuthor.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          {/* Two rows on a narrow screen, one on a wide one.
                              Four items (author, firm, Internal Note, date) shared a single
                              nowrap line: at phone width the firm badge truncated to
                              "Northwind e2e fina…" and the date spilled onto a second line
                              by accident.
                          
                              Splitting deliberately beats hiding. Initials-plus-hover was
                              considered and REJECTED: there is no hover on a phone, so
                              anything behind `title` vanishes for exactly the users on the
                              screen where we were hiding it — and a firm's initials are
                              opaque to a customer who never sees the name spelled out. */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                            <span className="font-medium text-slate-200 break-all sm:break-normal">
                              {replyAuthor}
                            </span>
                            {isMsp && (
                              // BOTH halves, deliberately: the firm is who is
                              // accountable to you, the technician is who acted.
                              // Showing only one breaks the promise the KB makes.
                              //
                              // Truncated rather than wrapped: as a raw span this
                              // rendered TWO LINES tall (36px) next to one-line
                              // pills, because it had no whitespace-nowrap. Badge
                              // bakes that in; max-w + truncate keeps a long firm
                              // name on one line, and `title` exposes the full text.
                              <Badge
                                tone="purple"
                                className="max-w-[9rem] sm:max-w-[16rem] truncate"
                                leftIcon={<BuildingOfficeIcon className="h-3 w-3" />}
                                title={
                                  reply.msp?.firm
                                    ? `${reply.msp.firm} — external service provider`
                                    : 'External service provider'
                                }
                              >
                                {reply.msp?.firm || 'Service provider'}
                              </Badge>
                            )}
                            {isStaff && (
                              <Badge tone="brand" className="max-w-[18rem] truncate">
                                {[reply.user?.job_title, reply.user?.department, reply.user?.company].filter(Boolean).join(' · ') || 'Staff'}
                              </Badge>
                            )}
                            {reply.is_internal && <Badge tone="amber">Internal Note</Badge>}
                            {/* The year is noise on a ticket you are reading now, and it is what
                                pushed the timestamp onto its own line. Short form displayed, full
                                value in `title` — a SAFE use of hover, because the short form is
                                already complete enough to act on. Contrast the firm name and the
                                author, which must stay visible. */}
                            <span
                              className="text-sm text-slate-500 whitespace-nowrap sm:ml-auto"
                              title={formatDate(reply.created_at)}
                            >
                              {formatReplyTime(reply.created_at)}
                            </span>
                          </div>
                          <SafeHtml
                            className="prose prose-invert prose-sm max-w-none text-slate-300"
                            html={reply.content}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Reply Form */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setReplyType('reply')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    replyType === 'reply'
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Reply
                </button>
                <button
                  onClick={() => setReplyType('internal_note')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    replyType === 'internal_note'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  Internal Note
                </button>
              </div>
            </div>
            <div className="p-4">
              <RichTextEditor
                value={replyContent}
                onChange={setReplyContent}
                placeholder={replyType === 'reply' ? 'Type your reply...' : 'Add an internal note...'}
                minHeight="150px"
                showAI={aiEditorEnabled}
                aiContext={`Ticket: ${ticket.subject}\nDescription: ${ticket.description}`}
              />
              <div className="flex items-center justify-between mt-4">
                <label className={`flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}>
                  <PaperClipIcon className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Attach files'}
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    data-testid="ticket-attach-input"
                    onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = '' }}
                  />
                </label>
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="h-4 w-4" />
                  )}
                  {replyType === 'reply' ? 'Send Reply' : 'Add Note'}
                </button>
              </div>
              {uploadError && (
                <p className="mt-3 text-sm text-red-400" role="alert">{uploadError}</p>
              )}
              {attachments.length > 0 && (
                <div className="mt-4 border-t border-slate-700 pt-4" data-testid="ticket-attachments">
                  <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Attachments ({attachments.length})
                  </h3>
                  <ul className="space-y-1">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                        <a
                          href={`/api/portal/tickets/${params.id}/attachments/${a.id}`}
                          className="flex items-center gap-2 min-w-0 text-brand-400 hover:underline"
                          download
                        >
                          <PaperClipIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{a.file_name}</span>
                        </a>
                        <span className="flex-shrink-0 text-xs text-slate-500">
                          {formatFileSize(a.file_size)}
                          {a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}
                          {' · '}{formatRelativeDate(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Details</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">Requester</label>
                {ticket.contact ? (
                  <Link
                    href={`/portal/contacts/${ticket.contact.id}`}
                    className="flex items-center gap-2 mt-2 text-slate-200 hover:text-brand-400"
                  >
                    <UserIcon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{contactName}</p>
                      <p className="text-sm text-slate-400">{ticket.contact.email}</p>
                    </div>
                  </Link>
                ) : ticket.created_by ? (
                  <div className="flex items-center gap-2 mt-2 text-slate-200">
                    <UserIcon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{ticket.created_by.name}</p>
                      <p className="text-sm text-slate-400">{ticket.created_by.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-slate-400">Unknown</p>
                )}
              </div>
              {ticket.company && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Company</label>
                  <Link 
                    href={`/portal/companies/${ticket.company.id}`}
                    className="flex items-center gap-2 mt-2 text-slate-200 hover:text-brand-400"
                  >
                    <TagIcon className="h-5 w-5" />
                    <p className="font-medium">{ticket.company.name}</p>
                  </Link>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">Assigned To</label>
                {ticket.assigned_to ? (
                  <div className="flex items-center gap-2 mt-2 text-slate-200">
                    <div className="h-6 w-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs text-brand-400">
                      {ticket.assigned_to.name.charAt(0)}
                    </div>
                    <p className="font-medium">{ticket.assigned_to.name}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-slate-400">Unassigned</p>
                )}
              </div>
              {ticket.category && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Category</label>
                  <p className="mt-1 text-slate-200">{ticket.category}</p>
                </div>
              )}
              {ticket.location && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Location</label>
                  <p className="mt-1 text-slate-200">{ticket.location.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Queue & SLA Card */}
          {(queueScore || slaInfo) && (
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-100">Queue & SLA</h2>
              </div>
              <div className="p-4 space-y-3">
                {/* Queue Score */}
                {queueScore && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Score</span>
                      <span className="text-lg font-bold text-white">{queueScore.baseScore.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Action State</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${ACTION_STATE_COLORS[queueScore.actionState] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                        {ACTION_STATE_LABELS[queueScore.actionState] || queueScore.actionState}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Confidence</span>
                      <span className="text-sm text-slate-300">{(queueScore.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Scored By</span>
                      <span className="text-sm text-slate-400 capitalize">{queueScore.scoredBy}</span>
                    </div>
                    {/* AI Reasoning */}
                    {queueScore.reasoning && (
                      <div>
                        <button
                          onClick={() => setShowAiReasoning(!showAiReasoning)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <ChevronDownIcon className={`h-3 w-3 transition-transform ${showAiReasoning ? 'rotate-180' : ''}`} />
                          {queueScore.scoredBy === 'ai' ? 'AI Reasoning' : 'Scoring Reason'}
                        </button>
                        {showAiReasoning && (
                          <p className="mt-1 text-xs text-slate-400 bg-slate-900 rounded p-2">{queueScore.reasoning}</p>
                        )}
                      </div>
                    )}
                    <div className="border-t border-slate-700 my-2" />
                  </>
                )}
                {/* SLA Info */}
                {slaInfo && (
                  <>
                    {slaInfo.resolution.targetMinutes && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">SLA Target</span>
                        <span className="text-sm text-slate-300">
                          {formatDuration(slaInfo.resolution.targetMinutes * 60)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Active Time</span>
                      <span className="text-sm text-slate-300">{formatDuration(slaInfo.activeSeconds)}</span>
                    </div>
                    {slaInfo.totalPausedSeconds > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Paused Time</span>
                        <span className="text-sm text-slate-400">{formatDuration(slaInfo.totalPausedSeconds)}</span>
                      </div>
                    )}
                    {slaInfo.resolution.remainingSeconds !== null && !slaInfo.breached && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Remaining</span>
                        <span className={`text-sm font-medium ${slaInfo.resolution.remainingSeconds < 3600 ? 'text-red-400' : slaInfo.resolution.remainingSeconds < 14400 ? 'text-amber-400' : 'text-brand-400'}`}>
                          {formatDuration(slaInfo.resolution.remainingSeconds)}
                        </span>
                      </div>
                    )}
                    {slaInfo.isPaused && (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-yellow-500/10 rounded text-xs text-yellow-400 border border-yellow-500/20">
                        <ClockIcon className="h-3.5 w-3.5" />
                        SLA clock paused
                      </div>
                    )}
                    {slaInfo.breached && (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-red-500/10 rounded text-xs text-red-400 border border-red-500/20">
                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                        SLA breached
                      </div>
                    )}
                    {/* SLA Timeline */}
                    {slaHistory.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowSlaTimeline(!showSlaTimeline)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <ChevronDownIcon className={`h-3 w-3 transition-transform ${showSlaTimeline ? 'rotate-180' : ''}`} />
                          SLA Timeline ({slaHistory.length})
                        </button>
                        {showSlaTimeline && (
                          <div className="mt-2 space-y-1.5">
                            {slaHistory.map((event) => (
                              <div key={event.id} className="flex items-start gap-2 text-xs">
                                <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${event.wasPaused ? 'bg-yellow-500' : 'bg-brand-500'}`} />
                                <div className="min-w-0">
                                  <span className="text-slate-300">
                                    {event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus}
                                  </span>
                                  {event.wasPaused && (
                                    <span className="text-yellow-400 ml-1">(paused)</span>
                                  )}
                                  <div className="text-slate-500">
                                    {formatDate(event.createdAt)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Requester's Recent Tickets */}
          {recentTickets.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-100">
                  {ticket.contact ? `${ticket.contact.first_name}'s Recent Tickets` : 'Recent Tickets'}
                </h2>
              </div>
              <div className="divide-y divide-slate-700">
                {recentTickets.map((t) => {
                  const tNumber = `${t.prefix || 'TKT'}-${String(t.ticket_number).padStart(4, '0')}`
                  const tStatusStyle = getStatusColor(t.status, t.status_color)
                  const isCurrent = t.id === ticket.id
                  
                  return (
                    <Link 
                      key={t.id}
                      href={`/portal/tickets/${t.id}`}
                      className={`p-3 block hover:bg-slate-700/50 ${isCurrent ? 'bg-brand-500/10 border-l-2 border-brand-500' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-400">{tNumber}</span>
                        <span 
                          className="px-1.5 py-0.5 text-xs rounded"
                          style={tStatusStyle}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${isCurrent ? 'text-brand-400 font-medium' : 'text-slate-200'}`}>
                        {t.subject}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{formatRelativeDate(t.created_at)}</p>
                    </Link>
                  )
                })}
              </div>
              {ticket.contact && (
                <div className="p-3 border-t border-slate-700">
                  <Link 
                    href={`/portal/tickets?contact=${ticket.contact.id}`}
                    className="text-sm text-brand-400 hover:text-brand-300"
                  >
                    View all tickets →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Linked Items — assets, tickets, KB articles, documents */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Linked Items</h2>
            </div>
            <div className="p-4">
              {/* Direct asset from ticket (legacy field) */}
              {ticket.asset && (
                <div className="mb-3">
                  <Link
                    href={`/portal/assets/${ticket.asset.id}`}
                    className="inline-flex items-center gap-2 px-2 py-1 text-xs bg-slate-700/50 rounded-md text-slate-300 hover:bg-slate-700"
                  >
                    <ServerStackIcon className="h-3.5 w-3.5 text-cyan-500" />
                    {ticket.asset.name}
                    <span className="text-slate-500">{ticket.asset.asset_tag}</span>
                  </Link>
                </div>
              )}

              {/* Related Tickets */}
              {linkedTickets.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400 mb-1.5">Related Tickets</p>
                  <div className="space-y-1">
                    {linkedTickets.map((lt) => {
                      const tNumber = `${lt.prefix || 'TKT'}-${String(lt.ticket_number).padStart(4, '0')}`
                      return (
                        <Link
                          key={lt.id}
                          href={`/portal/tickets/${lt.id}`}
                          className="flex items-center gap-2 px-2 py-1 text-xs rounded-md hover:bg-slate-700/50"
                        >
                          <TicketIcon className="h-3.5 w-3.5 text-purple-400" />
                          <span className="font-mono text-slate-300">{tNumber}</span>
                          <span className="text-slate-500 truncate flex-1">{lt.subject}</span>
                          <span className="text-xs text-slate-600">{lt.relation_type}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* KB Articles */}
              {linkedKbArticles.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400 mb-1.5">KB Articles</p>
                  <div className="space-y-1">
                    {linkedKbArticles.map((ka) => (
                      <Link
                        key={ka.id}
                        href={`/portal/kb/${ka.slug}`}
                        className="flex items-center gap-2 px-2 py-1 text-xs rounded-md hover:bg-slate-700/50"
                      >
                        <DocumentTextIcon className="h-3.5 w-3.5 text-brand-400" />
                        <span className="text-slate-300 truncate">{ka.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {linkedDocuments.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400 mb-1.5">Documents</p>
                  <div className="space-y-1">
                    {linkedDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 px-2 py-1 text-xs">
                        <DocumentTextIcon className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-slate-300 truncate">{doc.title}</span>
                        <span className="text-slate-600">{doc.document_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LinkItems component for adding/removing links */}
              <LinkItems
                ticketId={ticket.id}
                allowedTypes={['asset', 'ticket', 'kb_article', 'document']}
                compact
              />
            </div>
          </div>

          {/* History / Audit Trail */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <button
              onClick={() => {
                if (!showHistory && historyEvents.length === 0) {
                  fetch(`/api/portal/tickets/${params.id}/history`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => { if (data?.events) setHistoryEvents(data.events) })
                    .catch(() => {})
                }
                setShowHistory(!showHistory)
              }}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-slate-400" />
                History
              </h2>
              <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            {showHistory && (
              <div className="border-t border-slate-700 max-h-64 overflow-y-auto">
                {historyEvents.length === 0 && (
                  <p className="p-4 text-sm text-slate-500">No changes recorded yet</p>
                )}
                {historyEvents.map((event) => {
                  if (event.event_type === 'reply') {
                    return (
                      <div key={event.id} className="px-4 py-2.5 border-b border-slate-700/50 last:border-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-slate-300">{event.actor_name}</span>
                          <span className="text-xs text-slate-500">{formatRelativeDate(event.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <ChatBubbleLeftRightIcon className="h-3 w-3 flex-shrink-0" />
                          {event.is_internal ? (
                            <span className="text-yellow-400/70">Added an internal note</span>
                          ) : (
                            <span className="text-brand-400/70">Added a reply</span>
                          )}
                        </p>
                      </div>
                    )
                  }

                  const fieldLabel = event.field_name.replace(/_/g, ' ').replace(/\bid\b/g, '').trim()
                  const oldDisplay = event.old_display || event.old_value || '(empty)'
                  const newDisplay = event.new_display || event.new_value || '(empty)'
                  return (
                    <div key={event.id} className="px-4 py-2.5 border-b border-slate-700/50 last:border-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-300">{event.actor_name}</span>
                        <span className="text-xs text-slate-500">{formatRelativeDate(event.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Changed <span className="text-slate-300">{fieldLabel}</span>
                        {' '}from <span className="text-red-400/70">{oldDisplay}</span>
                        {' '}to <span className="text-brand-400/70">{newDisplay}</span>
                      </p>
                      {event.change_source !== 'user' && (
                        <span className="text-xs text-slate-600">via {event.change_source}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Similar Tickets */}
          {similarTickets.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-100">Similar Tickets</h2>
              </div>
              <div className="divide-y divide-slate-700">
                {similarTickets.map((t) => {
                  const tNumber = `${t.prefix || 'TKT'}-${String(t.ticket_number).padStart(4, '0')}`
                  const tStatusStyle = getStatusColor(t.status, t.status_color)
                  const isResolved = t.status_base === 'closed'
                  return (
                    <Link
                      key={t.id}
                      href={`/portal/tickets/${t.id}`}
                      className="p-3 block hover:bg-slate-700/50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-400">{tNumber}</span>
                        <span
                          className="px-1.5 py-0.5 text-xs rounded"
                          style={tStatusStyle}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 truncate">{t.subject}</p>
                      {isResolved && t.root_cause && (
                        <p className="text-xs text-brand-400/70 mt-1 line-clamp-2">
                          Root cause: {t.root_cause}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">{formatRelativeDate(t.created_at)}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suggested KB Articles */}
          {suggestedArticles.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5 text-purple-400" />
                  Suggested Articles
                </h2>
              </div>
              <div className="divide-y divide-slate-700">
                {suggestedArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/portal/kb/${article.category_slug}/${article.slug}`}
                    className="p-3 block hover:bg-slate-700/50 group"
                  >
                    <p className="text-sm text-slate-200 group-hover:text-brand-400 transition-colors">
                      {article.title}
                    </p>
                    {article.summary && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{article.summary}</p>
                    )}
                    {article.helpful_ratio !== null && (
                      <p className="text-xs text-slate-600 mt-1">{article.helpful_ratio}% found helpful</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Timeline</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <ClockIcon className="h-4 w-4 text-slate-500" />
                <span className="text-slate-400">Created</span>
                <span className="text-slate-200 ml-auto">{formatDate(ticket.created_at)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <ClockIcon className="h-4 w-4 text-slate-500" />
                <span className="text-slate-400">Last Updated</span>
                <span className="text-slate-200 ml-auto">{formatDate(ticket.updated_at)}</span>
              </div>
              {ticket.resolved_at && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircleIcon className="h-4 w-4 text-brand-500" />
                  <span className="text-slate-400">Resolved</span>
                  <span className="text-slate-200 ml-auto">{formatDate(ticket.resolved_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status menu click-outside is now inline within the dropdown container */}

      {/* Incomplete Required Tasks Warning */}
      {showIncompleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                Incomplete Required Tasks
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                The following required tasks have not been completed:
              </p>
            </div>
            <div className="p-6 space-y-4">
              <ul className="space-y-1.5">
                {getIncompleteRequiredTasks().map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-sm text-slate-300">
                    <XCircleIcon className="h-4 w-4 text-red-400 flex-shrink-0" />
                    {task.title}
                  </li>
                ))}
              </ul>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Why are you closing without completing these tasks?
                </label>
                <textarea
                  value={incompleteReason}
                  onChange={(e) => setIncompleteReason(e.target.value)}
                  placeholder="e.g., No longer needed — issue resolved a different way"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowIncompleteWarning(false)
                  setIncompleteReason('')
                  // Reopen resolution modal so user can go back
                  setShowResolutionModal(true)
                }}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleForceClose}
                disabled={!incompleteReason.trim()}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                Close Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <PencilIcon className="h-5 w-5 text-brand-400" />
                Edit Ticket
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={editData.subject}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                <select
                  value={editData.priority}
                  onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={editData.category_id}
                  onChange={(e) => setEditData({ ...editData, category_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                >
                  <option value="">No category</option>
                  {(() => {
                    const topLevel = editCategories.filter(c => !c.parent_id)
                    const getChildren = (pid: string) => editCategories.filter(c => c.parent_id === pid)
                    return topLevel.map(cat => {
                      const children = getChildren(cat.id)
                      if (children.length > 0) {
                        return (
                          <optgroup key={cat.id} label={cat.name}>
                            <option value={cat.id}>{cat.name} (General)</option>
                            {children.map(sub => (
                              <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                          </optgroup>
                        )
                      }
                      return <option key={cat.id} value={cat.id}>{cat.name}</option>
                    })
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Assigned To</label>
                <select
                  value={editData.assigned_to}
                  onChange={(e) => setEditData({ ...editData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                >
                  <option value="">Unassigned</option>
                  {editUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editSaving || !editData.subject.trim()}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-brand-400" />
                Resolution Notes
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Help the team learn from this ticket. This data improves AI suggestions.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  What was the problem?
                </label>
                <textarea
                  value={resolutionData.root_cause}
                  onChange={(e) => setResolutionData({ ...resolutionData, root_cause: e.target.value })}
                  placeholder="e.g., User's account was locked due to too many failed login attempts"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  How was it fixed?
                </label>
                <textarea
                  value={resolutionData.resolution_steps}
                  onChange={(e) => setResolutionData({ ...resolutionData, resolution_steps: e.target.value })}
                  placeholder="e.g., Unlocked the account in Active Directory and reset the password"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={resolutionData.resolution_category}
                  onChange={(e) => setResolutionData({ ...resolutionData, resolution_category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                >
                  <option value="">Select a category (optional)</option>
                  <option value="config_change">Configuration Change</option>
                  <option value="hardware_replacement">Hardware Replacement</option>
                  <option value="user_error">User Error</option>
                  <option value="software_bug">Software Bug</option>
                  <option value="access_issue">Access Issue</option>
                  <option value="vendor_issue">Vendor Issue</option>
                  <option value="documentation">Documentation</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={() => handleResolutionSubmit(true)}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip for now
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowResolutionModal(false)
                    setPendingStatusChange(null)
                  }}
                  className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResolutionSubmit(false)}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
                >
                  Save & Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
