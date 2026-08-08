'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ShieldCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'

interface Certificate {
  id: string
  name: string
  domain_name?: string
  san_domains?: string[]
  issuer?: string
  issued_at?: string
  expires_at?: string
  cert_type?: string
  is_wildcard: boolean
  is_active: boolean
  auto_renew: boolean
  linked_domain_name?: string
  company_name?: string
  asset_count: number
  isExpiring: boolean
  isExpired: boolean
  health: 'valid' | 'expiring' | 'expired'
  created_at: string
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/portal/certificates')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setCertificates(data.certificates || [])
      } catch (err) {
        console.error('Failed to load certificates:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = certificates.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.domain_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.issuer || '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: certificates.length,
    valid: certificates.filter(c => c.health === 'valid').length,
    expiring: certificates.filter(c => c.health === 'expiring').length,
    expired: certificates.filter(c => c.health === 'expired').length,
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
            <ShieldCheckIcon className="h-7 w-7 text-brand-400" />
            SSL Certificates
          </h1>
          <p className="text-slate-400 mt-1">Track certificate expiration and renewals</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
          <PlusIcon className="h-4 w-4" />
          Add Certificate
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg"><ShieldCheckIcon className="h-5 w-5 text-slate-400" /></div>
            <div><p className="text-sm text-slate-400">Total</p><p className="text-xl font-bold text-slate-100">{stats.total}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg"><CheckCircleIcon className="h-5 w-5 text-brand-400" /></div>
            <div><p className="text-sm text-slate-400">Valid</p><p className="text-xl font-bold text-brand-400">{stats.valid}</p></div>
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
        <input type="text" placeholder="Search certificates..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <ShieldCheckIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No certificates found</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Certificate</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Domain</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Issuer</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Expires</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Assets</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((cert) => (
                <tr key={cert.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200">{cert.name}</p>
                      {cert.is_wildcard && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">Wildcard</span>
                      )}
                    </div>
                    {cert.cert_type && <p className="text-xs text-slate-500">{cert.cert_type}</p>}
                  </td>
                  <td className="p-4">
                    <code className="text-sm text-slate-300">{cert.domain_name || '-'}</code>
                    {cert.san_domains && cert.san_domains.length > 0 && (
                      <p className="text-xs text-slate-500">+{cert.san_domains.length} SAN{cert.san_domains.length > 1 ? 's' : ''}</p>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-300">{cert.issuer || '-'}</td>
                  <td className="p-4">
                    <p className="text-sm text-slate-300">
                      {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : '-'}
                    </p>
                    {cert.auto_renew && <p className="text-xs text-brand-400">Auto-renew</p>}
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 text-sm text-slate-300">
                      <ServerIcon className="h-3 w-3" />
                      {cert.asset_count}
                    </span>
                  </td>
                  <td className="p-4">
                    {cert.health === 'expired' ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <ExclamationTriangleIcon className="h-4 w-4" />Expired
                      </span>
                    ) : cert.health === 'expiring' ? (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <ClockIcon className="h-4 w-4" />Expiring
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-brand-400">
                        <CheckCircleIcon className="h-4 w-4" />Valid
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
