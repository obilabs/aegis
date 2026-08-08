'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Company {
  id: string
  name: string
  abbreviation?: string
  type: 'client' | 'lead' | 'prospect' | 'partner' | 'vendor'
  website?: string
  phone?: string
  email?: string
  city?: string
  state?: string
  country?: string
  industry?: string
  employee_count?: number
  contact_count: number
  asset_count: number
  open_tickets: number
  is_active: boolean
  created_at: string
}

type FilterType = 'all' | 'client' | 'lead' | 'prospect' | 'partner' | 'vendor'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')

  useEffect(() => {
    fetch('/api/portal/companies')
      .then(res => res.json())
      .then(data => setCompanies(data.companies || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'client': return 'bg-brand-500/20 text-brand-400'
      case 'vendor': return 'bg-blue-500/20 text-blue-400'
      case 'partner': return 'bg-purple-500/20 text-purple-400'
      case 'prospect': return 'bg-amber-500/20 text-amber-400'
      case 'lead': return 'bg-cyan-500/20 text-cyan-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const filteredCompanies = companies.filter(company => {
    if (typeFilter !== 'all' && company.type !== typeFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        company.name.toLowerCase().includes(query) ||
        company.abbreviation?.toLowerCase().includes(query) ||
        company.industry?.toLowerCase().includes(query) ||
        company.city?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const typeCounts = {
    all: companies.length,
    client: companies.filter(c => c.type === 'client').length,
    vendor: companies.filter(c => c.type === 'vendor').length,
    partner: companies.filter(c => c.type === 'partner').length,
    prospect: companies.filter(c => c.type === 'prospect').length,
    lead: companies.filter(c => c.type === 'lead').length,
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
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-slate-400 mt-1">Manage clients, vendors, and partners</p>
        </div>
        <Link
          href="/portal/companies/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Company
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total', count: typeCounts.all, color: 'slate' },
          { label: 'Clients', count: typeCounts.client, color: 'emerald' },
          { label: 'Vendors', count: typeCounts.vendor, color: 'blue' },
          { label: 'Partners', count: typeCounts.partner, color: 'purple' },
          { label: 'Prospects', count: typeCounts.prospect, color: 'amber' },
          { label: 'Leads', count: typeCounts.lead, color: 'cyan' },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setTypeFilter(stat.label.toLowerCase() as FilterType)}
            className={`bg-slate-900 rounded-lg border p-4 text-left transition-colors ${
              typeFilter === stat.label.toLowerCase()
                ? 'border-brand-500/50'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <p className="text-xs font-medium text-slate-500 uppercase">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              stat.color === 'emerald' ? 'text-brand-400' :
              stat.color === 'blue' ? 'text-blue-400' :
              stat.color === 'purple' ? 'text-purple-400' :
              stat.color === 'amber' ? 'text-amber-400' :
              stat.color === 'cyan' ? 'text-cyan-400' :
              'text-slate-300'
            }`}>{stat.count}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as FilterType)}
              className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="all">All Types</option>
              <option value="client">Clients</option>
              <option value="vendor">Vendors</option>
              <option value="partner">Partners</option>
              <option value="prospect">Prospects</option>
              <option value="lead">Leads</option>
            </select>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Contacts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assets</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Open Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/portal/companies/${company.id}`} className="block">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                          <span className="text-sm font-bold text-slate-400">
                            {company.abbreviation || company.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white hover:text-brand-400 transition-colors">{company.name}</p>
                          {company.industry && (
                            <p className="text-xs text-slate-500">{company.industry}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${getTypeColor(company.type)}`}>
                      {company.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {company.city ? (
                      <span className="text-sm text-slate-400">
                        {company.city}{company.state && `, ${company.state}`}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/portal/contacts?company=${company.id}`} className="text-sm text-slate-300 hover:text-brand-400">
                      {company.contact_count}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {company.asset_count > 0 ? (
                      <Link href={`/portal/assets?company=${company.id}`} className="text-sm text-slate-300 hover:text-brand-400">
                        {company.asset_count}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {company.open_tickets > 0 ? (
                      <Link href={`/portal/tickets?company=${company.id}`} className="text-sm text-amber-400 hover:text-amber-300">
                        {company.open_tickets}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCompanies.length === 0 && (
          <div className="p-12 text-center">
            <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
            <p className="text-slate-400">No companies found</p>
            <p className="text-sm text-slate-600 mt-1">Try adjusting your filters or add a new company</p>
          </div>
        )}
      </div>
    </div>
  )
}
