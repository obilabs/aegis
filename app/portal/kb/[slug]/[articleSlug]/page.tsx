'use client'

import { SafeHtml } from '@/components/SafeHtml'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import QuizRenderer from '@/components/assessment/QuizRenderer'
import type { ParsedAssessment } from '@/lib/assessment-parser'

interface KBArticle {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  category_name: string
  category_slug: string
  author_name: string
  view_count: number
  helpful_count: number
  not_helpful_count: number
  helpful_ratio: number | null
  published_at: string
  updated_at: string
  tags: string[]
  article_type?: string
  assessment?: ParsedAssessment
  passing_score?: number
  can_edit?: boolean
}

interface RelatedArticle {
  id: string
  title: string
  slug: string
  summary: string
  category_slug: string
}

export default function KBArticlePage({ params }: { params: Promise<{ slug: string; articleSlug: string }> }) {
  const { slug, articleSlug } = use(params)
  const [article, setArticle] = useState<KBArticle | null>(null)
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackSent, setFeedbackSent] = useState<'helpful' | 'not_helpful' | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [ackStatus, setAckStatus] = useState<{
    requires_acknowledgment: boolean
    acknowledged: boolean
    valid: boolean
    acknowledged_at?: string
    needs_reack?: boolean
    expired?: boolean
  } | null>(null)
  const [ackLoading, setAckLoading] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState<{
    is_training: boolean
    has_assessment: boolean
    passing_score?: number
    attempts: number
    best_score: number | null
    best_passed: boolean
  } | null>(null)
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!article) return
    if (!confirm(`Delete "${article.title}"? This can't be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/portal/kb/articles/${article.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Failed to delete article')
        return
      }
      router.push('/portal/kb')
    } catch {
      alert('Failed to delete article')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/kb/public/article/${encodeURIComponent(articleSlug)}`)
        if (!res.ok) throw new Error('Failed to fetch article')
        const data = await res.json()
        setArticle(data.article || null)
        setRelatedArticles(data.relatedArticles || [])
      } catch (error) {
        console.error('Error fetching article:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchArticle()
  }, [articleSlug])

  // Fetch acknowledgment status for policy articles
  useEffect(() => {
    if (!articleSlug) return
    fetch(`/api/portal/kb/${encodeURIComponent(articleSlug)}/acknowledgment-status`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setAckStatus(data) })
      .catch(() => {})
  }, [articleSlug])

  // Fetch training status for training articles
  useEffect(() => {
    if (!articleSlug) return
    fetch(`/api/portal/kb/${encodeURIComponent(articleSlug)}/training-status`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.is_training) setTrainingStatus(data) })
      .catch(() => {})
  }, [articleSlug])

  const handleAcknowledge = async () => {
    if (ackLoading) return
    setAckLoading(true)
    try {
      const res = await fetch(`/api/portal/kb/${encodeURIComponent(articleSlug)}/acknowledge`, {
        method: 'POST',
      })
      if (res.ok) {
        setAckStatus(prev => prev ? { ...prev, acknowledged: true, valid: true, acknowledged_at: new Date().toISOString(), needs_reack: false, expired: false } : prev)
      }
    } catch (error) {
      console.error('Acknowledgment error:', error)
    } finally {
      setAckLoading(false)
    }
  }

  const handleFeedback = async (isHelpful: boolean) => {
    if (feedbackSent || feedbackLoading) return
    setFeedbackLoading(true)
    try {
      const res = await fetch(`/api/kb/public/article/${encodeURIComponent(articleSlug)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_helpful: isHelpful }),
      })
      if (res.ok || res.status === 409) {
        setFeedbackSent(isHelpful ? 'helpful' : 'not_helpful')
      }
    } catch (error) {
      console.error('Feedback error:', error)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-16">
        <svg className="h-16 w-16 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <h2 className="text-lg font-semibold text-slate-300">Article not found</h2>
        <p className="text-sm text-slate-500 mt-1">This article may have been moved or deleted</p>
        <Link href="/portal/kb" className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300">
          Back to Knowledge Base
        </Link>
      </div>
    )
  }

  return (
    <div className="flex gap-8">
      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/portal/kb" className="hover:text-brand-400 transition-colors">
            Knowledge Base
          </Link>
          <span>/</span>
          <Link href={`/portal/kb/${slug}`} className="hover:text-brand-400 transition-colors">
            {article.category_name || slug}
          </Link>
          <span>/</span>
          <span className="text-white truncate">{article.title}</span>
        </nav>

        {/* Article Header */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-white">{article.title}</h1>
            {article.can_edit && (
              <div className="flex-shrink-0 flex items-center gap-2">
                <Link
                  href={`/portal/kb/${slug}/${articleSlug}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors border border-slate-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-300 rounded-lg font-medium transition-colors border border-slate-700 disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            {article.author_name && (
              <span>By {article.author_name}</span>
            )}
            <span>Updated {formatDate(article.updated_at)}</span>
            <span>{(article.view_count || 0).toLocaleString()} views</span>
          </div>
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {article.tags.map((tag) => {
                const isFramework = ['nist-csf', 'soc2', 'hipaa', 'pci-dss', 'itil4'].includes(tag)
                return (
                  <span
                    key={tag}
                    className={`px-2 py-0.5 text-xs rounded ${
                      isFramework
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isFramework ? tag.toUpperCase().replace('-', ' ') : tag}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Article Content */}
        <SafeHtml
          className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-brand-400 prose-strong:text-white prose-code:text-brand-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700"
          html={article.content}
        />

        {/* Training Assessment */}
        {trainingStatus?.is_training && trainingStatus.has_assessment && article.assessment && (
          <div className="space-y-4">
            {trainingStatus.best_passed && (
              <div className="flex items-center gap-3 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                <div className="p-2 bg-brand-500/20 rounded-lg">
                  <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-400">Training Complete</p>
                  <p className="text-xs text-slate-500">
                    Best score: {trainingStatus.best_score}% ({trainingStatus.attempts} attempt{trainingStatus.attempts !== 1 ? 's' : ''})
                  </p>
                </div>
              </div>
            )}
            <QuizRenderer
              assessment={article.assessment}
              articleSlug={articleSlug}
              onComplete={() => {
                // Refresh training status
                fetch(`/api/portal/kb/${encodeURIComponent(articleSlug)}/training-status`)
                  .then(res => res.ok ? res.json() : null)
                  .then(data => { if (data?.is_training) setTrainingStatus(data) })
                  .catch(() => {})
              }}
            />
          </div>
        )}

        {/* Policy Acknowledgment */}
        {ackStatus?.requires_acknowledgment && (
          <div className={`rounded-xl border p-5 ${
            ackStatus.valid
              ? 'bg-brand-500/5 border-brand-500/20'
              : ackStatus.needs_reack
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-slate-900 border-slate-700'
          }`}>
            {ackStatus.valid ? (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-500/20 rounded-lg">
                  <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-400">Acknowledged</p>
                  <p className="text-xs text-slate-500">
                    You acknowledged this policy on {new Date(ackStatus.acknowledged_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${ackStatus.needs_reack ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
                    <svg className={`h-5 w-5 ${ackStatus.needs_reack ? 'text-amber-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {ackStatus.needs_reack
                        ? 'This policy has been updated — please review'
                        : ackStatus.expired
                          ? 'Your acknowledgment has expired — please review'
                          : 'Please review and acknowledge this policy'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      By acknowledging, you confirm that you have read and understand this policy.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAcknowledge}
                  disabled={ackLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {ackLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                  I&apos;ve read and understand this
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feedback Section */}
        <div className="border-t border-slate-800 pt-6">
          {feedbackSent ? (
            <div className="text-center py-4">
              <p className="text-sm text-brand-400 font-medium">
                Thanks for your feedback!
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {feedbackSent === 'helpful'
                  ? 'Glad this article was helpful.'
                  : 'We\'ll work on improving this article.'}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-slate-300 mb-3">Was this article helpful?</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={feedbackLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 hover:bg-brand-500/20 hover:text-brand-400 text-slate-300 rounded-lg border border-slate-700 hover:border-brand-500/50 transition-colors disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                  </svg>
                  Yes, helpful
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  disabled={feedbackLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 0 1 2.25 12c0-2.848.992-5.464 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />
                  </svg>
                  Not helpful
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Still Need Help */}
        <div className="bg-gradient-to-r from-brand-500/10 to-cyan-500/10 rounded-xl border border-brand-500/20 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Still need help?</h3>
              <p className="text-xs text-slate-400 mt-1">Ask our AI assistant or create a support ticket</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/portal/chat"
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
              >
                Ask AI
              </Link>
              <Link
                href={`/portal/tickets/new?subject=${encodeURIComponent(`Help with: ${article.title}`)}`}
                className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
              >
                Create Ticket
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block w-72 flex-shrink-0 space-y-6">
        {/* Article Stats */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Article Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Views</span>
              <span className="text-white">{(article.view_count || 0).toLocaleString()}</span>
            </div>
            {article.helpful_ratio !== null && (
              <div className="flex justify-between">
                <span className="text-slate-500">Helpful</span>
                <span className="text-white">{article.helpful_ratio}%</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Published</span>
              <span className="text-white">{formatDate(article.published_at || article.updated_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Updated</span>
              <span className="text-white">{formatDate(article.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Related Articles</h3>
            <div className="space-y-3">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/portal/kb/${related.category_slug || slug}/${related.slug}`}
                  className="block text-sm text-slate-300 hover:text-brand-400 transition-colors"
                >
                  {related.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
