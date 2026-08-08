'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CloudIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  EllipsisHorizontalIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

interface Service {
  id: string
  name: string
  description: string
  category: string
  serviceType: 'saas' | 'on_premise' | 'hybrid' | 'internal'
  status: 'active' | 'deprecated' | 'retired' | 'pending'
  vendor?: {
    id: string
    name: string
  }
  // Contract info
  contractEndDate?: string
  renewalDate?: string
  autoRenew: boolean
  // Cost
  costAmount?: number
  costFrequency?: 'monthly' | 'annual' | 'one_time'
  costCurrency: string
  // Usage
  activeUsers: number
  totalLicenses?: number
  // Owners
  primaryOwner?: {
    id: string
    name: string
    avatar?: string
  }
  ownerCount: number
  // Documentation
  hasOnboardingDoc: boolean
  hasOffboardingDoc: boolean
  // URLs
  loginUrl?: string
  adminUrl?: string
}

// Mock data
const mockServices: Service[] = [
  {
    id: '1',
    name: 'Slack',
    description: 'Team communication and collaboration platform',
    category: 'Communication',
    serviceType: 'saas',
    status: 'active',
    vendor: { id: 'v1', name: 'Slack Technologies' },
    contractEndDate: '2026-12-31',
    renewalDate: '2026-11-30',
    autoRenew: true,
    costAmount: 12.50,
    costFrequency: 'monthly',
    costCurrency: 'USD',
    activeUsers: 145,
    totalLicenses: 200,
    primaryOwner: { id: 'u1', name: 'Sarah Chen' },
    ownerCount: 2,
    hasOnboardingDoc: true,
    hasOffboardingDoc: true,
    loginUrl: 'https://company.slack.com',
    adminUrl: 'https://company.slack.com/admin',
  },
  {
    id: '2',
    name: 'GitHub Enterprise',
    description: 'Source code management and collaboration',
    category: 'Development',
    serviceType: 'saas',
    status: 'active',
    vendor: { id: 'v2', name: 'GitHub Inc.' },
    contractEndDate: '2026-06-30',
    renewalDate: '2026-05-15',
    autoRenew: false,
    costAmount: 21,
    costFrequency: 'monthly',
    costCurrency: 'USD',
    activeUsers: 52,
    totalLicenses: 75,
    primaryOwner: { id: 'u2', name: 'Mike Johnson' },
    ownerCount: 3,
    hasOnboardingDoc: true,
    hasOffboardingDoc: true,
    loginUrl: 'https://github.com/company',
  },
  {
    id: '3',
    name: 'Jira',
    description: 'Project tracking and issue management',
    category: 'Project Management',
    serviceType: 'saas',
    status: 'active',
    vendor: { id: 'v3', name: 'Atlassian' },
    contractEndDate: '2026-03-15',
    renewalDate: '2026-02-15',
    autoRenew: true,
    costAmount: 7.75,
    costFrequency: 'monthly',
    costCurrency: 'USD',
    activeUsers: 89,
    totalLicenses: 100,
    primaryOwner: { id: 'u3', name: 'Lisa Park' },
    ownerCount: 2,
    hasOnboardingDoc: true,
    hasOffboardingDoc: false,
  },
  {
    id: '4',
    name: 'Active Directory',
    description: 'Identity and access management',
    category: 'Identity',
    serviceType: 'on_premise',
    status: 'active',
    activeUsers: 188,
    primaryOwner: { id: 'u1', name: 'Sarah Chen' },
    ownerCount: 4,
    hasOnboardingDoc: true,
    hasOffboardingDoc: true,
    costAmount: 0,
    costFrequency: 'monthly',
    costCurrency: 'USD',
    autoRenew: false,
  },
  {
    id: '5',
    name: 'Salesforce',
    description: 'Customer relationship management',
    category: 'Sales',
    serviceType: 'saas',
    status: 'active',
    vendor: { id: 'v4', name: 'Salesforce Inc.' },
    contractEndDate: '2026-09-30',
    renewalDate: '2026-08-01',
    autoRenew: false,
    costAmount: 150,
    costFrequency: 'monthly',
    costCurrency: 'USD',
    activeUsers: 35,
    totalLicenses: 50,
    primaryOwner: { id: 'u4', name: 'Tom Wilson' },
    ownerCount: 2,
    hasOnboardingDoc: true,
    hasOffboardingDoc: true,
  },
  {
    id: '6',
    name: 'Legacy CRM',
    description: 'Old customer management system - being phased out',
    category: 'Sales',
    serviceType: 'on_premise',
    status: 'deprecated',
    activeUsers: 5,
    ownerCount: 1,
    hasOnboardingDoc: false,
    hasOffboardingDoc: true,
    costAmount: 0,
    costFrequency: 'monthly',
    costCurrency: 'USD',
    autoRenew: false,
  },
]

const categories = ['All', 'Communication', 'Development', 'Project Management', 'Identity', 'Sales', 'Security', 'HR']
const serviceTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'saas', label: 'SaaS', icon: CloudIcon },
  { value: 'on_premise', label: 'On-Premise', icon: ServerIcon },
  { value: 'hybrid', label: 'Hybrid', icon: ArrowPathIcon },
  { value: 'internal', label: 'Internal', icon: BuildingOfficeIcon },
]

function getRenewalStatus(renewalDate?: string): { status: string; color: string; urgent: boolean } {
  if (!renewalDate) return { status: 'No renewal', color: 'text-slate-500', urgent: false }
  
  const today = new Date()
  const renewal = new Date(renewalDate)
  const daysUntil = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntil < 0) return { status: 'Overdue', color: 'text-red-400', urgent: true }
  if (daysUntil <= 30) return { status: `${daysUntil} days`, color: 'text-red-400', urgent: true }
  if (daysUntil <= 90) return { status: `${daysUntil} days`, color: 'text-yellow-400', urgent: false }
  return { status: `${daysUntil} days`, color: 'text-slate-400', urgent: false }
}

function formatCost(amount?: number, frequency?: string, currency: string = 'USD'): string {
  if (!amount || amount === 0) return 'Free / Internal'
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  const freq = frequency === 'monthly' ? '/mo' : frequency === 'annual' ? '/yr' : ''
  return `${formatted}${freq}`
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedType, setSelectedType] = useState('all')
  const [showRenewalsOnly, setShowRenewalsOnly] = useState(false)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setServices(mockServices)
      setLoading(false)
    }, 500)
  }, [])

  // Filter services
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || service.category === selectedCategory
    const matchesType = selectedType === 'all' || service.serviceType === selectedType
    const matchesRenewal = !showRenewalsOnly || (service.renewalDate && getRenewalStatus(service.renewalDate).urgent)
    
    return matchesSearch && matchesCategory && matchesType && matchesRenewal
  })

  // Stats
  const stats = {
    total: services.length,
    active: services.filter(s => s.status === 'active').length,
    renewingSoon: services.filter(s => s.renewalDate && getRenewalStatus(s.renewalDate).urgent).length,
    totalMonthlyCost: services.reduce((sum, s) => {
      if (!s.costAmount) return sum
      if (s.costFrequency === 'annual') return sum + (s.costAmount / 12)
      return sum + (s.costAmount || 0)
    }, 0),
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
          <h1 className="text-2xl font-bold text-slate-100">Service Catalog</h1>
          <p className="text-slate-400 mt-1">Manage applications, subscriptions, and access</p>
        </div>
        <Link
          href="/portal/services/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Service
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Services</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-slate-700 rounded-lg">
              <CloudIcon className="h-6 w-6 text-slate-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active</p>
              <p className="text-2xl font-bold text-brand-400 mt-1">{stats.active}</p>
            </div>
            <div className="p-3 bg-brand-500/20 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-brand-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Renewals Due</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.renewingSoon}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
          {stats.renewingSoon > 0 && (
            <button 
              onClick={() => setShowRenewalsOnly(!showRenewalsOnly)}
              className="text-xs text-yellow-400 mt-2 hover:underline"
            >
              {showRenewalsOnly ? 'Show all' : 'Show only'}
            </button>
          )}
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Monthly Cost</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.totalMonthlyCost)}
              </p>
            </div>
            <div className="p-3 bg-slate-700 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-slate-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {serviceTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Services List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Service</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Users</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Cost</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Renewal</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Owner</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Docs</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredServices.map((service) => {
                const renewal = getRenewalStatus(service.renewalDate)
                
                return (
                  <tr key={service.id} className="hover:bg-slate-700/50 transition-colors">
                    {/* Service Name */}
                    <td className="px-4 py-3">
                      <Link href={`/portal/services/${service.id}`} className="block">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            service.status === 'active' ? 'bg-brand-500/20' :
                            service.status === 'deprecated' ? 'bg-yellow-500/20' :
                            'bg-slate-700'
                          }`}>
                            {service.serviceType === 'saas' ? (
                              <CloudIcon className={`h-5 w-5 ${
                                service.status === 'active' ? 'text-brand-400' :
                                service.status === 'deprecated' ? 'text-yellow-400' :
                                'text-slate-400'
                              }`} />
                            ) : (
                              <ServerIcon className={`h-5 w-5 ${
                                service.status === 'active' ? 'text-brand-400' :
                                service.status === 'deprecated' ? 'text-yellow-400' :
                                'text-slate-400'
                              }`} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200 hover:text-brand-400 transition-colors">
                              {service.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">
                              {service.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    
                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">
                        {service.category}
                      </span>
                    </td>
                    
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        service.serviceType === 'saas' ? 'bg-blue-500/20 text-blue-400' :
                        service.serviceType === 'on_premise' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {service.serviceType === 'saas' ? 'SaaS' :
                         service.serviceType === 'on_premise' ? 'On-Prem' :
                         service.serviceType}
                      </span>
                    </td>
                    
                    {/* Users */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-300">{service.activeUsers}</span>
                        {service.totalLicenses && (
                          <span className="text-slate-500">/ {service.totalLicenses}</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Cost */}
                    <td className="px-4 py-3">
                      <span className="text-slate-300">
                        {formatCost(service.costAmount, service.costFrequency, service.costCurrency)}
                      </span>
                    </td>
                    
                    {/* Renewal */}
                    <td className="px-4 py-3">
                      {service.renewalDate ? (
                        <div className="flex items-center gap-1">
                          {renewal.urgent && (
                            <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />
                          )}
                          <span className={renewal.color}>{renewal.status}</span>
                          {service.autoRenew && (
                            <ArrowPathIcon className="h-3 w-3 text-slate-500" title="Auto-renew" />
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    
                    {/* Owner */}
                    <td className="px-4 py-3">
                      {service.primaryOwner ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-300">
                            {service.primaryOwner.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-slate-300 text-sm">{service.primaryOwner.name}</span>
                          {service.ownerCount > 1 && (
                            <span className="text-xs text-slate-500">+{service.ownerCount - 1}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">No owner</span>
                      )}
                    </td>
                    
                    {/* Documentation */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${service.hasOnboardingDoc ? 'bg-brand-400' : 'bg-slate-600'}`} 
                             title={service.hasOnboardingDoc ? 'Has onboarding doc' : 'No onboarding doc'} />
                        <div className={`h-2 w-2 rounded-full ${service.hasOffboardingDoc ? 'bg-brand-400' : 'bg-slate-600'}`}
                             title={service.hasOffboardingDoc ? 'Has offboarding doc' : 'No offboarding doc'} />
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/portal/services/${service.id}`}
                          className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded transition-colors"
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </Link>
                        <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredServices.length === 0 && (
          <div className="p-8 text-center">
            <CloudIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No services found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-medium">Documentation:</span>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-brand-400" />
            <span>Onboarding</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-brand-400" />
            <span>Offboarding</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ArrowPathIcon className="h-3 w-3" />
          <span>Auto-renew enabled</span>
        </div>
      </div>
    </div>
  )
}
