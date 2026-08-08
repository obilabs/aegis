'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  ScaleIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilIcon,
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface Policy {
  id: string
  name: string
  description: string
  policyType: string
  category: string
  version: string
  status: string
  effectiveDate?: string
  reviewDate?: string
  requiresAcknowledgment: boolean
  totalAssigned: number
  acknowledged: number
  pending: number
  overdue: number
  compliancePercentage: number
}


const policyTypeConfig: Record<string, { label: string; icon: typeof BuildingOfficeIcon; color: string; bg: string }> = {
  company_policy: { label: 'Company Policy', icon: BuildingOfficeIcon, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  it_security_policy: { label: 'IT/Security', icon: ShieldCheckIcon, color: 'text-brand-400', bg: 'bg-brand-500/20' },
  compliance_policy: { label: 'Compliance', icon: ScaleIcon, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  procedure: { label: 'Procedure', icon: ClipboardDocumentListIcon, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
}

const defaultTypeConfig = { label: 'Policy', icon: DocumentTextIcon, color: 'text-slate-400', bg: 'bg-slate-500/20' }

function ComplianceBar({ percentage }: { percentage: number }) {
  const color = percentage >= 95 ? 'bg-brand-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-red-500'
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-sm font-medium ${
        percentage >= 95 ? 'text-brand-400' : percentage >= 80 ? 'text-yellow-400' : 'text-red-400'
      }`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  )
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchPolicies() {
      try {
        const res = await fetch('/api/portal/policies')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setPolicies(data.policies || [])
      } catch (err) {
        console.error('Failed to load policies:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPolicies()
  }, [])

  // Filter policies
  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         policy.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || policy.policyType === typeFilter
    const matchesStatus = statusFilter === 'all' || policy.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  // Stats
  const publishedPolicies = policies.filter(p => p.status === 'published')
  const stats = {
    total: publishedPolicies.length,
    totalAssigned: publishedPolicies.reduce((sum, p) => sum + p.totalAssigned, 0),
    totalAcknowledged: publishedPolicies.reduce((sum, p) => sum + p.acknowledged, 0),
    totalOverdue: publishedPolicies.reduce((sum, p) => sum + p.overdue, 0),
    overallCompliance: publishedPolicies.length > 0 
      ? publishedPolicies.reduce((sum, p) => sum + p.compliancePercentage, 0) / publishedPolicies.length
      : 0,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Policies & Procedures</h1>
          <p className="text-slate-400 mt-1">Manage company policies and track acknowledgments</p>
        </div>
        <Link
          href="/portal/policies/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Policy
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Published</p>
              <p className="text-xl font-bold text-slate-100">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Assigned</p>
              <p className="text-xl font-bold text-slate-100">{stats.totalAssigned}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Acknowledged</p>
              <p className="text-xl font-bold text-brand-400">{stats.totalAcknowledged}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Overdue</p>
              <p className="text-xl font-bold text-red-400">{stats.totalOverdue}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ChartBarIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Compliance</p>
              <p className={`text-xl font-bold ${
                stats.overallCompliance >= 95 ? 'text-brand-400' : 
                stats.overallCompliance >= 80 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {stats.overallCompliance.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Types</option>
            <option value="company_policy">Company Policy</option>
            <option value="it_security_policy">IT/Security</option>
            <option value="compliance_policy">Compliance</option>
            <option value="procedure">Procedure</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        {filteredPolicies.map((policy) => {
          const typeConfig = policyTypeConfig[policy.policyType] || defaultTypeConfig
          const TypeIcon = typeConfig.icon
          
          return (
            <div 
              key={policy.id}
              className="bg-slate-800 rounded-lg border border-slate-700 p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 rounded-lg ${typeConfig.bg}`}>
                  <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-100">{policy.name}</h3>
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                          v{policy.version}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          policy.status === 'published' ? 'bg-brand-500/20 text-brand-400' :
                          policy.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {policy.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{policy.description}</p>
                      
                      {/* Tags */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${typeConfig.bg} ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        {policy.requiresAcknowledgment && (
                          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                            Requires Acknowledgment
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/portal/policies/${policy.id}`}
                        className="p-2 text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Link>
                      <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Compliance Stats */}
                  {policy.status === 'published' && policy.requiresAcknowledgment && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Compliance</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-brand-400">{policy.acknowledged} acknowledged</span>
                          <span className="text-yellow-400">{policy.pending} pending</span>
                          {policy.overdue > 0 && (
                            <span className="text-red-400">{policy.overdue} overdue</span>
                          )}
                        </div>
                      </div>
                      <ComplianceBar percentage={policy.compliancePercentage} />
                    </div>
                  )}

                  {/* Dates */}
                  {(policy.effectiveDate || policy.reviewDate) && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      {policy.effectiveDate && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          Effective: {policy.effectiveDate}
                        </span>
                      )}
                      {policy.reviewDate && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          Review by: {policy.reviewDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredPolicies.length === 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <DocumentTextIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No policies found</p>
        </div>
      )}
    </div>
  )
}
