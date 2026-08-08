'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AcademicCapIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface TrainingRow {
  id: string
  title: string
  slug: string
  tags: string[]
  category_name: string | null
  category_slug: string | null
  passing_score: number
  updated_at: string
  total_assigned: number
  passed_count: number
  pending_count: number
  stale_pass_count: number
  attempts_total: number
  avg_score: number | null
  pass_rate: number
}

interface TrainingData {
  articles: TrainingRow[]
  summary: {
    total_articles: number
    total_assigned: number
    total_passed: number
    overall_pass_rate: number
  }
}

export default function TrainingReportPage() {
  const [data, setData] = useState<TrainingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/reports/training')
      .then(res => {
        if (res.status === 403) throw new Error('You do not have permission to view reports.')
        if (!res.ok) throw new Error('Failed to load training report.')
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-300">{error}</h2>
        <Link href="/portal/reports" className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300">
          Back to Reports
        </Link>
      </div>
    )
  }

  if (!data || data.summary.total_articles === 0) {
    return (
      <div className="text-center py-16">
        <AcademicCapIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-300">No training articles yet</h2>
        <p className="text-sm text-slate-500 mt-1">
          Training articles with quizzes will appear here once published.
        </p>
        <Link href="/portal/kb/new?type=training" className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300">
          Create a training article
        </Link>
      </div>
    )
  }

  const { summary, articles } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Training & Quizzes</h1>
        <p className="text-slate-400 mt-1">
          Pass rates and attempts across published training articles. &ldquo;Currently passed&rdquo; only counts
          attempts on the current version of each quiz — when a quiz is edited, prior pass states become &ldquo;stale&rdquo;
          and users must retake.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <p className="text-sm text-slate-400">Overall Pass Rate</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{summary.overall_pass_rate}%</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${summary.overall_pass_rate >= 80 ? 'bg-brand-500' : summary.overall_pass_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${summary.overall_pass_rate}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <p className="text-sm text-slate-400">Training Articles</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{summary.total_articles}</p>
          <p className="text-xs text-slate-500 mt-2">Published with quizzes</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <p className="text-sm text-slate-400">Passed / Assigned</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">
            {summary.total_passed}
            <span className="text-lg text-slate-500"> / {summary.total_assigned}</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Across all training articles</p>
        </div>
      </div>

      {/* Per-article table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Training</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Passed</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Pass Rate</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Avg Score</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Attempts</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {articles.map((row) => (
              <tr key={row.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-3 px-4">
                  <Link
                    href={row.category_slug ? `/portal/kb/${row.category_slug}/${row.slug}` : '#'}
                    className="text-slate-200 font-medium hover:text-brand-400 transition-colors"
                  >
                    {row.title}
                  </Link>
                  {row.stale_pass_count > 0 && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <ArrowPathIcon className="h-3 w-3" />
                      {row.stale_pass_count} {row.stale_pass_count === 1 ? 'user' : 'users'} need to retake (quiz updated)
                    </p>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-slate-200">
                    {row.passed_count} / {row.total_assigned}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {row.pass_rate >= 80 ? (
                      <CheckCircleIcon className="h-4 w-4 text-brand-400" />
                    ) : row.pass_rate >= 50 ? (
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-400" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
                    )}
                    <div className="w-20 bg-slate-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${row.pass_rate >= 80 ? 'bg-brand-500' : row.pass_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${row.pass_rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{row.pass_rate}%</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  {row.avg_score !== null ? (
                    <span className={`text-sm ${row.avg_score >= row.passing_score ? 'text-brand-400' : 'text-amber-400'}`}>
                      {row.avg_score}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center text-slate-400">{row.attempts_total}</td>
                <td className="py-3 px-4 text-slate-500 text-xs">
                  {new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
