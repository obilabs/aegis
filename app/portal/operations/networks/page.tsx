'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  GlobeAltIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  ServerIcon,
  MapPinIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

interface Network {
  id: string
  name: string
  description?: string
  network: string
  gateway?: string
  subnet_mask?: string
  dhcp_enabled: boolean
  dhcp_start?: string
  dhcp_end?: string
  vlan_id?: number
  vlan_name?: string
  dns_servers?: string[]
  is_active: boolean
  company_name?: string
  location_name?: string
  created_at: string
}

export default function NetworksPage() {
  const [networks, setNetworks] = useState<Network[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/portal/networks')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setNetworks(data.networks || [])
      } catch (err) {
        console.error('Failed to load networks:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = networks.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.network.includes(search) ||
    (n.vlan_name || '').toLowerCase().includes(search.toLowerCase())
  )

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
            <GlobeAltIcon className="h-7 w-7 text-cyan-400" />
            Networks
          </h1>
          <p className="text-slate-400 mt-1">Manage network documentation</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
          <PlusIcon className="h-4 w-4" />
          Add Network
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg"><GlobeAltIcon className="h-5 w-5 text-cyan-400" /></div>
            <div><p className="text-sm text-slate-400">Total</p><p className="text-xl font-bold text-slate-100">{networks.length}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg"><SignalIcon className="h-5 w-5 text-brand-400" /></div>
            <div><p className="text-sm text-slate-400">DHCP Enabled</p><p className="text-xl font-bold text-brand-400">{networks.filter(n => n.dhcp_enabled).length}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg"><ServerIcon className="h-5 w-5 text-purple-400" /></div>
            <div><p className="text-sm text-slate-400">With VLANs</p><p className="text-xl font-bold text-purple-400">{networks.filter(n => n.vlan_id).length}</p></div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search networks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <GlobeAltIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No networks found</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">CIDR</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Gateway</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">VLAN</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">DHCP</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((net) => (
                <tr key={net.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-slate-200">{net.name}</p>
                    {net.description && <p className="text-xs text-slate-500">{net.description}</p>}
                  </td>
                  <td className="p-4">
                    <code className="text-sm text-slate-300 bg-slate-900 px-2 py-0.5 rounded">{net.network}</code>
                  </td>
                  <td className="p-4 text-sm text-slate-300">{net.gateway || '-'}</td>
                  <td className="p-4">
                    {net.vlan_id ? (
                      <span className="text-sm text-slate-300">
                        VLAN {net.vlan_id}{net.vlan_name ? ` (${net.vlan_name})` : ''}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      net.dhcp_enabled ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {net.dhcp_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-4">
                    {net.location_name ? (
                      <span className="flex items-center gap-1 text-sm text-slate-300">
                        <MapPinIcon className="h-3 w-3" />
                        {net.location_name}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
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
