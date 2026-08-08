'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  EnvelopeIcon,
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

interface CompanyDomain {
  id: string
  domain: string
  is_primary: boolean
  auto_approve_users: boolean
}

export default function CompanyEmailPage() {
  const [domains, setDomains] = useState<CompanyDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

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

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.trim()) return

    try {
      const res = await fetch('/api/settings/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain.toLowerCase().replace('@', ''),
          domain_type: 'internal',
          auto_contact_type: 'employee',
          auto_approve_users: true,
          require_email_verification: false,
        }),
      })

      if (res.ok) {
        fetchDomains()
        setNewDomain('')
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Failed to add domain:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this email domain?')) return

    try {
      await fetch(`/api/settings/domains/${id}`, { method: 'DELETE' })
      fetchDomains()
    } catch (error) {
      console.error('Failed to delete domain:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/portal/settings"
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Company Email</h1>
          <p className="text-slate-400 mt-1">
            Tell Aegis which email domains belong to your company
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-300">Why set this up?</h3>
          <p className="text-sm text-blue-300/80 mt-1">
            When someone signs up with a company email (like @yourcompany.com), 
            Aegis automatically knows they're an employee. They get access to 
            internal articles and don't need email verification.
          </p>
        </div>
      </div>

      {/* Current Domains */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">Your Company Email Domains</h2>
        </div>

        {domains.length === 0 ? (
          <div className="p-8 text-center">
            <EnvelopeIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No domains set up yet</h3>
            <p className="text-slate-500 mb-4">
              Add your company's email domain so Aegis knows who's an employee
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="p-4 flex items-center justify-between hover:bg-slate-800/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center">
                    <BuildingOfficeIcon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">@{domain.domain}</span>
                      {domain.is_primary && (
                        <span className="px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      Employees signing up with this email are auto-approved
                    </p>
                  </div>
                </div>
                {!domain.is_primary && (
                  <button
                    onClick={() => handleDelete(domain.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Domain Form */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30">
          {showAddForm ? (
            <form onSubmit={handleAddDomain} className="flex items-center gap-3">
              <div className="flex-1 flex items-center">
                <span className="px-3 py-2 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-slate-400">
                  @
                </span>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value.toLowerCase().replace('@', ''))}
                  placeholder="yourcompany.com"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-r-lg text-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewDomain('')
                }}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 text-brand-400 hover:text-brand-300 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add another domain
            </button>
          )}
        </div>
      </div>

      {/* What This Means */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="font-semibold text-slate-100 mb-3">What happens when someone signs up?</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-200">Company email (e.g., alice@yourcompany.com)</p>
              <p className="text-sm text-slate-500">
                → Automatically approved as employee<br/>
                → Can see internal KB articles<br/>
                → No email verification needed
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <UserGroupIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-200">Other email (e.g., bob@gmail.com)</p>
              <p className="text-sm text-slate-500">
                → Marked as external/customer<br/>
                → Can only see public KB articles<br/>
                → Must verify their email
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
