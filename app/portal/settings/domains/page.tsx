'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  GlobeAltIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  TrashIcon,
  PencilIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

interface OrganizationDomain {
  id: string
  domain: string
  domain_type: 'internal' | 'trusted' | 'customer'
  auto_contact_type: string
  is_verified: boolean
  is_primary: boolean
  allow_self_registration: boolean
  require_email_verification: boolean
  auto_approve_users: boolean
  sso_enabled: boolean
  sso_provider: string | null
  description: string | null
  created_at: string
}

const DOMAIN_TYPE_CONFIG = {
  internal: {
    label: 'Internal',
    description: 'Employees with full access',
    color: 'emerald',
    icon: BuildingOfficeIcon,
  },
  trusted: {
    label: 'Trusted',
    description: 'Contractors, partners with limited access',
    color: 'blue',
    icon: ShieldCheckIcon,
  },
  customer: {
    label: 'Customer',
    description: 'External customers',
    color: 'amber',
    icon: UserGroupIcon,
  },
}

export default function DomainsSettingsPage() {
  const [domains, setDomains] = useState<OrganizationDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<OrganizationDomain | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    domain: '',
    domain_type: 'internal' as 'internal' | 'trusted' | 'customer',
    auto_contact_type: 'employee',
    description: '',
    allow_self_registration: true,
    require_email_verification: false,
    auto_approve_users: true,
  })

  useEffect(() => {
    fetchDomains()
  }, [])

  const fetchDomains = async () => {
    try {
      const res = await fetch('/api/settings/domains')
      if (res.ok) {
        const data = await res.json()
        setDomains(data.domains || [])
      }
    } catch (error) {
      console.error('Failed to fetch domains:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingDomain 
        ? `/api/settings/domains/${editingDomain.id}`
        : '/api/settings/domains'
      
      const res = await fetch(url, {
        method: editingDomain ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        fetchDomains()
        setShowAddModal(false)
        setEditingDomain(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save domain:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return

    try {
      const res = await fetch(`/api/settings/domains/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchDomains()
      }
    } catch (error) {
      console.error('Failed to delete domain:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      domain: '',
      domain_type: 'internal',
      auto_contact_type: 'employee',
      description: '',
      allow_self_registration: true,
      require_email_verification: false,
      auto_approve_users: true,
    })
  }

  const openEditModal = (domain: OrganizationDomain) => {
    setEditingDomain(domain)
    setFormData({
      domain: domain.domain,
      domain_type: domain.domain_type,
      auto_contact_type: domain.auto_contact_type,
      description: domain.description || '',
      allow_self_registration: domain.allow_self_registration,
      require_email_verification: domain.require_email_verification,
      auto_approve_users: domain.auto_approve_users,
    })
    setShowAddModal(true)
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
        <div className="flex items-center gap-4">
          <Link
            href="/portal/settings"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Organization Domains</h1>
            <p className="text-slate-400 mt-1">
              Configure email domains to auto-classify users as internal or external
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingDomain(null)
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Domain
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h3 className="font-medium text-slate-200 mb-2">How Domain Classification Works</h3>
        <p className="text-sm text-slate-400">
          When users register or are created, their email domain is checked against this list.
          Internal domains get automatic access to internal KB articles and can skip email verification.
          External domains require verification and have limited access by default.
        </p>
      </div>

      {/* Domains List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {domains.length === 0 ? (
          <div className="p-8 text-center">
            <GlobeAltIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No domains configured</h3>
            <p className="text-slate-500 mb-4">
              Add your organization's email domains to enable automatic user classification
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add First Domain
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Auto-Assign</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Settings</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {domains.map((domain) => {
                const typeConfig = DOMAIN_TYPE_CONFIG[domain.domain_type]
                const TypeIcon = typeConfig.icon

                return (
                  <tr key={domain.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <GlobeAltIcon className="h-5 w-5 text-slate-500" />
                        <div>
                          <div className="font-medium text-slate-200">
                            @{domain.domain}
                            {domain.is_primary && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                                Primary
                              </span>
                            )}
                          </div>
                          {domain.description && (
                            <div className="text-sm text-slate-500">{domain.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-4 w-4 text-${typeConfig.color}-400`} />
                        <span className={`text-${typeConfig.color}-400`}>{typeConfig.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300 capitalize">{domain.auto_contact_type}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        {domain.auto_approve_users && (
                          <span className="px-2 py-1 bg-brand-500/10 text-brand-400 rounded">
                            Auto-approve
                          </span>
                        )}
                        {!domain.require_email_verification && (
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
                            Skip verification
                          </span>
                        )}
                        {domain.sso_enabled && (
                          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded">
                            SSO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {domain.is_verified ? (
                        <span className="flex items-center gap-1 text-brand-400">
                          <CheckCircleIcon className="h-4 w-4" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400">
                          <XCircleIcon className="h-4 w-4" />
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(domain)}
                          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(domain.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-slate-100">
                {editingDomain ? 'Edit Domain' : 'Add Domain'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Domain
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg text-slate-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase() })}
                    placeholder="acmecorp.com"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-r-lg text-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Domain Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(DOMAIN_TYPE_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, domain_type: type as any })}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        formData.domain_type === type
                          ? `border-${config.color}-500 bg-${config.color}-500/10`
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className={`text-sm font-medium text-${config.color}-400`}>
                        {config.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{config.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Auto-assign Contact Type
                </label>
                <select
                  value={formData.auto_contact_type}
                  onChange={(e) => setFormData({ ...formData, auto_contact_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="employee">Employee</option>
                  <option value="contractor">Contractor</option>
                  <option value="vendor">Vendor</option>
                  <option value="customer">Customer</option>
                  <option value="partner">Partner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Main company domain"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_approve_users}
                    onChange={(e) => setFormData({ ...formData, auto_approve_users: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-slate-300">Auto-approve new users from this domain</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!formData.require_email_verification}
                    onChange={(e) => setFormData({ ...formData, require_email_verification: !e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-slate-300">Skip email verification for this domain</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_self_registration}
                    onChange={(e) => setFormData({ ...formData, allow_self_registration: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-slate-300">Allow self-registration from this domain</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingDomain(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                >
                  {editingDomain ? 'Save Changes' : 'Add Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
