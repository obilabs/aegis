'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeature } from '@/lib/hooks/useFeatures'

interface UnansweredQuestion {
  question: string
  frequency: number
  last_asked: string
}

interface UnderservedCategory {
  category: string
  category_id: string
  ticket_count: number
  article_count: number
}

interface CommonTopic {
  subject: string
  frequency: number
  category: string
  last_created: string
}

export default function KBSuggestionsPage() {
  const router = useRouter()
  const { isEnabled: aiSuggestionsEnabled } = useFeature('ai_suggestions')
  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>([])
  const [underservedCategories, setUnderservedCategories] = useState<UnderservedCategory[]>([])
  const [commonTopics, setCommonTopics] = useState<CommonTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/portal/kb/suggestions')
        if (!res.ok) throw new Error('Failed to fetch suggestions')
        const data = await res.json()
        setUnansweredQuestions(data.unansweredQuestions || [])
        setUnderservedCategories(data.underservedCategories || [])
        setCommonTopics(data.commonTopics || [])
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [])

  const handleGenerate = async (topic: string, category?: string) => {
    setGenerating(topic)
    try {
      const res = await fetch('/api/portal/kb/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, category }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const article = data.article

      // Navigate to editor with generated content as query params
      const params = new URLSearchParams({
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        tags: (article.tags || []).join(','),
        category: article.category || category || '',
      })
      router.push(`/portal/kb/new?${params.toString()}`)
    } catch (error) {
      console.error('Generation error:', error)
    } finally {
      setGenerating(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  const hasData = unansweredQuestions.length > 0 || underservedCategories.length > 0 || commonTopics.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/portal/kb"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Article Suggestions</h1>
            <p className="text-slate-400 mt-1">KB gaps identified from AI chats and tickets</p>
          </div>
        </div>
        <Link
          href="/portal/kb/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Article
        </Link>
      </div>

      {!hasData ? (
        <div className="text-center py-16 bg-slate-900 rounded-xl border border-slate-800">
          <svg className="h-16 w-16 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300">No suggestions yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Suggestions appear as users ask AI questions and create tickets. The more activity, the better the suggestions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unanswered AI Questions */}
          {unansweredQuestions.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800">
              <div className="p-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  Frequently Asked (No KB Answer)
                </h2>
                <p className="text-xs text-slate-500 mt-1">Questions users asked AI that had no matching KB articles</p>
              </div>
              <div className="divide-y divide-slate-800">
                {unansweredQuestions.map((q, i) => (
                  <div key={i} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 line-clamp-2">{q.question}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-500">Asked {q.frequency}x</span>
                        <span className="text-xs text-slate-600">Last: {formatDate(q.last_asked)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerate(q.question)}
                      disabled={!aiSuggestionsEnabled || generating === q.question}
                      title={!aiSuggestionsEnabled ? 'Enable AI Suggestions in Settings to use this feature' : ''}
                      className="flex-shrink-0 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {generating === q.question ? 'Generating...' : aiSuggestionsEnabled ? 'Generate Article' : 'AI Not Enabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Underserved Categories */}
          {underservedCategories.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800">
              <div className="p-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  Categories Needing Coverage
                </h2>
                <p className="text-xs text-slate-500 mt-1">Ticket categories with many tickets but few KB articles</p>
              </div>
              <div className="divide-y divide-slate-800">
                {underservedCategories.map((cat, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{cat.category}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">{cat.ticket_count} tickets (90d)</span>
                        <span className="text-xs text-amber-400">{cat.article_count} article{cat.article_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerate(`Common ${cat.category} issues and solutions`, cat.category)}
                      disabled={!aiSuggestionsEnabled || generating !== null}
                      title={!aiSuggestionsEnabled ? 'Enable AI Suggestions in Settings to use this feature' : ''}
                      className="flex-shrink-0 px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {aiSuggestionsEnabled ? 'Generate Article' : 'AI Not Enabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Ticket Topics */}
          {commonTopics.length > 0 && (
            <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800">
              <div className="p-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                  </svg>
                  Recurring Ticket Topics (Last 30 Days)
                </h2>
                <p className="text-xs text-slate-500 mt-1">Ticket subjects that appear multiple times — good candidates for KB articles</p>
              </div>
              <div className="divide-y divide-slate-800">
                {commonTopics.map((topic, i) => (
                  <div key={i} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{topic.subject}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">{topic.frequency} tickets</span>
                        {topic.category && (
                          <span className="text-xs text-slate-600">{topic.category}</span>
                        )}
                        <span className="text-xs text-slate-600">Last: {formatDate(topic.last_created)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerate(topic.subject, topic.category)}
                      disabled={!aiSuggestionsEnabled || generating !== null}
                      title={!aiSuggestionsEnabled ? 'Enable AI Suggestions in Settings to use this feature' : ''}
                      className="flex-shrink-0 px-3 py-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {aiSuggestionsEnabled ? 'Generate Article' : 'AI Not Enabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
