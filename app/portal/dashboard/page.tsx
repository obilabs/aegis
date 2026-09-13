'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  TicketIcon,
  ComputerDesktopIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  BellIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  UserPlusIcon,
  UserMinusIcon,
  KeyIcon,
  PlusIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  ClipboardDocumentCheckIcon,
  Squares2X2Icon,
  HomeIcon,
} from '@heroicons/react/24/outline'
import { MyHub } from '@/components/dashboard/MyHub'
import { useFeature } from '@/lib/hooks/useFeatures'

interface ActivityItem {
  id: string
  type: 'ticket_created' | 'ticket_resolved' | 'asset_added' | 'user_onboarded' | 'user_offboarded' | 'access_granted' | 'access_revoked' | 'contract_renewal' | 'kb_published' | 'alert'
  title: string
  description: string
  timestamp: Date
  user?: string
  link?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

interface DashboardStats {
  tickets: {
    open: number
    pending: number
    closedToday: number
    trend: number
  }
  assets: {
    total: number
    deployed: number
    available: number
    maintenance: number
  }
  users: {
    total: number
    active: number
    newThisMonth: number
  }
  requests: {
    total: number
    pending: number
    inProgress: number
    completed: number
  }
  renewals: {
    upcoming: number
    overdue: number
    totalValue: number
  }
}

interface DashboardPreference {
  view: 'my-hub' | 'ops'
  ticket_access: 'own' | 'team' | 'all'
  can_switch: boolean
  user_name: string
  job_title: string | null
}

const emptyStats: DashboardStats = {
  tickets: { open: 0, pending: 0, closedToday: 0, trend: 0 },
  assets: { total: 0, deployed: 0, available: 0, maintenance: 0 },
  users: { total: 0, active: 0, newThisMonth: 0 },
  requests: { total: 0, pending: 0, inProgress: 0, completed: 0 },
  renewals: { upcoming: 0, overdue: 0, totalValue: 0 },
}

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'ticket_created': return { icon: TicketIcon, color: 'text-blue-400', bg: 'bg-blue-500/20' }
    case 'ticket_resolved': return { icon: CheckCircleIcon, color: 'text-brand-400', bg: 'bg-brand-500/20' }
    case 'asset_added': return { icon: ComputerDesktopIcon, color: 'text-purple-400', bg: 'bg-purple-500/20' }
    case 'user_onboarded': return { icon: UserPlusIcon, color: 'text-brand-400', bg: 'bg-brand-500/20' }
    case 'user_offboarded': return { icon: UserMinusIcon, color: 'text-red-400', bg: 'bg-red-500/20' }
    case 'access_granted': return { icon: KeyIcon, color: 'text-brand-400', bg: 'bg-brand-500/20' }
    case 'access_revoked': return { icon: ShieldCheckIcon, color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    case 'contract_renewal': return { icon: CalendarIcon, color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    case 'kb_published': return { icon: BookOpenIcon, color: 'text-blue-400', bg: 'bg-blue-500/20' }
    case 'alert': return { icon: ExclamationTriangleIcon, color: 'text-red-400', bg: 'bg-red-500/20' }
    default: return { icon: BellIcon, color: 'text-slate-400', bg: 'bg-slate-700' }
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DashboardPage() {
  const [pref, setPref] = useState<DashboardPreference | null>(null)
  const [currentView, setCurrentView] = useState<'my-hub' | 'ops'>('my-hub')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityPanelOpen, setActivityPanelOpen] = useState(true)
  const activityRef = useRef<HTMLDivElement>(null)
  const [policyProgress, setPolicyProgress] = useState<{
    total: number
    acknowledged: number
    percentage: number
    unacknowledged: { title: string; slug: string; category_slug: string }[]
  } | null>(null)
  const [banners, setBanners] = useState<{
    id: string; type: string; title: string; description: string; link?: string; linkText?: string
  }[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  // AI is off by default; only point people at the assistant when it is on.
  const { isEnabled: aiChatEnabled } = useFeature('ai_chat')

  // Fetch dashboard preference + permissions first
  useEffect(() => {
    fetch('/api/portal/dashboard/preference')
      .then(res => res.ok ? res.json() : null)
      .then((data: DashboardPreference | null) => {
        if (data) {
          setPref(data)
          setCurrentView(data.view)
        } else {
          setPref({ view: 'my-hub', ticket_access: 'own', can_switch: false, user_name: 'User', job_title: null })
          setCurrentView('my-hub')
        }
      })
      .catch(() => {
        setPref({ view: 'my-hub', ticket_access: 'own', can_switch: false, user_name: 'User', job_title: null })
        setCurrentView('my-hub')
      })
  }, [])

  // Fetch ops dashboard data (only when showing ops view or when user can switch)
  useEffect(() => {
    if (!pref) return
    if (currentView !== 'ops' && !pref.can_switch) {
      setLoading(false)
      return
    }

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/portal/dashboard')
        if (!res.ok) throw new Error('Failed to fetch dashboard')
        const data = await res.json()

        setStats({
          tickets: data.tickets || emptyStats.tickets,
          assets: data.assets || emptyStats.assets,
          users: data.users || emptyStats.users,
          requests: data.requests || emptyStats.requests,
          renewals: emptyStats.renewals,
        })

        setActivity((data.activity || []).map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
          user: a.description,
          link: a.link,
        })))
      } catch (error) {
        console.error('Dashboard fetch error:', error)
        setStats(emptyStats)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()

    // Fetch policy progress and banners for ops view
    fetch('/api/portal/dashboard/policy-progress')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && data.total > 0) setPolicyProgress(data) })
      .catch(() => {})

    fetch('/api/portal/banners')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.banners) setBanners(data.banners) })
      .catch(() => {})

    fetch('/api/portal/requests/approvals?count_only=true')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.count) setPendingApprovals(data.count) })
      .catch(() => {})
  }, [pref, currentView])

  const switchView = (view: 'my-hub' | 'ops') => {
    setCurrentView(view)
    // Persist preference (fire-and-forget)
    fetch('/api/portal/dashboard/preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view }),
    }).catch(() => {})
  }

  const dismissBanner = async (bannerId: string) => {
    setBanners(prev => prev.filter(b => b.id !== bannerId))
    try {
      await fetch('/api/portal/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_id: bannerId }),
      })
    } catch {
      // Dismiss optimistically
    }
  }

  if (!pref) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  // ─── View Toggle Header ────────────────────────────────
  const viewToggle = pref.can_switch && (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg border border-slate-700 p-1">
      <button
        onClick={() => switchView('my-hub')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          currentView === 'my-hub'
            ? 'bg-brand-600 text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <HomeIcon className="h-4 w-4" />
        My Hub
      </button>
      <button
        onClick={() => switchView('ops')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          currentView === 'ops'
            ? 'bg-brand-600 text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Squares2X2Icon className="h-4 w-4" />
        Ops Dashboard
      </button>
    </div>
  )

  // ─── My Hub View ───────────────────────────────────────
  if (currentView === 'my-hub') {
    return (
      <div className="space-y-6">
        {/* View toggle for users who can switch */}
        {viewToggle && (
          <div className="flex justify-end">{viewToggle}</div>
        )}

        {/* Onboarding Banners */}
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="relative bg-gradient-to-r from-brand-500/10 to-cyan-500/10 rounded-lg border border-brand-500/20 p-4 flex items-center gap-4"
          >
            <div className="p-2 bg-brand-500/20 rounded-lg flex-shrink-0">
              <DocumentTextIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{banner.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{banner.description}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {banner.link && (
                <Link
                  href={banner.link}
                  className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
                >
                  {banner.linkText || 'View'}
                </Link>
              )}
              <button
                onClick={() => dismissBanner(banner.id)}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        <MyHub
          userName={pref.user_name}
          jobTitle={pref.job_title || undefined}
        />
      </div>
    )
  }

  // ─── Ops Dashboard View ────────────────────────────────
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back! Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          {viewToggle}
          <Link
            href="/portal/tickets/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Ticket
          </Link>
        </div>
      </div>

      {/* Onboarding Banners */}
      {banners.map((banner) => (
        <div
          key={banner.id}
          className="relative bg-gradient-to-r from-brand-500/10 to-cyan-500/10 rounded-lg border border-brand-500/20 p-4 flex items-center gap-4"
        >
          <div className="p-2 bg-brand-500/20 rounded-lg flex-shrink-0">
            <DocumentTextIcon className="h-5 w-5 text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">{banner.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{banner.description}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {banner.link && (
              <Link
                href={banner.link}
                className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
              >
                {banner.linkText || 'View'}
              </Link>
            )}
            <button
              onClick={() => dismissBanner(banner.id)}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Open Incidents */}
            <Link href="/portal/tickets" className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-hidden hover:border-slate-600 transition-colors block">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                  <TicketIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${stats.tickets.trend > 0 ? 'text-red-400' : 'text-brand-400'}`}>
                  {stats.tickets.trend > 0 ? (
                    <ArrowTrendingUpIcon className="h-3 w-3" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-3 w-3" />
                  )}
                  {Math.abs(stats.tickets.trend)}%
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-100">{stats.tickets.open}</p>
              <p className="text-sm text-slate-400 truncate">Open Incidents</p>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <span className="text-yellow-400 whitespace-nowrap">{stats.tickets.pending} pending</span>
                <span className="text-slate-500 hidden sm:inline">&bull;</span>
                <span className="text-brand-400 whitespace-nowrap">{stats.tickets.closedToday} closed today</span>
              </div>
            </Link>

            {/* Service Requests */}
            <Link href="/portal/requests" className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-hidden hover:border-slate-600 transition-colors block">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg flex-shrink-0">
                  <InboxIcon className="h-5 w-5 text-cyan-400" />
                </div>
                {stats.requests.pending > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded whitespace-nowrap">
                    {stats.requests.pending} pending
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100">{stats.requests.total}</p>
              <p className="text-sm text-slate-400 truncate">Service Requests</p>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <span className="text-purple-400 whitespace-nowrap">{stats.requests.inProgress} in progress</span>
                <span className="text-slate-500 hidden sm:inline">&bull;</span>
                <span className="text-brand-400 whitespace-nowrap">{stats.requests.completed} completed</span>
              </div>
            </Link>

            {/* Assets */}
            <Link href="/portal/assets" className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-hidden hover:border-slate-600 transition-colors block">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg flex-shrink-0">
                  <ComputerDesktopIcon className="h-5 w-5 text-purple-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-100">{stats.assets.total}</p>
              <p className="text-sm text-slate-400 truncate">Total Assets</p>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <span className="text-brand-400 whitespace-nowrap">{stats.assets.available} available</span>
                <span className="text-slate-500 hidden sm:inline">&bull;</span>
                <span className="text-yellow-400 whitespace-nowrap">{stats.assets.maintenance} maint.</span>
              </div>
            </Link>

            {/* Renewals */}
            <Link href="/portal/services" className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-hidden hover:border-slate-600 transition-colors block">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
                  <CalendarIcon className="h-5 w-5 text-yellow-400" />
                </div>
                {stats.renewals.overdue > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded whitespace-nowrap">
                    {stats.renewals.overdue} overdue
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100">{stats.renewals.upcoming}</p>
              <p className="text-sm text-slate-400 truncate">Upcoming Renewals</p>
              <div className="mt-2 text-xs text-slate-500 truncate">
                ${stats.renewals.totalValue.toLocaleString()} total value
              </div>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/portal/tickets" className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors group overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors flex-shrink-0">
                  <TicketIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors truncate">Incidents</p>
                  <p className="text-xs text-slate-500 truncate">Report issues</p>
                </div>
              </div>
            </Link>
            <Link href="/portal/requests" className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors group overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors flex-shrink-0">
                  <InboxIcon className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors truncate">Requests</p>
                  <p className="text-xs text-slate-500 truncate">Request services</p>
                </div>
              </div>
            </Link>
            <Link href="/portal/assets" className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors group overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors flex-shrink-0">
                  <ComputerDesktopIcon className="h-5 w-5 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors truncate">Assets</p>
                  <p className="text-xs text-slate-500 truncate">Manage inventory</p>
                </div>
              </div>
            </Link>
            <Link href="/portal/kb" className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors group overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:bg-yellow-500/30 transition-colors flex-shrink-0">
                  <BookOpenIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors truncate">Knowledge</p>
                  <p className="text-xs text-slate-500 truncate">Browse articles</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Alerts & Notifications */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Attention Required</h3>
            </div>
            <div className="space-y-3">
              {stats.renewals.overdue > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-400">{stats.renewals.overdue} contract(s) overdue for renewal</p>
                    <p className="text-xs text-slate-500">Immediate action required</p>
                  </div>
                  <Link href="/portal/services" className="text-xs text-red-400 hover:underline">Review</Link>
                </div>
              )}
              {stats.renewals.upcoming > 0 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-400">{stats.renewals.upcoming} contract(s) renewing soon</p>
                    <p className="text-xs text-slate-500">Within the next 90 days</p>
                  </div>
                  <Link href="/portal/services" className="text-xs text-yellow-400 hover:underline">Review</Link>
                </div>
              )}
              {stats.tickets.open > 20 && (
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <TicketIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-400">High ticket volume</p>
                    <p className="text-xs text-slate-500">{stats.tickets.open} open tickets in queue</p>
                  </div>
                  <Link href="/portal/tickets" className="text-xs text-blue-400 hover:underline">Manage</Link>
                </div>
              )}
              {pendingApprovals > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-400">Pending Approvals ({pendingApprovals})</p>
                    <p className="text-xs text-slate-500">Service requests awaiting your approval</p>
                  </div>
                  <Link href="/portal/requests/approvals" className="text-xs text-amber-400 hover:underline">Review</Link>
                </div>
              )}
            </div>
          </div>

          {/* Policy Review Progress */}
          {policyProgress && policyProgress.total > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-500/20 rounded-lg">
                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Policy Review</h3>
                    <p className="text-xs text-slate-500">
                      {policyProgress.acknowledged} of {policyProgress.total} policies reviewed
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-slate-100">{policyProgress.percentage}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    policyProgress.percentage === 100 ? 'bg-brand-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${policyProgress.percentage}%` }}
                />
              </div>
              {policyProgress.percentage < 100 && policyProgress.unacknowledged.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500 font-medium">Pending review:</p>
                  {policyProgress.unacknowledged.slice(0, 3).map((policy) => (
                    <Link
                      key={policy.slug}
                      href={`/portal/kb/${policy.category_slug}/${policy.slug}`}
                      className="block text-xs text-brand-400 hover:text-indigo-300 transition-colors truncate"
                    >
                      {policy.title}
                    </Link>
                  ))}
                  {policyProgress.unacknowledged.length > 3 && (
                    <Link
                      href="/portal/kb/policies-procedures"
                      className="block text-xs text-slate-500 hover:text-slate-400 transition-colors"
                    >
                      +{policyProgress.unacknowledged.length - 3} more
                    </Link>
                  )}
                </div>
              )}
              {policyProgress.percentage === 100 && (
                <p className="text-xs text-brand-400">All policies reviewed — you&apos;re up to date!</p>
              )}
            </div>
          )}

          {/* AI Assistant Prompt (only when the AI chat feature is enabled) */}
          {aiChatEnabled && (
          <div className="bg-gradient-to-r from-brand-500/10 to-teal-500/10 rounded-lg border border-brand-500/30 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-500/20 rounded-xl">
                <SparklesIcon className="h-6 w-6 text-brand-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-100">AI Assistant</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Need help? Ask our AI assistant for quick answers, troubleshooting steps, or to find documentation.
                </p>
                <Link
                  href="/portal/chat"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors text-sm"
                >
                  Start Chat
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Activity Feed Sidebar - Collapsible */}
        <div className={`hidden xl:block flex-shrink-0 transition-all duration-300 ${activityPanelOpen ? 'w-80' : 'w-12'}`}>
          <div className="bg-slate-800 rounded-lg border border-slate-700 sticky top-6 overflow-hidden">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
              {activityPanelOpen && (
                <>
                  <h3 className="font-semibold text-slate-100 text-sm">Recent Activity</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
                      <span className="text-xs text-slate-500">Live</span>
                    </div>
                  </div>
                </>
              )}
              <button
                onClick={() => setActivityPanelOpen(!activityPanelOpen)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title={activityPanelOpen ? 'Collapse' : 'Expand'}
              >
                {activityPanelOpen ? (
                  <ChevronRightIcon className="h-4 w-4" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4" />
                )}
              </button>
            </div>

            {activityPanelOpen ? (
              <>
                <div ref={activityRef} className="max-h-[calc(100vh-240px)] overflow-y-auto">
                  <div className="divide-y divide-slate-700">
                    {activity.map((item) => {
                      const { icon: Icon, color } = getActivityIcon(item.type)
                      const Wrapper = item.link ? Link : 'div'
                      const wrapperProps = item.link ? { href: item.link } : {}

                      return (
                        <Wrapper key={item.id} {...wrapperProps as any} className="block p-3 hover:bg-slate-700/50 transition-colors cursor-pointer">
                          <div className="flex gap-3">
                            <Icon className={`h-5 w-5 ${color} flex-shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-600">{formatTimeAgo(item.timestamp)}</span>
                                {item.priority === 'high' && (
                                  <span className="px-1 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">High</span>
                                )}
                                {item.priority === 'critical' && (
                                  <span className="px-1 py-0.5 text-xs bg-red-500/30 text-red-300 rounded">Critical</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Wrapper>
                      )
                    })}
                  </div>
                </div>

                <div className="p-3 border-t border-slate-700">
                  <Link
                    href="/portal/activity"
                    className="block text-center text-sm text-brand-400 hover:underline"
                  >
                    View all activity
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-2">
                {activity.slice(0, 8).map((item) => {
                  const { icon: Icon, color } = getActivityIcon(item.type)
                  const ColWrapper = item.link ? Link : 'div'
                  const colProps = item.link ? { href: item.link } : {}
                  return (
                    <ColWrapper key={item.id} {...colProps as any} className="block px-2 py-1.5 flex justify-center hover:bg-slate-700/50 transition-colors" title={item.title}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </ColWrapper>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
