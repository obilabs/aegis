'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpenIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  ClockIcon,
  HandThumbUpIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

interface KBArticle {
  id: string
  title: string
  slug: string
  summary: string
  category_name: string
  category_slug: string
  view_count: number
  helpful_ratio: number | null
  published_at: string
}

export default function PublicCategoryPage() {
  const params = useParams()
  const slug = params.slug as string

  const [articles, setArticles] = useState<KBArticle[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategoryArticles()
  }, [slug])

  const fetchCategoryArticles = async () => {
    try {
      // Fetch category name from public KB index
      const kbRes = await fetch('/api/kb/public')
      if (kbRes.ok) {
        const kbData = await kbRes.json()
        const cat = (kbData.categories || []).find((c: { slug: string }) => c.slug === slug)
        if (cat) setCategoryName(cat.name)
      }

      // Fetch articles in this category (no search query, just category filter)
      const res = await fetch(`/api/kb/public/search?category=${encodeURIComponent(slug)}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.articles || [])
        // Fallback: get category name from first article if not set
        if (!categoryName && data.articles?.length > 0) {
          setCategoryName(data.articles[0].category_name)
        }
      }
    } catch (error) {
      console.error('Failed to fetch category:', error)
    } finally {
      setLoading(false)
    }
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
          <Link href="/kb" className="flex items-center gap-2">
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

      {/* Breadcrumb */}
      <div className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/kb" className="hover:text-brand-400">
              Knowledge Base
            </Link>
            <ChevronRightIcon className="h-4 w-4" />
            <span className="text-slate-300">{categoryName || slug}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100">{categoryName || slug}</h1>
          <Link
            href="/kb"
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-brand-400 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            All Categories
          </Link>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16">
            <MagnifyingGlassIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-slate-300 mb-2">No Articles Found</h2>
            <p className="text-slate-500 mb-6">
              This category doesn't have any published articles yet.
            </p>
            <Link
              href="/kb"
              className="inline-flex items-center gap-2 text-brand-400 hover:text-brand-300"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Knowledge Base
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/kb/${article.slug}`}
                className="group block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-brand-500/50 transition-all"
              >
                <h3 className="font-semibold text-slate-100 group-hover:text-brand-400 transition-colors">
                  {article.title}
                </h3>
                {article.summary && (
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                    {article.summary}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
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
        )}
      </div>

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
