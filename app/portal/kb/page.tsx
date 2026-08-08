'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

interface KBCategory {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  article_count: number
}

interface KBArticle {
  id: string
  title: string
  slug: string
  summary: string
  category_name: string
  category_slug: string
  view_count: number
  helpful_ratio: number | null
  updated_at: string
  is_featured?: boolean
}

export default function KnowledgeBasePage() {
  const [categories, setCategories] = useState<KBCategory[]>([])
  const [featuredArticles, setFeaturedArticles] = useState<KBArticle[]>([])
  const [recentArticles, setRecentArticles] = useState<KBArticle[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [canManage, setCanManage] = useState(false)

  useEffect(() => {
    async function fetchKB() {
      try {
        const res = await fetch('/api/portal/kb')
        if (!res.ok) throw new Error('Failed to fetch KB')
        const data = await res.json()
        setCategories(data.categories || [])
        setFeaturedArticles(data.featuredArticles || [])
        setRecentArticles(data.recentArticles || [])
        setCanManage(!!data.can_manage)
      } catch (error) {
        console.error('Error fetching KB:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchKB()
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 3) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/portal/kb/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setSearchResults(data.articles || [])
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
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

  return (
    <div className="space-y-8">
      {/* Header with Search */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
        <p className="text-slate-400 mt-2">Find answers, guides, and documentation</p>

        {canManage && (
          <div className="mt-4">
            <Link
              href="/portal/kb/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Article
            </Link>
          </div>
        )}

        {/* Search */}
        <div className="mt-6 relative">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-5 py-4 pl-12 text-base bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.length >= 3 && (
          <div className="mt-4 text-left bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {searchResults.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {searchResults.map((article) => (
                  <Link
                    key={article.id}
                    href={`/portal/kb/${article.category_slug || 'general'}/${article.slug}`}
                    className="block p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">{article.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{article.category_name}</p>
                    {article.summary && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{article.summary}</p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-400">No articles found for &quot;{searchQuery}&quot;</p>
                <p className="text-sm text-slate-600 mt-1">Try different keywords or browse categories below</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/portal/kb/${category.slug}`}
                className="bg-slate-900 rounded-xl border border-slate-800 p-5 text-center hover:border-brand-500/50 transition-colors group"
              >
                <span className="text-3xl block mb-3">{category.icon || '📄'}</span>
                <h3 className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">{category.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{category.article_count} article{category.article_count !== 1 ? 's' : ''}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Featured Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredArticles.map((article) => (
              <Link
                key={article.id}
                href={`/portal/kb/${article.category_slug || 'general'}/${article.slug}`}
                className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-brand-500/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-3">
                  {article.is_featured && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-brand-500/10 text-brand-400 rounded">Featured</span>
                  )}
                  <span className="text-xs text-slate-500">{article.category_name}</span>
                </div>
                <h3 className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">{article.title}</h3>
                {article.summary && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{article.summary}</p>
                )}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-500">{(article.view_count || 0).toLocaleString()} views</span>
                  {article.helpful_ratio !== null && (
                    <span className="text-xs text-slate-500">{article.helpful_ratio}% helpful</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Articles */}
      {recentArticles.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recently Updated</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
            {recentArticles.map((article) => (
              <Link
                key={article.id}
                href={`/portal/kb/${article.category_slug || 'general'}/${article.slug}`}
                className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500">{article.category_name}</span>
                  <h3 className="text-sm font-medium text-white mt-1">{article.title}</h3>
                  {article.summary && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{article.summary}</p>
                  )}
                </div>
                <div className="ml-4 text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">{formatDate(article.updated_at)}</p>
                  <p className="text-xs text-slate-600 mt-1">{(article.view_count || 0).toLocaleString()} views</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {categories.length === 0 && featuredArticles.length === 0 && (
        <div className="text-center py-12">
          <svg className="h-16 w-16 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300">No articles yet</h3>
          <p className="text-sm text-slate-500 mt-1">Knowledge base articles will appear here once published</p>
        </div>
      )}

      {/* Quick Help */}
      <div className="bg-gradient-to-r from-brand-500/10 to-cyan-500/10 rounded-xl border border-brand-500/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Can&apos;t find what you&apos;re looking for?</h3>
            <p className="text-sm text-slate-400 mt-1">Ask our AI assistant or submit a support ticket</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/chat"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
            >
              Ask AI
            </Link>
            <Link
              href="/portal/tickets/new"
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
            >
              Submit Ticket
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
