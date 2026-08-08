'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  PencilIcon,
  CloudIcon,
  ServerIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  LinkIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  KeyIcon,
  BookOpenIcon,
  UserPlusIcon,
  UserMinusIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface ServiceOwner {
  id: string
  name: string
  email: string
  avatar?: string
  roleType: 'owner' | 'admin' | 'expert' | 'backup'
  canProvision: boolean
  canDeprovision: boolean
  isAvailable: boolean
  isPrimary: boolean
}

interface ServiceUser {
  id: string
  name: string
  email: string
  department: string
  accessLevel: string
  grantedAt: string
  grantedBy: string
}

interface ServiceDetail {
  id: string
  name: string
  description: string
  category: string
  serviceType: 'saas' | 'on_premise' | 'hybrid' | 'internal'
  status: 'active' | 'deprecated' | 'retired' | 'pending'
  // Vendor
  vendor?: {
    id: string
    name: string
    supportEmail?: string
    supportPhone?: string
    supportPortal?: string
  }
  // Contract
  contractStartDate?: string
  contractEndDate?: string
  renewalDate?: string
  autoRenew: boolean
  contractNumber?: string
  // Cost
  costAmount?: number
  costFrequency?: 'monthly' | 'annual' | 'one_time'
  costCurrency: string
  licenseType?: string
  totalLicenses?: number
  // URLs
  loginUrl?: string
  adminUrl?: string
  documentationUrl?: string
  // Documentation
  onboardingDoc?: { id: string; title: string }
  offboardingDoc?: { id: string; title: string }
  adminGuide?: { id: string; title: string }
  userGuide?: { id: string; title: string }
  // Access control
  requiresApproval: boolean
  approvalType?: string
  // Stats
  activeUsers: number
  // Owners
  owners: ServiceOwner[]
  // Recent users (sample)
  recentUsers: ServiceUser[]
  // Notes
  notes?: string
}

const mockService: ServiceDetail = {
  id: '1',
  name: 'Slack',
  description: 'Team communication and collaboration platform. Used for real-time messaging, file sharing, and integrations with other tools.',
  category: 'Communication',
  serviceType: 'saas',
  status: 'active',
  vendor: {
    id: 'v1',
    name: 'Slack Technologies',
    supportEmail: 'support@slack.com',
    supportPhone: '1-800-555-0123',
    supportPortal: 'https://slack.com/help',
  },
  contractStartDate: '2024-01-01',
  contractEndDate: '2026-12-31',
  renewalDate: '2026-11-30',
  autoRenew: true,
  contractNumber: 'SLK-2024-001',
  costAmount: 12.50,
  costFrequency: 'monthly',
  costCurrency: 'USD',
  licenseType: 'per_user',
  totalLicenses: 200,
  loginUrl: 'https://company.slack.com',
  adminUrl: 'https://company.slack.com/admin',
  documentationUrl: 'https://slack.com/help',
  onboardingDoc: { id: 'kb-1', title: 'How to Add User to Slack' },
  offboardingDoc: { id: 'kb-2', title: 'How to Remove User from Slack' },
  adminGuide: { id: 'kb-3', title: 'Slack Administration Guide' },
  userGuide: { id: 'kb-4', title: 'Getting Started with Slack' },
  requiresApproval: false,
  activeUsers: 145,
  owners: [
    { id: 'o1', name: 'Sarah Chen', email: 'sarah@company.com', roleType: 'owner', canProvision: true, canDeprovision: true, isAvailable: true, isPrimary: true },
    { id: 'o2', name: 'Mike Johnson', email: 'mike@company.com', roleType: 'admin', canProvision: true, canDeprovision: true, isAvailable: true, isPrimary: false },
    { id: 'o3', name: 'Lisa Park', email: 'lisa@company.com', roleType: 'expert', canProvision: false, canDeprovision: false, isAvailable: true, isPrimary: false },
  ],
  recentUsers: [
    { id: 'u1', name: 'John Smith', email: 'john@company.com', department: 'Engineering', accessLevel: 'Member', grantedAt: '2026-01-15', grantedBy: 'Sarah Chen' },
    { id: 'u2', name: 'Emily Brown', email: 'emily@company.com', department: 'Marketing', accessLevel: 'Member', grantedAt: '2026-01-10', grantedBy: 'Mike Johnson' },
    { id: 'u3', name: 'David Wilson', email: 'david@company.com', department: 'Sales', accessLevel: 'Member', grantedAt: '2026-01-05', grantedBy: 'Sarah Chen' },
  ],
  notes: 'Primary communication tool. All employees should have access. Channels are organized by department and project.',
}

function getRenewalStatus(renewalDate?: string): { status: string; color: string; bgColor: string; urgent: boolean } {
  if (!renewalDate) return { status: 'No renewal', color: 'text-slate-500', bgColor: 'bg-slate-500/20', urgent: false }
  
  const today = new Date()
  const renewal = new Date(renewalDate)
  const daysUntil = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntil < 0) return { status: 'Overdue', color: 'text-red-400', bgColor: 'bg-red-500/20', urgent: true }
  if (daysUntil <= 30) return { status: `${daysUntil} days until renewal`, color: 'text-red-400', bgColor: 'bg-red-500/20', urgent: true }
  if (daysUntil <= 90) return { status: `${daysUntil} days until renewal`, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', urgent: false }
  return { status: `${daysUntil} days until renewal`, color: 'text-brand-400', bgColor: 'bg-brand-500/20', urgent: false }
}

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [service, setService] = useState<ServiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'owners' | 'docs'>('overview')
  const { id } = use(params)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setService(mockService)
      setLoading(false)
    }, 500)
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Service not found</p>
      </div>
    )
  }

  const renewal = getRenewalStatus(service.renewalDate)
  const licenseUsage = service.totalLicenses ? (service.activeUsers / service.totalLicenses) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${
              service.status === 'active' ? 'bg-brand-500/20' :
              service.status === 'deprecated' ? 'bg-yellow-500/20' :
              'bg-slate-700'
            }`}>
              {service.serviceType === 'saas' ? (
                <CloudIcon className={`h-8 w-8 ${
                  service.status === 'active' ? 'text-brand-400' :
                  service.status === 'deprecated' ? 'text-yellow-400' :
                  'text-slate-400'
                }`} />
              ) : (
                <ServerIcon className={`h-8 w-8 ${
                  service.status === 'active' ? 'text-brand-400' :
                  service.status === 'deprecated' ? 'text-yellow-400' :
                  'text-slate-400'
                }`} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-100">{service.name}</h1>
                <span className={`px-2 py-1 text-xs rounded ${
                  service.status === 'active' ? 'bg-brand-500/20 text-brand-400' :
                  service.status === 'deprecated' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {service.status}
                </span>
              </div>
              <p className="text-slate-400 mt-1">{service.category} • {service.serviceType === 'saas' ? 'SaaS' : 'On-Premise'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {service.loginUrl && (
            <a
              href={service.loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <LinkIcon className="h-4 w-4" />
              Open App
            </a>
          )}
          <button className="flex items-center gap-2 px-3 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors">
            <PencilIcon className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Renewal Alert */}
      {renewal.urgent && (
        <div className={`${renewal.bgColor} border ${renewal.color.replace('text-', 'border-')} rounded-lg p-4 flex items-center gap-3`}>
          <ExclamationTriangleIcon className={`h-6 w-6 ${renewal.color}`} />
          <div>
            <p className={`font-medium ${renewal.color}`}>Contract Renewal Required</p>
            <p className="text-sm text-slate-400">
              {renewal.status}. {service.autoRenew ? 'Auto-renewal is enabled.' : 'Manual renewal required.'}
            </p>
          </div>
          <button className="ml-auto px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors text-sm">
            Review Contract
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'users', label: `Users (${service.activeUsers})`, icon: UserGroupIcon },
            { id: 'owners', label: `Owners (${service.owners.length})`, icon: ShieldCheckIcon },
            { id: 'docs', label: 'Documentation', icon: BookOpenIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">Description</h3>
              <p className="text-slate-300">{service.description}</p>
              {service.notes && (
                <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                  <p className="text-sm text-slate-400">{service.notes}</p>
                </div>
              )}
            </div>

            {/* Contract & Cost */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Contract & Licensing</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Contract Start</p>
                  <p className="text-slate-200">{service.contractStartDate || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Contract End</p>
                  <p className="text-slate-200">{service.contractEndDate || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Renewal Date</p>
                  <p className={renewal.color}>{service.renewalDate || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Auto-Renew</p>
                  <p className="text-slate-200 flex items-center gap-1">
                    {service.autoRenew ? (
                      <>
                        <CheckCircleIcon className="h-4 w-4 text-brand-400" />
                        Yes
                      </>
                    ) : (
                      <>
                        <ClockIcon className="h-4 w-4 text-slate-400" />
                        No
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">License Type</p>
                  <p className="text-slate-200">{service.licenseType || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Licenses</p>
                  <p className="text-slate-200">{service.totalLicenses || 'Unlimited'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Cost</p>
                  <p className="text-slate-200">
                    {service.costAmount 
                      ? `$${service.costAmount}/${service.costFrequency === 'monthly' ? 'mo' : 'yr'} per user`
                      : 'Free / Internal'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Contract #</p>
                  <p className="text-slate-200 font-mono text-sm">{service.contractNumber || '—'}</p>
                </div>
              </div>

              {/* License Usage Bar */}
              {service.totalLicenses && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-400">License Usage</p>
                    <p className="text-sm text-slate-300">{service.activeUsers} / {service.totalLicenses} ({licenseUsage.toFixed(0)}%)</p>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        licenseUsage > 90 ? 'bg-red-500' :
                        licenseUsage > 75 ? 'bg-yellow-500' :
                        'bg-brand-500'
                      }`}
                      style={{ width: `${Math.min(licenseUsage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Vendor Info */}
            {service.vendor && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Vendor Information</h3>
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/portal/companies/${service.vendor.id}`} className="text-lg font-medium text-brand-400 hover:underline">
                      {service.vendor.name}
                    </Link>
                    <div className="mt-3 space-y-2 text-sm">
                      {service.vendor.supportEmail && (
                        <p className="text-slate-400">
                          Email: <a href={`mailto:${service.vendor.supportEmail}`} className="text-slate-200 hover:text-brand-400">{service.vendor.supportEmail}</a>
                        </p>
                      )}
                      {service.vendor.supportPhone && (
                        <p className="text-slate-400">
                          Phone: <span className="text-slate-200">{service.vendor.supportPhone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {service.vendor.supportPortal && (
                    <a
                      href={service.vendor.supportPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Support Portal
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Links */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Links</h3>
              <div className="space-y-2">
                {service.loginUrl && (
                  <a href={service.loginUrl} target="_blank" rel="noopener noreferrer" 
                     className="flex items-center gap-2 p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                    <LinkIcon className="h-4 w-4 text-slate-500" />
                    Login URL
                  </a>
                )}
                {service.adminUrl && (
                  <a href={service.adminUrl} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                    <KeyIcon className="h-4 w-4 text-slate-500" />
                    Admin Console
                  </a>
                )}
                {service.documentationUrl && (
                  <a href={service.documentationUrl} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                    <BookOpenIcon className="h-4 w-4 text-slate-500" />
                    Vendor Docs
                  </a>
                )}
              </div>
            </div>

            {/* Primary Owner */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Primary Owner</h3>
              {service.owners.filter(o => o.isPrimary).map(owner => (
                <div key={owner.id} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-medium">
                    {owner.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">{owner.name}</p>
                    <p className="text-sm text-slate-500">{owner.email}</p>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setActiveTab('owners')}
                className="mt-3 text-sm text-brand-400 hover:underline"
              >
                View all {service.owners.length} owners →
              </button>
            </div>

            {/* Access Control */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Access Control</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Requires Approval</span>
                  <span className={service.requiresApproval ? 'text-yellow-400' : 'text-brand-400'}>
                    {service.requiresApproval ? 'Yes' : 'No'}
                  </span>
                </div>
                {service.requiresApproval && service.approvalType && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Approval Type</span>
                    <span className="text-slate-200">{service.approvalType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-2 p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                  <UserPlusIcon className="h-4 w-4 text-brand-400" />
                  Add User
                </button>
                <button className="w-full flex items-center gap-2 p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                  <UserMinusIcon className="h-4 w-4 text-red-400" />
                  Remove User
                </button>
                <button className="w-full flex items-center gap-2 p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                  <DocumentTextIcon className="h-4 w-4 text-blue-400" />
                  View Access Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-100">Users with Access</h3>
              <p className="text-sm text-slate-400">{service.activeUsers} active users</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm">
                <UserPlusIcon className="h-4 w-4" />
                Add User
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm">
                <UserGroupIcon className="h-4 w-4" />
                Bulk Add
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">User</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Access Level</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Granted</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">By</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {service.recentUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-300">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{user.department}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">
                        {user.accessLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{user.grantedAt}</td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{user.grantedBy}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-700 text-center">
            <button className="text-sm text-brand-400 hover:underline">
              Load more users...
            </button>
          </div>
        </div>
      )}

      {activeTab === 'owners' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-100">Service Owners & Administrators</h3>
                <p className="text-sm text-slate-400">People responsible for managing this service</p>
              </div>
              <button className="flex items-center gap-2 px-3 py-2 text-brand-400 bg-brand-500/20 rounded-lg hover:bg-brand-500/30 transition-colors text-sm">
                <PlusIcon className="h-4 w-4" />
                Add Owner
              </button>
            </div>
            <div className="divide-y divide-slate-700">
              {service.owners.map((owner) => (
                <div key={owner.id} className="p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center font-medium ${
                      owner.isPrimary ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {owner.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-200">{owner.name}</p>
                        {owner.isPrimary && (
                          <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">Primary</span>
                        )}
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          owner.roleType === 'owner' ? 'bg-purple-500/20 text-purple-400' :
                          owner.roleType === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                          owner.roleType === 'expert' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {owner.roleType}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{owner.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {owner.canProvision && (
                          <span className="text-brand-400 flex items-center gap-1">
                            <UserPlusIcon className="h-3 w-3" /> Can provision
                          </span>
                        )}
                        {owner.canDeprovision && (
                          <span className="text-red-400 flex items-center gap-1">
                            <UserMinusIcon className="h-3 w-3" /> Can deprovision
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      owner.isAvailable ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {owner.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role Descriptions */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Role Descriptions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Owner</span>
                <p className="text-slate-400 mt-1">Full responsibility. Can delegate, modify settings, and manage all aspects.</p>
              </div>
              <div>
                <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">Admin</span>
                <p className="text-slate-400 mt-1">Can provision and deprovision users. Day-to-day management.</p>
              </div>
              <div>
                <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">Expert</span>
                <p className="text-slate-400 mt-1">Go-to person for questions. Can be assigned help tickets.</p>
              </div>
              <div>
                <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">Backup</span>
                <p className="text-slate-400 mt-1">Backup admin when primary is unavailable (vacation, etc.).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Onboarding Doc */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-brand-500/20 rounded-lg">
                <UserPlusIcon className="h-6 w-6 text-brand-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Onboarding Guide</h3>
                <p className="text-sm text-slate-400">How to add users to this service</p>
              </div>
            </div>
            {service.onboardingDoc ? (
              <Link
                href={`/portal/kb/${service.onboardingDoc.id}`}
                className="block p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <p className="text-brand-400 font-medium">{service.onboardingDoc.title}</p>
                <p className="text-sm text-slate-500 mt-1">Click to view documentation →</p>
              </Link>
            ) : (
              <div className="p-4 bg-slate-900 rounded-lg border-2 border-dashed border-slate-700">
                <p className="text-slate-500 text-center">No onboarding documentation</p>
                <button className="mt-2 w-full text-sm text-brand-400 hover:underline">
                  + Create onboarding guide
                </button>
              </div>
            )}
          </div>

          {/* Offboarding Doc */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <UserMinusIcon className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Offboarding Guide</h3>
                <p className="text-sm text-slate-400">How to remove users from this service</p>
              </div>
            </div>
            {service.offboardingDoc ? (
              <Link
                href={`/portal/kb/${service.offboardingDoc.id}`}
                className="block p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <p className="text-red-400 font-medium">{service.offboardingDoc.title}</p>
                <p className="text-sm text-slate-500 mt-1">Click to view documentation →</p>
              </Link>
            ) : (
              <div className="p-4 bg-slate-900 rounded-lg border-2 border-dashed border-slate-700">
                <p className="text-slate-500 text-center">No offboarding documentation</p>
                <button className="mt-2 w-full text-sm text-red-400 hover:underline">
                  + Create offboarding guide
                </button>
              </div>
            )}
          </div>

          {/* Admin Guide */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <KeyIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Admin Guide</h3>
                <p className="text-sm text-slate-400">Administration and configuration</p>
              </div>
            </div>
            {service.adminGuide ? (
              <Link
                href={`/portal/kb/${service.adminGuide.id}`}
                className="block p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <p className="text-blue-400 font-medium">{service.adminGuide.title}</p>
                <p className="text-sm text-slate-500 mt-1">Click to view documentation →</p>
              </Link>
            ) : (
              <div className="p-4 bg-slate-900 rounded-lg border-2 border-dashed border-slate-700">
                <p className="text-slate-500 text-center">No admin guide</p>
                <button className="mt-2 w-full text-sm text-blue-400 hover:underline">
                  + Create admin guide
                </button>
              </div>
            )}
          </div>

          {/* User Guide */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <BookOpenIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">User Guide</h3>
                <p className="text-sm text-slate-400">Getting started for end users</p>
              </div>
            </div>
            {service.userGuide ? (
              <Link
                href={`/portal/kb/${service.userGuide.id}`}
                className="block p-4 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <p className="text-purple-400 font-medium">{service.userGuide.title}</p>
                <p className="text-sm text-slate-500 mt-1">Click to view documentation →</p>
              </Link>
            ) : (
              <div className="p-4 bg-slate-900 rounded-lg border-2 border-dashed border-slate-700">
                <p className="text-slate-500 text-center">No user guide</p>
                <button className="mt-2 w-full text-sm text-purple-400 hover:underline">
                  + Create user guide
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
