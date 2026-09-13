'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Asset {
  id: string
  name: string
  asset_tag: string | null
  type: string | null
  make: string
  model: string
  serial_number: string | null
  status: 'active' | 'deployed' | 'storage' | 'retired' | 'disposed'
  assigned_to?: string
  contact_is_deleted?: boolean
  location?: string
  primary_ip?: string
  os?: string
  warranty_expire?: string
  updated_at: string
}

type FilterStatus = 'all' | 'active' | 'deployed' | 'storage' | 'retired'
type FilterType = 'all' | 'desktop' | 'laptop' | 'server' | 'network' | 'mobile' | 'printer'

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  useEffect(() => {
    fetch('/api/portal/assets')
      .then(res => res.json())
      .then(data => setAssets(data.assets || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-brand-500/20 text-brand-400'
      case 'deployed': return 'bg-blue-500/20 text-blue-400'
      case 'storage': return 'bg-amber-500/20 text-amber-400'
      case 'retired': return 'bg-slate-600/20 text-slate-400'
      case 'disposed': return 'bg-red-500/20 text-red-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getTypeIcon = (type: string | null) => {
    switch ((type || '').toLowerCase()) {
      case 'desktop':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
          </svg>
        )
      case 'laptop':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-15a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )
      case 'server':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7" />
          </svg>
        )
      case 'network':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
          </svg>
        )
      case 'mobile':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
        )
      case 'printer':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
          </svg>
        )
      default:
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isWarrantyExpiringSoon = (warrantyDate?: string) => {
    if (!warrantyDate) return false
    const warranty = new Date(warrantyDate)
    const now = new Date()
    const threeMonths = 90 * 24 * 60 * 60 * 1000
    return warranty.getTime() - now.getTime() < threeMonths && warranty > now
  }

  const isWarrantyExpired = (warrantyDate?: string) => {
    if (!warrantyDate) return false
    return new Date(warrantyDate) < new Date()
  }

  const filteredAssets = assets.filter(asset => {
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false
    if (typeFilter !== 'all' && (asset.type || '').toLowerCase() !== typeFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        asset.name.toLowerCase().includes(query) ||
        (asset.asset_tag || '').toLowerCase().includes(query) ||
        (asset.serial_number || '').toLowerCase().includes(query) ||
        asset.assigned_to?.toLowerCase().includes(query) ||
        asset.location?.toLowerCase().includes(query)
      )
    }
    return true
  })

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
          <h1 className="text-2xl font-bold text-white">Assets</h1>
          <p className="text-slate-400 mt-1">IT inventory and hardware management</p>
        </div>
        <Link
          href="/portal/assets/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Asset
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', count: assets.length, color: 'slate' },
          { label: 'Active', count: assets.filter(a => a.status === 'active').length, color: 'emerald' },
          { label: 'Deployed', count: assets.filter(a => a.status === 'deployed').length, color: 'blue' },
          { label: 'Storage', count: assets.filter(a => a.status === 'storage').length, color: 'amber' },
          { label: 'Retired', count: assets.filter(a => a.status === 'retired').length, color: 'slate' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              stat.color === 'emerald' ? 'text-brand-400' :
              stat.color === 'blue' ? 'text-blue-400' :
              stat.color === 'amber' ? 'text-amber-400' :
              'text-slate-300'
            }`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="deployed">Deployed</option>
              <option value="storage">Storage</option>
              <option value="retired">Retired</option>
            </select>
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
              <option value="desktop">Desktop</option>
              <option value="laptop">Laptop</option>
              <option value="server">Server</option>
              <option value="network">Network</option>
              <option value="mobile">Mobile</option>
              <option value="printer">Printer</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      {viewMode === 'table' ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Warranty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/portal/assets/${asset.id}`} className="block">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                            {getTypeIcon(asset.type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white hover:text-brand-400 transition-colors">{asset.name}</p>
                            <p className="text-xs text-slate-500">{asset.asset_tag} • {asset.make} {asset.model}</p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-400">{asset.type || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {asset.assigned_to ? (
                        <span className="text-sm text-slate-300">
                          {asset.assigned_to}
                          {asset.contact_is_deleted && <span className="text-red-400/60 ml-1">(Deleted)</span>}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {asset.location ? (
                        <span className="text-sm text-slate-400">{asset.location}</span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {asset.warranty_expire ? (
                        <span className={`text-sm ${
                          isWarrantyExpired(asset.warranty_expire) ? 'text-red-400' :
                          isWarrantyExpiringSoon(asset.warranty_expire) ? 'text-amber-400' :
                          'text-slate-400'
                        }`}>
                          {formatDate(asset.warranty_expire)}
                          {isWarrantyExpired(asset.warranty_expire) && ' (Expired)'}
                          {isWarrantyExpiringSoon(asset.warranty_expire) && ' (Soon)'}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAssets.length === 0 && (
            <div className="p-12 text-center">
              <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3" />
              </svg>
              <p className="text-slate-400">No assets found</p>
              <p className="text-sm text-slate-600 mt-1">Try adjusting your filters or add a new asset</p>
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <Link
              key={asset.id}
              href={`/portal/assets/${asset.id}`}
              className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-brand-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                  {getTypeIcon(asset.type)}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(asset.status)}`}>
                  {asset.status}
                </span>
              </div>
              <h3 className="text-sm font-medium text-white mt-4">{asset.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{asset.make} {asset.model}</p>
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Asset Tag</span>
                  <span className="text-slate-300 font-mono">{asset.asset_tag}</span>
                </div>
                {asset.assigned_to && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Assigned</span>
                    <span className="text-slate-300">
                      {asset.assigned_to}
                      {asset.contact_is_deleted && <span className="text-red-400/60 ml-1">(Deleted)</span>}
                    </span>
                  </div>
                )}
                {asset.primary_ip && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">IP</span>
                    <span className="text-slate-300 font-mono">{asset.primary_ip}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
