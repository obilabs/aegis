'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  UserPlusIcon,
  UserMinusIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ChartBarIcon,
  EyeIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface HRStats {
  headcount: {
    total: number
    active: number
    onLeave: number
    contractors: number
  }
  onboarding: {
    pending: number
    inProgress: number
    completedThisMonth: number
  }
  offboarding: {
    pending: number
    inProgress: number
    completedThisMonth: number
  }
  compliance: {
    overallPercentage: number
    pendingAcknowledgments: number
    overdueAcknowledgments: number
  }
  growth: {
    thisMonth: number
    lastMonth: number
    trend: number
  }
}

interface OnboardingItem {
  id: string
  name: string
  department: string
  jobTitle: string
  startDate: string
  status: 'pending' | 'in_progress' | 'completed'
  tasksCompleted: number
  totalTasks: number
  manager: string
}

interface DepartmentData {
  name: string
  headcount: number
  percentage: number
  color: string
}

interface LocationData {
  name: string
  headcount: number
  percentage: number
}

const mockStats: HRStats = {
  headcount: {
    total: 188,
    active: 175,
    onLeave: 8,
    contractors: 5,
  },
  onboarding: {
    pending: 3,
    inProgress: 2,
    completedThisMonth: 5,
  },
  offboarding: {
    pending: 1,
    inProgress: 1,
    completedThisMonth: 2,
  },
  compliance: {
    overallPercentage: 94.2,
    pendingAcknowledgments: 23,
    overdueAcknowledgments: 8,
  },
  growth: {
    thisMonth: 5,
    lastMonth: 3,
    trend: 66.7,
  },
}

const mockOnboardings: OnboardingItem[] = [
  { id: '1', name: 'Sarah Johnson', department: 'Engineering', jobTitle: 'Software Engineer', startDate: '2026-02-10', status: 'in_progress', tasksCompleted: 8, totalTasks: 12, manager: 'Tom Brown' },
  { id: '2', name: 'Michael Lee', department: 'Marketing', jobTitle: 'Marketing Specialist', startDate: '2026-02-15', status: 'pending', tasksCompleted: 0, totalTasks: 10, manager: 'Lisa Park' },
  { id: '3', name: 'Emily Chen', department: 'Sales', jobTitle: 'Account Executive', startDate: '2026-02-12', status: 'in_progress', tasksCompleted: 5, totalTasks: 11, manager: 'David Wilson' },
  { id: '4', name: 'James Brown', department: 'Engineering', jobTitle: 'QA Engineer', startDate: '2026-02-20', status: 'pending', tasksCompleted: 0, totalTasks: 12, manager: 'Tom Brown' },
  { id: '5', name: 'Anna Martinez', department: 'HR', jobTitle: 'HR Coordinator', startDate: '2026-02-18', status: 'pending', tasksCompleted: 0, totalTasks: 9, manager: 'Mark Wilson' },
]

const mockDepartments: DepartmentData[] = [
  { name: 'Engineering', headcount: 52, percentage: 27.7, color: 'bg-blue-500' },
  { name: 'Sales', headcount: 35, percentage: 18.6, color: 'bg-brand-500' },
  { name: 'Marketing', headcount: 28, percentage: 14.9, color: 'bg-purple-500' },
  { name: 'Operations', headcount: 25, percentage: 13.3, color: 'bg-yellow-500' },
  { name: 'Finance', headcount: 20, percentage: 10.6, color: 'bg-red-500' },
  { name: 'HR', headcount: 15, percentage: 8.0, color: 'bg-pink-500' },
  { name: 'IT', headcount: 13, percentage: 6.9, color: 'bg-cyan-500' },
]

const mockLocations: LocationData[] = [
  { name: 'San Francisco', headcount: 60, percentage: 31.9 },
  { name: 'NYC Office', headcount: 35, percentage: 18.6 },
  { name: 'Edmonton', headcount: 15, percentage: 8.0 },
  { name: 'Calgary', headcount: 13, percentage: 6.9 },
  { name: 'Winnipeg', headcount: 12, percentage: 6.4 },
  { name: 'Los Angeles', headcount: 25, percentage: 13.3 },
  { name: 'Remote', headcount: 23, percentage: 12.2 },
  { name: 'Other', headcount: 5, percentage: 2.7 },
]

function ProgressRing({ percentage, size = 80 }: { percentage: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference
  const color = percentage >= 95 ? '#10b981' : percentage >= 80 ? '#f59e0b' : '#ef4444'
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#334155"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-slate-100">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  )
}

export default function HRDashboardPage() {
  const [stats, setStats] = useState<HRStats | null>(null)
  const [onboardings, setOnboardings] = useState<OnboardingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setStats(mockStats)
      setOnboardings(mockOnboardings)
      setLoading(false)
    }, 500)
  }, [])

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
          <h1 className="text-2xl font-bold text-slate-100">HR Dashboard</h1>
          <p className="text-slate-400 mt-1">Employee lifecycle and compliance overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/onboarding/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <UserPlusIcon className="h-4 w-4" />
            New Onboarding
          </Link>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Headcount */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Headcount</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">{stats.headcount.total}</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-brand-400">{stats.headcount.active} active</span>
                <span className="text-slate-600">•</span>
                <span className="text-yellow-400">{stats.headcount.onLeave} on leave</span>
              </div>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <UserGroupIcon className="h-8 w-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Growth */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">New This Month</p>
              <p className="text-3xl font-bold text-brand-400 mt-1">+{stats.growth.thisMonth}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-brand-400">
                <ArrowTrendingUpIcon className="h-3 w-3" />
                <span>{stats.growth.trend.toFixed(0)}% vs last month</span>
              </div>
            </div>
            <div className="p-3 bg-brand-500/20 rounded-lg">
              <ArrowTrendingUpIcon className="h-8 w-8 text-brand-400" />
            </div>
          </div>
        </div>

        {/* Onboarding */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Onboarding</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">{stats.onboarding.pending + stats.onboarding.inProgress}</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-yellow-400">{stats.onboarding.pending} pending</span>
                <span className="text-slate-600">•</span>
                <span className="text-blue-400">{stats.onboarding.inProgress} in progress</span>
              </div>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <UserPlusIcon className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Offboarding */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Offboarding</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">{stats.offboarding.pending + stats.offboarding.inProgress}</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-yellow-400">{stats.offboarding.pending} pending</span>
                <span className="text-slate-600">•</span>
                <span className="text-red-400">{stats.offboarding.inProgress} in progress</span>
              </div>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <UserMinusIcon className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Onboarding Pipeline */}
        <div className="lg:col-span-2 bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">Onboarding Pipeline</h3>
            <Link href="/portal/onboarding" className="text-sm text-brand-400 hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-700">
            {onboardings.slice(0, 5).map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      item.status === 'completed' ? 'bg-brand-500/20 text-brand-400' :
                      item.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {item.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.jobTitle} • {item.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        item.status === 'completed' ? 'bg-brand-500/20 text-brand-400' :
                        item.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.status === 'in_progress' ? 'In Progress' : item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      <CalendarIcon className="h-3 w-3 inline mr-1" />
                      Starts {item.startDate}
                    </p>
                  </div>
                </div>
                {item.status !== 'pending' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Tasks: {item.tasksCompleted}/{item.totalTasks}</span>
                      <span>{((item.tasksCompleted / item.totalTasks) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${(item.tasksCompleted / item.totalTasks) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Policy Compliance */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">Policy Compliance</h3>
            <Link href="/portal/policies" className="text-sm text-brand-400 hover:underline">
              Manage
            </Link>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center mb-6">
              <ProgressRing percentage={stats.compliance.overallPercentage} size={120} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-slate-300">Pending</span>
                </div>
                <span className="font-medium text-yellow-400">{stats.compliance.pendingAcknowledgments}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-slate-300">Overdue</span>
                </div>
                <span className="font-medium text-red-400">{stats.compliance.overdueAcknowledgments}</span>
              </div>
            </div>
            {stats.compliance.overdueAcknowledgments > 0 && (
              <Link 
                href="/portal/policies?filter=overdue"
                className="block mt-4 text-center text-sm text-red-400 hover:underline"
              >
                View overdue acknowledgments →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Department & Location Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Department */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
              Headcount by Department
            </h3>
            <Link href="/portal/people/org-chart" className="text-sm text-brand-400 hover:underline">
              Org Chart
            </Link>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {mockDepartments.map((dept) => (
                <div key={dept.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{dept.name}</span>
                    <span className="text-sm text-slate-400">{dept.headcount} ({dept.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${dept.color}`}
                      style={{ width: `${dept.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* By Location */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-slate-400" />
              Headcount by Location
            </h3>
            <Link href="/portal/people/locations" className="text-sm text-brand-400 hover:underline">
              Location Map
            </Link>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {mockLocations.map((loc) => (
                <div key={loc.name} className="p-3 bg-slate-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{loc.name}</span>
                    <span className="text-lg font-semibold text-slate-100">{loc.headcount}</span>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden mt-2">
                    <div 
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${loc.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="font-semibold text-slate-100 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/portal/onboarding/new" className="p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors text-center">
            <UserPlusIcon className="h-8 w-8 text-brand-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Start Onboarding</p>
          </Link>
          <Link href="/portal/offboarding/new" className="p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors text-center">
            <UserMinusIcon className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Start Offboarding</p>
          </Link>
          <Link href="/portal/policies" className="p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors text-center">
            <DocumentTextIcon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Manage Policies</p>
          </Link>
          <Link href="/portal/people/org-chart" className="p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors text-center">
            <ChartBarIcon className="h-8 w-8 text-purple-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">View Org Chart</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
