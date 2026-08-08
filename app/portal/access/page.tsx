'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  CubeIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

interface AccessRequest {
  id: string
  type: 'service' | 'asset' | 'role'
  status: 'pending' | 'approved' | 'rejected' | 'provisioned' | 'cancelled'
  // Requester
  requesterId: string
  requesterName: string
  requesterDepartment: string
  requesterEmail: string
  // What's being requested
  itemId: string
  itemName: string
  itemType: string
  accessLevel?: string
  // Approval
  approverId?: string
  approverName?: string
  approvalDate?: string
  approvalNotes?: string
  // Dates
  requestedAt: string
  neededBy?: string
  // Justification
  justification: string
  // Priority
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

const mockRequests: AccessRequest[] = [
  {
    id: '1',
    type: 'service',
    status: 'pending',
    requesterId: 'u1',
    requesterName: 'John Smith',
    requesterDepartment: 'Engineering',
    requesterEmail: 'john.smith@company.com',
    itemId: 's1',
    itemName: 'GitHub Enterprise',
    itemType: 'Development',
    accessLevel: 'Developer',
    requestedAt: '2026-02-03T10:30:00Z',
    neededBy: '2026-02-10',
    justification: 'Need access to code repositories for the new project I\'m starting next week.',
    priority: 'high',
  },
  {
    id: '2',
    type: 'service',
    status: 'pending',
    requesterId: 'u2',
    requesterName: 'Emily Brown',
    requesterDepartment: 'Marketing',
    requesterEmail: 'emily.brown@company.com',
    itemId: 's2',
    itemName: 'Salesforce',
    itemType: 'CRM',
    accessLevel: 'Standard User',
    requestedAt: '2026-02-03T09:15:00Z',
    justification: 'Collaborating with sales team on new campaign, need to view customer data.',
    priority: 'normal',
  },
  {
    id: '3',
    type: 'asset',
    status: 'pending',
    requesterId: 'u3',
    requesterName: 'David Wilson',
    requesterDepartment: 'Engineering',
    requesterEmail: 'david.wilson@company.com',
    itemId: 'a1',
    itemName: 'Developer Laptop',
    itemType: 'Hardware',
    requestedAt: '2026-02-02T16:45:00Z',
    neededBy: '2026-02-15',
    justification: 'Current laptop is 4 years old and struggling with development workloads.',
    priority: 'normal',
  },
  {
    id: '4',
    type: 'service',
    status: 'approved',
    requesterId: 'u4',
    requesterName: 'Sarah Chen',
    requesterDepartment: 'Finance',
    requesterEmail: 'sarah.chen@company.com',
    itemId: 's3',
    itemName: 'Power BI',
    itemType: 'Analytics',
    accessLevel: 'Viewer',
    approverId: 'a1',
    approverName: 'Mike Johnson',
    approvalDate: '2026-02-02T14:00:00Z',
    requestedAt: '2026-02-01T11:30:00Z',
    justification: 'Need to view financial dashboards for quarterly reporting.',
    priority: 'normal',
  },
  {
    id: '5',
    type: 'service',
    status: 'provisioned',
    requesterId: 'u5',
    requesterName: 'Lisa Park',
    requesterDepartment: 'HR',
    requesterEmail: 'lisa.park@company.com',
    itemId: 's4',
    itemName: 'Slack',
    itemType: 'Communication',
    accessLevel: 'Member',
    approverId: 'a1',
    approverName: 'Mike Johnson',
    approvalDate: '2026-01-30T10:00:00Z',
    requestedAt: '2026-01-29T15:20:00Z',
    justification: 'New hire, need communication access.',
    priority: 'high',
  },
  {
    id: '6',
    type: 'service',
    status: 'rejected',
    requesterId: 'u6',
    requesterName: 'Tom Wilson',
    requesterDepartment: 'Sales',
    requesterEmail: 'tom.wilson@company.com',
    itemId: 's5',
    itemName: 'AWS Console',
    itemType: 'Infrastructure',
    accessLevel: 'Admin',
    approverId: 'a2',
    approverName: 'Sarah Chen',
    approvalDate: '2026-01-28T09:30:00Z',
    approvalNotes: 'Admin access not appropriate for sales role. Please request read-only access instead.',
    requestedAt: '2026-01-27T14:00:00Z',
    justification: 'Need to check server status for customer demos.',
    priority: 'normal',
  },
]

const statusConfig = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: ClockIcon },
  approved: { label: 'Approved', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: CheckCircleIcon },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircleIcon },
  provisioned: { label: 'Provisioned', color: 'text-brand-400', bg: 'bg-brand-500/20', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-700', icon: XCircleIcon },
}

const priorityConfig = {
  low: { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-700' },
  normal: { label: 'Normal', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  high: { label: 'High', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/20' },
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    setTimeout(() => {
      setRequests(mockRequests)
      setLoading(false)
    }, 500)
  }, [])

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         req.itemName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter
    const matchesType = typeFilter === 'all' || req.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  // Stats
  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    provisioned: requests.filter(r => r.status === 'provisioned').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
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
          <h1 className="text-2xl font-bold text-slate-100">Access Requests</h1>
          <p className="text-slate-400 mt-1">Manage service and asset access requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/access/bulk"
            className="flex items-center gap-2 px-3 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Bulk Assign
          </Link>
          <Link
            href="/portal/access/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Request
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          onClick={() => setStatusFilter('pending')}
          className={`bg-slate-800 rounded-lg border p-4 text-left transition-colors ${
            statusFilter === 'pending' ? 'border-yellow-500' : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </button>
        
        <button 
          onClick={() => setStatusFilter('approved')}
          className={`bg-slate-800 rounded-lg border p-4 text-left transition-colors ${
            statusFilter === 'approved' ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Approved</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.approved}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </button>
        
        <button 
          onClick={() => setStatusFilter('provisioned')}
          className={`bg-slate-800 rounded-lg border p-4 text-left transition-colors ${
            statusFilter === 'provisioned' ? 'border-brand-500' : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Provisioned</p>
              <p className="text-2xl font-bold text-brand-400 mt-1">{stats.provisioned}</p>
            </div>
            <div className="p-3 bg-brand-500/20 rounded-lg">
              <ShieldCheckIcon className="h-6 w-6 text-brand-400" />
            </div>
          </div>
        </button>
        
        <button 
          onClick={() => setStatusFilter('rejected')}
          className={`bg-slate-800 rounded-lg border p-4 text-left transition-colors ${
            statusFilter === 'rejected' ? 'border-red-500' : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Rejected</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.rejected}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <XCircleIcon className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by requester or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="provisioned">Provisioned</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Types</option>
            <option value="service">Services</option>
            <option value="asset">Assets</option>
            <option value="role">Roles</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.map((request) => {
          const status = statusConfig[request.status]
          const priority = priorityConfig[request.priority]
          const StatusIcon = status.icon
          
          return (
            <div 
              key={request.id}
              className="bg-slate-800 rounded-lg border border-slate-700 p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Type Icon */}
                <div className={`p-3 rounded-lg ${
                  request.type === 'service' ? 'bg-blue-500/20' :
                  request.type === 'asset' ? 'bg-purple-500/20' :
                  'bg-brand-500/20'
                }`}>
                  {request.type === 'service' ? (
                    <CubeIcon className={`h-6 w-6 ${
                      request.type === 'service' ? 'text-blue-400' : 'text-purple-400'
                    }`} />
                  ) : (
                    <ShieldCheckIcon className="h-6 w-6 text-purple-400" />
                  )}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-100">{request.itemName}</h3>
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                          {request.itemType}
                        </span>
                        {request.accessLevel && (
                          <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                            {request.accessLevel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <UserIcon className="h-4 w-4 text-slate-500" />
                        <span className="text-sm text-slate-300">{request.requesterName}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-sm text-slate-500">{request.requesterDepartment}</span>
                      </div>
                    </div>
                    
                    {/* Status & Priority */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 text-xs rounded ${priority.bg} ${priority.color}`}>
                        {priority.label}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${status.bg} ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Justification */}
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">{request.justification}</p>

                  {/* Meta */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span>Requested: {formatDate(request.requestedAt)}</span>
                    {request.neededBy && (
                      <span className="text-yellow-400">Needed by: {request.neededBy}</span>
                    )}
                    {request.approverName && (
                      <span>
                        {request.status === 'approved' || request.status === 'provisioned' ? 'Approved' : 'Reviewed'} by: {request.approverName}
                      </span>
                    )}
                  </div>

                  {/* Rejection Notes */}
                  {request.status === 'rejected' && request.approvalNotes && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                      <strong>Reason:</strong> {request.approvalNotes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/portal/access/${request.id}`}
                    className="p-2 text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded-lg transition-colors"
                    title="View details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </Link>
                  {request.status === 'pending' && (
                    <>
                      <button
                        className="p-2 text-brand-400 hover:bg-brand-500/20 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                      </button>
                      <button
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  {request.status === 'approved' && (
                    <button
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Mark as provisioned"
                    >
                      <ShieldCheckIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredRequests.length === 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <ClockIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No access requests found</p>
          <Link 
            href="/portal/access/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Create Request
          </Link>
        </div>
      )}
    </div>
  )
}
