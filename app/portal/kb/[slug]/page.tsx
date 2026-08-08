'use client'

import Link from 'next/link'
import { useEffect, useState, use } from 'react'

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
  tags?: string[]
  article_type?: string
  requires_acknowledgment?: boolean
}

interface KBCategory {
  name: string
  slug: string
  description: string
  icon: string
}

// Map industry setting values to tag prefixes used in policy articles
const INDUSTRY_TAG_MAP: Record<string, string> = {
  healthcare: 'healthcare',
  finance: 'finance',
  technology: 'technology',
  education: 'education',
  government: 'government',
  legal: 'finance',
  retail: 'pci-dss',
}

export default function KBCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [category, setCategory] = useState<KBCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [orgIndustry, setOrgIndustry] = useState<string | null>(null)
  const isPolicyCategory = slug === 'policies-procedures' || slug === 'policies--procedures'

  useEffect(() => {
    async function fetchCategory() {
      try {
        const res = await fetch(`/api/portal/kb/search?category=${encodeURIComponent(slug)}`)
        if (!res.ok) throw new Error('Failed to fetch category')
        const data = await res.json()
        setArticles(data.articles || [])
        setCategory(data.category || null)
        if (data.org_industry) setOrgIndustry(data.org_industry)
      } catch (error) {
        console.error('Error fetching category:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCategory()
  }, [slug])

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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal/kb" className="hover:text-brand-400 transition-colors">
          Knowledge Base
        </Link>
        <span>/</span>
        <span className="text-white">{category?.name || slug}</span>
      </nav>

      {/* Category Header */}
      <div className="flex items-center gap-4">
        {category?.icon && (
          <span className="text-4xl">{category.icon}</span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{category?.name || slug}</h1>
          {category?.description && (
            <p className="text-slate-400 mt-1">{category.description}</p>
          )}
          <p className="text-sm text-slate-500 mt-1">
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Industry filter toggle for policy categories */}
      {isPolicyCategory && orgIndustry && orgIndustry !== 'other' && articles.some(a => a.tags && a.tags.length > 0) && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              showAll
                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                : 'bg-brand-500/10 border-brand-500/30 text-brand-400'
            }`}
          >
            {showAll ? 'Show recommended' : `Showing recommended for ${orgIndustry}`}
          </button>
          {!showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Show all policies
            </button>
          )}
        </div>
      )}

      {/* Articles List */}
      {articles.length > 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
          {(isPolicyCategory && orgIndustry && !showAll
            ? // Sort: universal policies first, then industry-relevant, then others
              [...articles].sort((a, b) => {
                const industryTag = INDUSTRY_TAG_MAP[orgIndustry] || orgIndustry
                const aHasIndustry = a.tags?.some(t => t === industryTag) ?? false
                const bHasIndustry = b.tags?.some(t => t === industryTag) ?? false
                const aIsUniversal = !a.tags || a.tags.length === 0 || !a.tags.some(t => Object.values(INDUSTRY_TAG_MAP).includes(t) || ['healthcare', 'finance', 'government'].includes(t))
                const bIsUniversal = !b.tags || b.tags.length === 0 || !b.tags.some(t => Object.values(INDUSTRY_TAG_MAP).includes(t) || ['healthcare', 'finance', 'government'].includes(t))
                // Universal and industry-relevant first
                const aRelevant = aIsUniversal || aHasIndustry
                const bRelevant = bIsUniversal || bHasIndustry
                if (aRelevant && !bRelevant) return -1
                if (!aRelevant && bRelevant) return 1
                return 0
              })
            : articles
          ).map((article) => {
            const frameworkTags = (article.tags || []).filter(t =>
              ['nist-csf', 'soc2', 'hipaa', 'pci-dss', 'itil4'].includes(t)
            )
            return (
            <Link
              key={article.id}
              href={`/portal/kb/${slug}/${article.slug}`}
              className="flex items-center justify-between p-5 hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">
                    {article.title}
                  </h3>
                  {article.requires_acknowledgment && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-400 rounded font-medium">Policy</span>
                  )}
                </div>
                {article.summary && (
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{article.summary}</p>
                )}
                {frameworkTags.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {frameworkTags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-500 rounded">
                        {tag.toUpperCase().replace('-', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-6 text-right flex-shrink-0 space-y-1">
                <p className="text-xs text-slate-500">{formatDate(article.updated_at)}</p>
                <div className="flex items-center gap-3 justify-end">
                  <span className="text-xs text-slate-600">{(article.view_count || 0).toLocaleString()} views</span>
                  {article.helpful_ratio !== null && (
                    <span className="text-xs text-slate-600">{article.helpful_ratio}% helpful</span>
                  )}
                </div>
              </div>
            </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
          <svg className="h-12 w-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-300">No articles in this category</h3>
          <p className="text-xs text-slate-500 mt-1">Articles will appear here once published</p>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gradient-to-r from-brand-500/10 to-cyan-500/10 rounded-xl border border-brand-500/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Can&apos;t find what you&apos;re looking for?</h3>
            <p className="text-xs text-slate-400 mt-1">Ask our AI assistant or submit a support ticket</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/chat"
              className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
            >
              Ask AI
            </Link>
            <Link
              href="/portal/tickets/new"
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
            >
              Submit Ticket
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
