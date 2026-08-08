'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AcademicCapIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface TrainingArticle {
  id: string
  title: string
  slug: string
  category_slug: string
  passing_score: number
  best_score: number | null
  passed: boolean
  attempts: number
}

interface TrainingProgress {
  total: number
  completed: number
  percentage: number
  articles: TrainingArticle[]
}

export function TrainingProgressWidget() {
  const [data, setData] = useState<TrainingProgress | null>(null)

  useEffect(() => {
    fetch('/api/portal/dashboard/training-progress')
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d && d.total > 0) setData(d) })
      .catch(() => {})
  }, [])

  if (!data || data.total === 0) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <AcademicCapIcon className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Training</h3>
            <p className="text-xs text-slate-500">
              {data.completed} of {data.total} courses complete
            </p>
          </div>
        </div>
        <span className="text-lg font-bold text-slate-100">{data.percentage}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            data.percentage === 100 ? 'bg-brand-500' : 'bg-purple-500'
          }`}
          style={{ width: `${data.percentage}%` }}
        />
      </div>
      <div className="space-y-2">
        {data.articles.slice(0, 3).map((article) => (
          <Link
            key={article.id}
            href={`/portal/kb/${article.category_slug || 'training'}/${article.slug}`}
            className="flex items-center justify-between gap-2 group"
          >
            <div className="flex items-center gap-2 min-w-0">
              {article.passed ? (
                <CheckCircleIcon className="h-4 w-4 text-brand-400 flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-slate-600 flex-shrink-0" />
              )}
              <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors truncate">
                {article.title}
              </span>
            </div>
            {article.best_score !== null && (
              <span className={`text-xs flex-shrink-0 ${article.passed ? 'text-brand-400' : 'text-amber-400'}`}>
                {Math.round(article.best_score)}%
              </span>
            )}
          </Link>
        ))}
        {data.articles.length > 3 && (
          <Link
            href="/portal/kb/training"
            className="block text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            +{data.articles.length - 3} more
          </Link>
        )}
      </div>
      {data.percentage === 100 && (
        <p className="text-xs text-brand-400 mt-2">All training complete!</p>
      )}
    </div>
  )
}
