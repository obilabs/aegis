'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AIChatDisclaimer } from '@/components/AIChatDisclaimer'

interface Message {
  id?: string
  role: 'user' | 'model'
  content: string
  created_at?: Date
  pending?: boolean
}

interface Conversation {
  id: string
  title: string
  preview: string
  message_count: number
  created_at: string
  updated_at: string
}

interface RateLimit {
  limit: number
  remaining: number
  reset_in_minutes: number
}

export default function SupportPage() {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = useSession()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!sessionPending && !session) {
      router.push('/portal/login')
    }
  }, [session, sessionPending, router])

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Fetch conversations on mount
  useEffect(() => {
    if (session) {
      fetchConversations()
    }
  }, [session])

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true)
      const res = await fetch('/api/support/conversations')
      const data = await res.json()

      if (data.success) {
        setConversations(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadConversation = async (conversationId: string) => {
    try {
      setLoading(true)
      setError(null)
      setCurrentConversationId(conversationId)

      const res = await fetch(`/api/support/conversations/${conversationId}/messages`)
      const data = await res.json()

      if (data.success) {
        setMessages(data.data.messages)
      } else {
        setError(data.error || 'Failed to load conversation')
      }
    } catch (err) {
      setError('Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  const startNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
    setError(null)
    inputRef.current?.focus()
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setError(null)

    // Add pending user message
    const pendingUserMessage: Message = {
      role: 'user',
      content: userMessage,
      pending: true,
    }
    setMessages(prev => [...prev, pendingUserMessage])

    // Add pending AI message
    const pendingAiMessage: Message = {
      role: 'model',
      content: '',
      pending: true,
    }
    setMessages(prev => [...prev, pendingAiMessage])

    setLoading(true)

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentConversationId,
          message: userMessage,
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Update conversation ID if this was a new conversation
        if (!currentConversationId && data.data.conversation_id) {
          setCurrentConversationId(data.data.conversation_id)
          fetchConversations() // Refresh conversation list
        }

        // Update messages with actual response
        setMessages(prev =>
          prev.map((msg, idx) => {
            if (idx === prev.length - 2) {
              // User message
              return { ...msg, pending: false }
            }
            if (idx === prev.length - 1) {
              // AI response
              return {
                role: 'model',
                content: data.data.response,
                pending: false,
              }
            }
            return msg
          })
        )

        // Update rate limit info
        if (data.data.rate_limit) {
          setRateLimit(data.data.rate_limit)
        }
      } else {
        // Remove pending messages on error
        setMessages(prev => prev.slice(0, -2))
        setError(data.error || 'Failed to send message')
      }
    } catch (err) {
      // Remove pending messages on error
      setMessages(prev => prev.slice(0, -2))
      setError('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return

    try {
      const res = await fetch(`/api/support/conversations?id=${conversationId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId))
        if (currentConversationId === conversationId) {
          startNewConversation()
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (sessionPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      {/* Sidebar - Conversation History */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-0'
        } bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 overflow-hidden`}
      >
        <div className="p-4 border-b border-slate-800">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            <PlusIcon className="h-4 w-4" />
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversationId === conv.id
                      ? 'bg-brand-900/40 text-brand-300'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <ChatIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-slate-500 truncate">{conv.preview}</p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      deleteConversation(conv.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                    title="Delete conversation"
                  >
                    <TrashIcon className="h-4 w-4 text-slate-500 hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GitHub Link */}
        <div className="p-4 border-t border-slate-800">
          <a
            href="https://github.com/obilabs/Aegis/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-brand-400 transition-colors"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            Open GitHub Issue
          </a>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <MenuIcon className="h-5 w-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Support Chat</h1>
              <p className="text-sm text-slate-400">
                Ask questions about Aegis setup and usage
              </p>
            </div>
          </div>
          {rateLimit && (
            <div className="text-xs text-slate-400">
              {rateLimit.remaining} / {rateLimit.limit} messages remaining
            </div>
          )}
        </div>

        <AIChatDisclaimer />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-brand-900/40 rounded-full flex items-center justify-center mb-4">
                <ChatIcon className="h-8 w-8 text-brand-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-100 mb-2">
                How can I help you?
              </h2>
              <p className="text-slate-400 max-w-md mb-6">
                I can answer questions about Aegis setup, Google Workspace integration,
                troubleshooting, and more.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
                {[
                  'How do I set up Google Workspace?',
                  'What is Aegis?',
                  'I\'m getting an "Invalid grant" error',
                  'How do I sync users?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInputValue(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="px-4 py-3 text-sm text-left text-slate-300 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'model' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-brand-900/40 rounded-full flex items-center justify-center">
                      <BotIcon className="h-5 w-5 text-brand-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    } ${msg.pending ? 'opacity-60' : ''}`}
                  >
                    {msg.pending && msg.role === 'model' && !msg.content ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse flex gap-1">
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                            style={{ animationDelay: '0.1s' }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                        </div>
                        <span className="text-sm text-slate-400">Thinking...</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mb-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Rate Limit Warning */}
        {rateLimit && rateLimit.remaining <= 3 && rateLimit.remaining > 0 && (
          <div className="mx-6 mb-2 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg text-sm text-yellow-400">
            You have {rateLimit.remaining} message{rateLimit.remaining === 1 ? '' : 's'} remaining
            this hour. For complex issues, consider{' '}
            <a
              href="https://github.com/obilabs/Aegis/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              opening a GitHub issue
            </a>
            .
          </div>
        )}

        {/* Input Area */}
        <div className="p-6 border-t border-slate-800">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  disabled={loading || (rateLimit?.remaining === 0)}
                  rows={1}
                  className="w-full px-4 py-3 pr-12 bg-slate-900 text-slate-200 placeholder-slate-500 border border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:bg-slate-900/50 disabled:cursor-not-allowed"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || loading || (rateLimit?.remaining === 0)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <SendIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  )
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
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
