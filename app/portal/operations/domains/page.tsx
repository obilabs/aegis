'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  GlobeAltIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

interface Domain {
  id: string
  name: string
  description?: string
  registrar?: string
  expires_at?: string
  auto_renew: boolean
  dns_provider?: string
  webhost?: string
  mail_provider?: string
  is_active: boolean
  is_important: boolean
  company_name?: string
  record_count: number
  cert_count: number
  isExpiring: boolean
  isExpired: boolean
  created_at: string
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/portal/domains')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setDomains(data.domains || [])
      } catch (err) {
        console.error('Failed to load domains:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = domains.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.registrar || '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: domains.length,
    expiring: domains.filter(d => d.isExpiring).length,
    expired: domains.filter(d => d.isExpired).length,
    healthy: domains.filter(d => !d.isExpiring && !d.isExpired).length,
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
      <div className="flex items-center gap-4">
        <Link href="/portal/operations" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <GlobeAltIcon className="h-7 w-7 text-blue-400" />
            Domains
          </h1>
          <p className="text-slate-400 mt-1">Manage domain registrations and DNS</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
          <PlusIcon className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg"><GlobeAltIcon className="h-5 w-5 text-blue-400" /></div>
            <div><p className="text-sm text-slate-400">Total</p><p className="text-xl font-bold text-slate-100">{stats.total}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg"><CheckCircleIcon className="h-5 w-5 text-brand-400" /></div>
            <div><p className="text-sm text-slate-400">Active</p><p className="text-xl font-bold text-brand-400">{stats.healthy}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg"><ClockIcon className="h-5 w-5 text-yellow-400" /></div>
            <div><p className="text-sm text-slate-400">Expiring</p><p className="text-xl font-bold text-yellow-400">{stats.expiring}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg"><ExclamationTriangleIcon className="h-5 w-5 text-red-400" /></div>
            <div><p className="text-sm text-slate-400">Expired</p><p className="text-xl font-bold text-red-400">{stats.expired}</p></div>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="Search domains..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <GlobeAltIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No domains found</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Domain</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Registrar</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Expires</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">DNS Records</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Certs</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((domain) => (
                <tr key={domain.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200">{domain.name}</p>
                      {domain.is_important && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">Important</span>
                      )}
                    </div>
                    {domain.company_name && <p className="text-xs text-slate-500">{domain.company_name}</p>}
                  </td>
                  <td className="p-4 text-sm text-slate-300">{domain.registrar || '-'}</td>
                  <td className="p-4 text-sm text-slate-300">
                    {domain.expires_at ? new Date(domain.expires_at).toLocaleDateString() : '-'}
                    {domain.auto_renew && <span className="ml-1 text-xs text-brand-400">(auto)</span>}
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 text-sm text-slate-300">
                      <DocumentTextIcon className="h-3 w-3" />
                      {domain.record_count}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 text-sm text-slate-300">
                      <ShieldCheckIcon className="h-3 w-3" />
                      {domain.cert_count}
                    </span>
                  </td>
                  <td className="p-4">
                    {domain.isExpired ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <ExclamationTriangleIcon className="h-4 w-4" />Expired
                      </span>
                    ) : domain.isExpiring ? (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <ClockIcon className="h-4 w-4" />Expiring
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-brand-400">
                        <CheckCircleIcon className="h-4 w-4" />Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
