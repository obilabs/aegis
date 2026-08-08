'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FeatureGate } from '@/components/features/FeatureGate'
import { AIChatDisclaimer } from '@/components/AIChatDisclaimer'
import {
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  BookOpenIcon,
  TicketIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  Bars3Icon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Source {
  title: string
  slug?: string
  url: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Source[]
  kb_gap?: boolean
}

interface ChatSessionSummary {
  id: string
  title: string | null
  status: string
  resolution_status: string | null
  created_ticket_id: string | null
  created_at: string
  updated_at: string
  message_count: number
}

interface EscalationPreview {
  subject: string
  description: string
  raw_summary: string
  category_suggestion: string
  priority_suggestion: string
  solutions_attempted: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SUGGESTIONS = [
  'How do I reset my password?',
  'I need help with a technical issue',
  'What software is available?',
  'How do I submit a request?',
]

// ---------------------------------------------------------------------------
// Helper: status badge
// ---------------------------------------------------------------------------

function SessionStatusBadge({ session }: { session: ChatSessionSummary }) {
  if (session.resolution_status === 'ticket_created') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">
        <TicketIcon className="h-2.5 w-2.5" />
        Ticket
      </span>
    )
  }
  if (session.resolution_status === 'resolved') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-brand-500/20 text-brand-400 rounded">
        <CheckCircleIcon className="h-2.5 w-2.5" />
        Resolved
      </span>
    )
  }
  if (session.resolution_status === 'escalated') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
        <ArrowTopRightOnSquareIcon className="h-2.5 w-2.5" />
        Escalated
      </span>
    )
  }
  if (session.status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-brand-500/10 text-brand-500 rounded">
        <ClockIcon className="h-2.5 w-2.5" />
        Active
      </span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AIChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionResolutionStatus, setSessionResolutionStatus] = useState<string | null>(null)
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)

  // Sidebar state
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Escalation state
  const [escalating, setEscalating] = useState(false)
  const [escalationPreview, setEscalationPreview] = useState<EscalationPreview | null>(null)
  const [showEscalationModal, setShowEscalationModal] = useState(false)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketCreated, setTicketCreated] = useState<{ ticket_id: string; ticket_number: string; subject: string } | null>(null)

  // Resolving state
  const [resolving, setResolving] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // -------------------------------------------------------------------------
  // Fetch sessions for sidebar
  // -------------------------------------------------------------------------

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/ai/sessions')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setSessions(data.data)
        }
      }
    } catch {
      // Silently fail — sidebar is non-critical
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Load session messages from the DB
  // -------------------------------------------------------------------------

  const loadSessionMessages = useCallback(async (sid: string) => {
    setLoadingMessages(true)
    // Clear current messages immediately so the user sees a loading state
    // rather than stale messages from the previous session
    setMessages([])
    setError(null)
    setTicketCreated(null)

    try {
      const res = await fetch(`/api/ai/sessions/${sid}/messages`)
      if (!res.ok) return false

      const data = await res.json()
      if (!data.success) return false

      const loadedMessages: Message[] = data.data.messages.map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
        sources: m.sources || [],
        kb_gap: m.kb_gap || false,
      }))

      setMessages(loadedMessages)
      setSessionId(sid)
      setSessionResolutionStatus(data.data.session.resolution_status)
      setCreatedTicketId(data.data.session.created_ticket_id)
      return true
    } catch {
      return false
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Initial load: fetch sessions + resume from URL param
  // -------------------------------------------------------------------------

  useEffect(() => {
    fetchSessions()

    // Load contextual suggestions
    fetch('/api/ai/chat/suggestions')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.suggestions?.length > 0) {
          setSuggestions(data.suggestions)
        }
      })
      .catch(() => {})
  }, [fetchSessions])

  // Handle ?session=xxx URL parameter for resuming sessions
  useEffect(() => {
    const resumeSessionId = searchParams.get('session')
    if (resumeSessionId) {
      loadSessionMessages(resumeSessionId)
    }
  }, [searchParams, loadSessionMessages])

  // -------------------------------------------------------------------------
  // Scroll to bottom on new messages
  // -------------------------------------------------------------------------

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          session_id: sessionId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get response')
      }

      // Track session ID from server
      if (data.data.session_id && !sessionId) {
        setSessionId(data.data.session_id)
        // Refresh sidebar to show the new session
        fetchSessions()
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date(),
        sources: data.data.sources || [],
        kb_gap: data.data.kb_gap || false,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // -------------------------------------------------------------------------
  // New Chat / Switch Session
  // -------------------------------------------------------------------------

  const startNewChat = () => {
    setMessages([])
    setError(null)
    setSessionId(null)
    setSessionResolutionStatus(null)
    setCreatedTicketId(null)
    setTicketCreated(null)
    setSidebarOpen(false)
    // Update URL without the session param
    router.replace('/portal/chat', { scroll: false })
  }

  const switchToSession = async (sid: string) => {
    const success = await loadSessionMessages(sid)
    if (success) {
      setSidebarOpen(false)
      // Update URL with session param
      router.replace(`/portal/chat?session=${sid}`, { scroll: false })
    }
  }

  // -------------------------------------------------------------------------
  // Resolve session
  // -------------------------------------------------------------------------

  const handleResolveSession = async () => {
    if (!sessionId || resolving) return
    setResolving(true)
    try {
      const res = await fetch(`/api/ai/sessions/${sessionId}/messages`)
      if (res.ok) {
        // Update session status via a simple PATCH-like approach
        // We'll directly update via the chat messages endpoint won't work here,
        // so we use a direct query approach through a small inline endpoint.
        // For now, use a POST to the escalation API with a special mode or
        // update session status directly.
        // Actually, let's just call the sessions endpoint with a PATCH-style.
        // Since we don't have a PATCH endpoint for sessions yet, let's create
        // the simplest approach: call a dedicated resolve endpoint.
        // We'll use the existing pattern and add a PATCH to sessions.
      }
    } catch {
      // Ignore
    }

    // Use a simpler approach: call a generic update
    try {
      const res = await fetch('/api/ai/sessions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (res.ok) {
        setSessionResolutionStatus('resolved')
        // Update the session in the sidebar
        setSessions(prev =>
          prev.map(s =>
            s.id === sessionId ? { ...s, resolution_status: 'resolved' } : s
          )
        )
      }
    } catch {
      // Ignore errors silently
    } finally {
      setResolving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Escalation flow
  // -------------------------------------------------------------------------

  const handleEscalatePreview = async () => {
    if (!sessionId || escalating || messages.length === 0) return
    setEscalating(true)

    try {
      const res = await fetch('/api/ai/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, preview: true }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate preview')
      }

      const preview = data.data as EscalationPreview
      setEscalationPreview(preview)
      setEditedSubject(preview.subject)
      setEditedDescription(preview.raw_summary)
      setShowEscalationModal(true)
    } catch (err: any) {
      setError(err.message || 'Failed to generate escalation preview')
    } finally {
      setEscalating(false)
    }
  }

  const handleCreateTicket = async () => {
    if (!sessionId || creatingTicket) return
    setCreatingTicket(true)

    try {
      const res = await fetch('/api/ai/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          preview: false,
          user_edits: {
            subject: editedSubject,
            description: editedDescription,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create ticket')
      }

      setTicketCreated({
        ticket_id: data.data.ticket_id,
        ticket_number: data.data.ticket_number,
        subject: data.data.subject,
      })
      setShowEscalationModal(false)
      setEscalationPreview(null)
      setSessionResolutionStatus('ticket_created')
      setCreatedTicketId(data.data.ticket_id)

      // Update sidebar
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? { ...s, resolution_status: 'ticket_created', created_ticket_id: data.data.ticket_id }
            : s
        )
      )
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket')
    } finally {
      setCreatingTicket(false)
    }
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  // Check if the last assistant message suggests creating a ticket
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const suggestsTicket = lastAssistant?.content?.includes('/portal/tickets/new') ||
    (lastAssistant?.sources?.length === 0 && lastAssistant?.content?.toLowerCase().includes('ticket'))

  const canEscalate = sessionId && messages.length > 0 && sessionResolutionStatus !== 'ticket_created'
  const canResolve = sessionId && messages.length > 0 && !sessionResolutionStatus

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <FeatureGate
      feature="ai_chat"
      fallback={
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
          <SparklesIcon className="h-12 w-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-slate-300">AI Assistant is not enabled</h2>
          <p className="text-slate-500 mt-2 max-w-md">
            Enable the AI Chat feature in Settings &gt; Features to use the AI assistant.
          </p>
        </div>
      }
    >
    <div className="flex h-[calc(100vh-8rem)]">
      {/* ================================================================= */}
      {/* Sidebar */}
      {/* ================================================================= */}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static
          fixed inset-y-0 left-0 z-40
          w-72 flex-shrink-0 flex flex-col
          bg-slate-900 border-r border-slate-800
          transition-transform duration-200 ease-in-out
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300">Chat History</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewChat}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="New Chat"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No conversations yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => switchToSession(s.id)}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg transition-colors group
                    ${s.id === sessionId
                      ? 'bg-slate-800 border border-brand-500/30'
                      : 'hover:bg-slate-800/60 border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-200 truncate flex-1">
                      {s.title || `Chat ${new Date(s.created_at).toLocaleDateString()}`}
                    </p>
                    <SessionStatusBadge session={s} />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500">
                      {s.message_count} msg{s.message_count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {formatRelativeTime(s.updated_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Main Chat Area */}
      {/* ================================================================= */}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
              title="Chat History"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <Link
              href="/portal/dashboard"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors hidden lg:block"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">AI Assistant</h1>
                <p className="text-xs text-slate-500">Powered by your configured AI provider</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Resolve button */}
            {canResolve && (
              <button
                onClick={handleResolveSession}
                disabled={resolving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors disabled:opacity-50"
                title="Mark as Resolved"
              >
                <CheckCircleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{resolving ? 'Resolving...' : 'Resolved'}</span>
              </button>
            )}
            {/* Session status indicator in header */}
            {sessionResolutionStatus === 'resolved' && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-400 bg-brand-500/10 rounded-lg">
                <CheckCircleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Resolved</span>
              </span>
            )}
            {sessionResolutionStatus === 'ticket_created' && (
              <Link
                href={`/portal/tickets/${createdTicketId || ticketCreated?.ticket_id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <TicketIcon className="h-4 w-4" />
                <span className="hidden sm:inline">View Ticket</span>
              </Link>
            )}
            <button
              onClick={startNewChat}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="New Chat"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
            <Link
              href="/portal/settings/ai"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="AI Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <AIChatDisclaimer />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent mb-4"></div>
              <p className="text-sm text-slate-500">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-purple-500/10 rounded-full mb-4">
                <SparklesIcon className="h-12 w-12 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">How can I help you?</h2>
              <p className="text-slate-400 max-w-md mb-6">
                Ask me anything about IT support, troubleshooting, or documentation. I&apos;ll search the knowledge base to find the best answer.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 text-left transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 p-2 bg-purple-500/20 rounded-lg h-fit">
                      <SparklesIcon className="h-5 w-5 text-purple-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div
                      className={`text-xs mt-2 ${
                        message.role === 'user' ? 'text-brand-200' : 'text-slate-500'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 p-2 bg-brand-500/20 rounded-lg h-fit">
                      <UserIcon className="h-5 w-5 text-brand-400" />
                    </div>
                  )}
                </div>

                {/* KB Sources */}
                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div className="ml-12 flex flex-wrap gap-2">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <BookOpenIcon className="h-3.5 w-3.5" />
                      Sources:
                    </span>
                    {message.sources.map((source, idx) => (
                      <Link
                        key={source.slug || idx}
                        href={source.url}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-brand-400 rounded border border-slate-700 hover:border-brand-500/50 transition-colors"
                      >
                        {source.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 p-2 bg-purple-500/20 rounded-lg h-fit">
                <SparklesIcon className="h-5 w-5 text-purple-400 animate-pulse" />
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Searching knowledge base and thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-400">{error}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Make sure you have an AI provider configured in{' '}
                  <Link href="/portal/settings/ai" className="text-brand-400 underline">
                    Settings &rarr; AI
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Ticket created success banner */}
          {ticketCreated && (
            <div className="ml-12 flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-brand-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-200">
                  Ticket <span className="font-medium text-brand-400">{ticketCreated.ticket_number}</span> created successfully.
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{ticketCreated.subject}</p>
              </div>
              <Link
                href={`/portal/tickets/${ticketCreated.ticket_id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                View Ticket
              </Link>
            </div>
          )}

          {/* Escalate to Ticket prompt */}
          {suggestsTicket && !loading && canEscalate && !ticketCreated && (
            <div className="ml-12 flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <TicketIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-300">Need more help from the support team?</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI will summarize this conversation as a handoff for the team.
                </p>
              </div>
              <button
                onClick={handleEscalatePreview}
                disabled={escalating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {escalating ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  'Create Ticket'
                )}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pt-4 pb-4 border-t border-slate-800">
          {/* Create Ticket button (always visible when applicable) */}
          {canEscalate && !ticketCreated && messages.length >= 2 && !suggestsTicket && (
            <div className="flex justify-end mb-2">
              <button
                onClick={handleEscalatePreview}
                disabled={escalating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <TicketIcon className="h-3.5 w-3.5" />
                {escalating ? 'Summarizing...' : 'Create Ticket from Chat'}
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
                rows={2}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>
          <p className="text-xs text-slate-600 mt-2 text-center">
            AI responses are informed by your knowledge base. Verify important information.
          </p>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Escalation Preview Modal */}
      {/* ================================================================= */}

      {showEscalationModal && escalationPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Create Support Ticket</h2>
              </div>
              <button
                onClick={() => {
                  setShowEscalationModal(false)
                  setEscalationPreview(null)
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-slate-400">
                Review and edit the AI-generated summary before creating the ticket.
              </p>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                  maxLength={500}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-y"
                  rows={6}
                />
              </div>

              {/* AI suggestions (read-only) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Suggested Category
                  </label>
                  <p className="text-sm text-slate-300 capitalize">
                    {escalationPreview.category_suggestion}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Suggested Priority
                  </label>
                  <p className="text-sm text-slate-300 capitalize">
                    {escalationPreview.priority_suggestion}
                  </p>
                </div>
              </div>

              {/* Solutions attempted */}
              {escalationPreview.solutions_attempted.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Solutions Already Attempted
                  </label>
                  <ul className="list-disc list-inside space-y-1">
                    {escalationPreview.solutions_attempted.map((s, i) => (
                      <li key={i} className="text-sm text-slate-300">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowEscalationModal(false)
                  setEscalationPreview(null)
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={creatingTicket || !editedSubject.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {creatingTicket ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <TicketIcon className="h-4 w-4" />
                    Create Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  )
}

// ---------------------------------------------------------------------------
// Utility: relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
