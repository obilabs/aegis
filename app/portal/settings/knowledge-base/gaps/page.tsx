'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  LightBulbIcon,
  DocumentPlusIcon,
  EyeIcon,
  XMarkIcon,
  LinkIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface KbGap {
  id: string
  topic: string
  occurrence_count: number
  sample_questions: string[]
  search_queries: string[]
  status: 'open' | 'draft_created' | 'resolved' | 'dismissed'
  draft_article_id: string | null
  draft_article_title: string | null
  first_seen_at: string
  last_seen_at: string
}

interface GapStats {
  total_open: number
  total_draft_created: number
  total_resolved: number
  total_dismissed: number
}

interface KbArticle {
  id: string
  title: string
  slug: string
  status: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className: 'bg-amber-500/20 text-amber-400',
  },
  draft_created: {
    label: 'Draft Created',
    className: 'bg-blue-500/20 text-blue-400',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-brand-500/20 text-brand-400',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-slate-600/40 text-slate-400',
  },
}

export default function KbGapsPage() {
  const [gaps, setGaps] = useState<KbGap[]>([])
  const [stats, setStats] = useState<GapStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [linkModalGap, setLinkModalGap] = useState<KbGap | null>(null)
  const [articles, setArticles] = useState<KbArticle[]>([])
  const [articleSearch, setArticleSearch] = useState('')
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [expandedGap, setExpandedGap] = useState<string | null>(null)

  const fetchGaps = async (statusFilter?: string) => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '100')

      const res = await fetch(`/api/settings/knowledge-base/gaps?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setGaps(data.data || [])
          setStats(data.stats || null)
        }
      }
    } catch (error) {
      console.error('Failed to fetch KB gaps:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGaps(filter || undefined)
  }, [filter])

  const handleAction = async (gapId: string, action: string, articleId?: string) => {
    setActionInProgress(gapId)
    try {
      const body: Record<string, string> = { action }
      if (articleId) body.article_id = articleId

      const res = await fetch(`/api/settings/knowledge-base/gaps/${gapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        // Refresh the list
        await fetchGaps(filter || undefined)
        setLinkModalGap(null)
      }
    } catch (error) {
      console.error('Failed to perform action:', error)
    } finally {
      setActionInProgress(null)
    }
  }

  const searchArticles = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setArticles([])
      return
    }

    setLoadingArticles(true)
    try {
      const res = await fetch(`/api/kb/articles?search=${encodeURIComponent(searchQuery)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.data || data.articles || [])
      }
    } catch {
      // Swallow
    } finally {
      setLoadingArticles(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (articleSearch) searchArticles(articleSearch)
    }, 300)
    return () => clearTimeout(timeout)
  }, [articleSearch])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Link href="/portal/settings" className="hover:text-brand-400 flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" />
            Settings
          </Link>
          <span>/</span>
          <Link href="/portal/settings/knowledge-base" className="hover:text-brand-400">
            Knowledge Base
          </Link>
          <span>/</span>
          <span className="text-slate-200">KB Gaps</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <LightBulbIcon className="h-7 w-7 text-amber-400" />
          KB Gap Detection
        </h1>
        <p className="text-slate-400 mt-1">
          Topics users ask about that are not covered by existing knowledge base articles.
        </p>
      </div>

      {/* Stats Banner */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-500">Open Gaps</p>
            <p className="text-2xl font-bold text-amber-400">{stats.total_open}</p>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-500">Drafts Created</p>
            <p className="text-2xl font-bold text-blue-400">{stats.total_draft_created}</p>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-500">Resolved</p>
            <p className="text-2xl font-bold text-brand-400">{stats.total_resolved}</p>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-500">Dismissed</p>
            <p className="text-2xl font-bold text-slate-400">{stats.total_dismissed}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-1">
        {[
          { value: '', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'draft_created', label: 'Drafts' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'dismissed', label: 'Dismissed' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.value
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gaps Table */}
      {gaps.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <LightBulbIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No KB Gaps Found</h3>
          <p className="text-slate-500">
            {filter
              ? `No gaps with status "${filter}".`
              : 'When users ask questions that the AI cannot answer from the knowledge base, gaps will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                  Topic
                </th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 w-24">
                  Count
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 w-28">
                  First Seen
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 w-28">
                  Last Seen
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 w-32">
                  Status
                </th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 w-44">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {gaps.map((gap) => {
                const config = statusConfig[gap.status] || statusConfig.open
                const isExpanded = expandedGap === gap.id
                return (
                  <tr key={gap.id} className="group">
                    <td className="px-4 py-3">
                      <div>
                        <button
                          onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
                          className="flex items-center gap-1.5 text-left"
                        >
                          <ChevronDownIcon
                            className={`h-4 w-4 text-slate-500 transition-transform flex-shrink-0 ${
                              isExpanded ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <span className="font-medium text-slate-200">{gap.topic}</span>
                        </button>
                        {isExpanded && gap.sample_questions && gap.sample_questions.length > 0 && (
                          <div className="mt-2 ml-5 space-y-1">
                            <p className="text-xs text-slate-500 font-medium">Sample Questions:</p>
                            {gap.sample_questions.map((q, i) => (
                              <p key={i} className="text-xs text-slate-400 pl-2 border-l border-slate-700">
                                {q}
                              </p>
                            ))}
                          </div>
                        )}
                        {gap.draft_article_title && (
                          <p className="text-xs text-blue-400 mt-1 ml-5">
                            Draft: {gap.draft_article_title}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-sm font-medium ${
                        gap.occurrence_count >= 10
                          ? 'bg-red-500/20 text-red-400'
                          : gap.occurrence_count >= 5
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {gap.occurrence_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {formatDate(gap.first_seen_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {formatDate(gap.last_seen_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${config.className}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {gap.status === 'open' && (
                          <>
                            <button
                              onClick={() => handleAction(gap.id, 'create_draft')}
                              disabled={actionInProgress === gap.id}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                              title="Create Draft Article"
                            >
                              <DocumentPlusIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setLinkModalGap(gap)
                                setArticleSearch('')
                                setArticles([])
                              }}
                              disabled={actionInProgress === gap.id}
                              className="p-1.5 text-brand-400 hover:bg-brand-500/10 rounded transition-colors"
                              title="Link Existing Article"
                            >
                              <LinkIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAction(gap.id, 'dismiss')}
                              disabled={actionInProgress === gap.id}
                              className="p-1.5 text-slate-400 hover:bg-slate-700 rounded transition-colors"
                              title="Dismiss"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {gap.status === 'draft_created' && gap.draft_article_id && (
                          <Link
                            href={`/portal/kb/edit/${gap.draft_article_id}`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            View Draft
                          </Link>
                        )}
                        {gap.status === 'resolved' && gap.draft_article_id && (
                          <Link
                            href={`/portal/kb/edit/${gap.draft_article_id}`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-brand-400 hover:bg-brand-500/10 rounded transition-colors"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                            View Article
                          </Link>
                        )}
                        {actionInProgress === gap.id && (
                          <ArrowPathIcon className="h-4 w-4 text-slate-400 animate-spin" />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Link Article Modal */}
      {linkModalGap && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-lg">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">Link Existing Article</h3>
                <button
                  onClick={() => setLinkModalGap(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Link gap &ldquo;{linkModalGap.topic}&rdquo; to an existing KB article.
              </p>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {loadingArticles && (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="h-5 w-5 text-slate-400 animate-spin" />
                  </div>
                )}
                {!loadingArticles && articles.length === 0 && articleSearch && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No articles found for &ldquo;{articleSearch}&rdquo;
                  </p>
                )}
                {articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => handleAction(linkModalGap.id, 'link_article', article.id)}
                    disabled={actionInProgress === linkModalGap.id}
                    className="w-full text-left p-3 rounded-lg border border-slate-700 hover:border-brand-500/50 hover:bg-slate-900 transition-all"
                  >
                    <p className="text-sm font-medium text-slate-200">{article.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {article.status === 'published' ? 'Published' : 'Draft'} &middot; /{article.slug}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
