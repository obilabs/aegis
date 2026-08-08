'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpenIcon,
  ChevronRightIcon,
  ClockIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowLeftIcon,
  ShareIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline'
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from '@heroicons/react/24/solid'

interface KBArticle {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  category_id: string
  category_name: string
  category_slug: string
  view_count: number
  helpful_count: number
  not_helpful_count: number
  published_at: string
  updated_at: string
}

interface RelatedArticle {
  id: string
  title: string
  slug: string
  summary: string
}

export default function PublicArticlePage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [article, setArticle] = useState<KBArticle | null>(null)
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  useEffect(() => {
    fetchArticle()
  }, [slug])

  const fetchArticle = async () => {
    try {
      const res = await fetch(`/api/kb/public/article/${slug}`)
      if (res.ok) {
        const data = await res.json()
        setArticle(data.article)
        setRelatedArticles(data.relatedArticles || [])
      }
    } catch (error) {
      console.error('Failed to fetch article:', error)
    } finally {
      setLoading(false)
    }
  }

  const submitFeedback = async (isHelpful: boolean) => {
    if (feedbackSubmitted || !article) return

    setFeedback(isHelpful ? 'helpful' : 'not_helpful')
    setFeedbackSubmitted(true)

    try {
      await fetch(`/api/kb/public/article/${slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_helpful: isHelpful }),
      })
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: article?.title,
        url: window.location.href,
      })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300">
        <header className="bg-slate-900 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/kb" className="flex items-center gap-2">
              <BookOpenIcon className="h-8 w-8 text-brand-400" />
              <span className="text-xl font-bold text-slate-100">Knowledge Base</span>
            </Link>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-4">Article Not Found</h1>
          <p className="text-slate-400 mb-8">
            This article may have been moved or is no longer available.
          </p>
          <Link
            href="/kb"
            className="inline-flex items-center gap-2 text-brand-400 hover:text-brand-300"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Knowledge Base
          </Link>
        </div>
      </div>
    )
  }

  const helpfulRatio = article.helpful_count + article.not_helpful_count > 0
    ? Math.round((article.helpful_count / (article.helpful_count + article.not_helpful_count)) * 100)
    : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/kb" className="flex items-center gap-2">
            <BookOpenIcon className="h-8 w-8 text-brand-400" />
            <span className="text-xl font-bold text-slate-100">Knowledge Base</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
              title="Share"
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
              title="Print"
            >
              <PrinterIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-slate-900/50 border-b border-slate-800 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/kb" className="hover:text-brand-400">
              Knowledge Base
            </Link>
            <ChevronRightIcon className="h-4 w-4" />
            <Link href={`/kb/category/${article.category_slug}`} className="hover:text-brand-400">
              {article.category_name}
            </Link>
            <ChevronRightIcon className="h-4 w-4" />
            <span className="text-slate-300 truncate max-w-[200px]">{article.title}</span>
          </nav>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-4">{article.title}</h1>
          {article.summary && (
            <p className="text-lg text-slate-400">{article.summary}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              Updated {new Date(article.updated_at).toLocaleDateString()}
            </span>
            <span>{article.view_count} views</span>
            {helpfulRatio !== null && (
              <span className="flex items-center gap-1">
                <HandThumbUpIcon className="h-4 w-4" />
                {helpfulRatio}% found this helpful
              </span>
            )}
          </div>
        </header>

        {/* Article Body */}
        <div 
          className="prose prose-invert prose-emerald max-w-none
            prose-headings:text-slate-100 
            prose-p:text-slate-300 
            prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-slate-200
            prose-code:text-brand-400 prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700
            prose-blockquote:border-brand-500 prose-blockquote:text-slate-400
            prose-li:text-slate-300
            prose-hr:border-slate-700"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Feedback Section */}
        <div className="mt-12 pt-8 border-t border-slate-800 print:hidden">
          <div className="bg-slate-900 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Was this article helpful?
            </h3>
            {!feedbackSubmitted ? (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => submitFeedback(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-500/10 border border-brand-500/30 rounded-lg text-brand-400 hover:bg-brand-500/20 transition-colors"
                >
                  <HandThumbUpIcon className="h-5 w-5" />
                  Yes, helpful
                </button>
                <button
                  onClick={() => submitFeedback(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors"
                >
                  <HandThumbDownIcon className="h-5 w-5" />
                  No, not helpful
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-brand-400">
                {feedback === 'helpful' ? (
                  <HandThumbUpSolid className="h-5 w-5" />
                ) : (
                  <HandThumbDownSolid className="h-5 w-5" />
                )}
                <span>Thank you for your feedback!</span>
              </div>
            )}
          </div>
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-8 print:hidden">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Related Articles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/kb/${related.slug}`}
                  className="group bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-brand-500/50 transition-all"
                >
                  <h4 className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors">
                    {related.title}
                  </h4>
                  {related.summary && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{related.summary}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 mt-12 print:hidden">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>Still need help?</p>
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
