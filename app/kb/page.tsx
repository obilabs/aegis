'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  FolderIcon,
  ChevronRightIcon,
  SparklesIcon,
  ClockIcon,
  HandThumbUpIcon,
} from '@heroicons/react/24/outline'

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
  view_count: number
  helpful_ratio: number | null
  published_at: string
}

export default function PublicKnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<KBCategory[]>([])
  const [featuredArticles, setFeaturedArticles] = useState<KBArticle[]>([])
  const [searchResults, setSearchResults] = useState<KBArticle[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublicKB()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        searchArticles(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [searchQuery])

  const fetchPublicKB = async () => {
    try {
      const res = await fetch('/api/kb/public')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
        setFeaturedArticles(data.featuredArticles || [])
      }
    } catch (error) {
      console.error('Failed to fetch KB:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchArticles = async (query: string) => {
    setIsSearching(true)
    try {
      const res = await fetch(`/api/kb/public/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.articles || [])
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const getCategoryIcon = (iconName: string) => {
    // Map icon names to components
    const icons: Record<string, any> = {
      'rocket': '🚀',
      'book-open': '📖',
      'wrench': '🔧',
      'help-circle': '❓',
      'file-text': '📄',
      'shield': '🛡️',
    }
    return icons[iconName] || '📁'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BookOpenIcon className="h-8 w-8 text-brand-400" />
            <span className="text-xl font-bold text-slate-100">Knowledge Base</span>
          </Link>
          <Link
            href="/portal/login"
            className="text-sm text-slate-400 hover:text-brand-400 transition-colors"
          >
            Sign In →
          </Link>
        </div>
      </header>

      {/* Hero / Search */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-slate-100 mb-4">
            How can we help you?
          </h1>
          <p className="text-slate-400 mb-8">
            Search our knowledge base for answers to common questions
          </p>

          {/* Search Box */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search for articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-lg"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden text-left">
              {searchResults.map((article) => (
                <Link
                  key={article.id}
                  href={`/kb/${article.slug}`}
                  className="block px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
                >
                  <div className="font-medium text-slate-200">{article.title}</div>
                  <div className="text-sm text-slate-400 mt-1 line-clamp-1">
                    {article.summary}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="mt-4 text-slate-500">
              No articles found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-slate-100 mb-6">Browse by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/kb/category/${category.slug}`}
              className="group bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-brand-500/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getCategoryIcon(category.icon)}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-100 group-hover:text-brand-400 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{category.description}</p>
                  <div className="text-xs text-slate-500 mt-2">
                    {category.article_count} articles
                  </div>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-slate-600 group-hover:text-brand-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-6">
            <SparklesIcon className="h-6 w-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-slate-100">Popular Articles</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredArticles.map((article) => (
              <Link
                key={article.id}
                href={`/kb/${article.slug}`}
                className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-brand-500/50 transition-all"
              >
                <h3 className="font-semibold text-slate-100 group-hover:text-brand-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                  {article.summary}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <FolderIcon className="h-3.5 w-3.5" />
                    {article.category_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {article.view_count} views
                  </span>
                  {article.helpful_ratio !== null && (
                    <span className="flex items-center gap-1">
                      <HandThumbUpIcon className="h-3.5 w-3.5" />
                      {article.helpful_ratio}% helpful
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>Can't find what you're looking for?</p>
          <Link
            href="/portal/login"
            className="text-brand-400 hover:text-brand-300 mt-2 inline-block"
          >
            Sign in to submit a support ticket →
          </Link>
        </div>
      </footer>
    </div>
  )
}
