'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Asset {
  id: string
  name: string
  asset_tag: string | null
  type: string | null
  make: string | null
  model: string | null
  serial_number: string | null
  os: string | null
  status: string
  primary_ip: string | null
  mac_address: string | null
  purchase_date: string | null
  warranty_expire: string | null
  install_date: string | null
  notes: string | null
  contact_id: string | null
  contact_name: string | null
  contact_is_deleted: boolean
  contact_email: string | null
  contact_phone: string | null
  company_id: string | null
  company_name: string | null
  location_id: string | null
  location_name: string | null
  location_address: string | null
  created_at: string
  updated_at: string
  tickets: RelatedTicket[]
}

interface RelatedTicket {
  id: string
  ticket_number: number
  prefix: string
  subject: string
  status: string
  status_color: string
  created_at: string
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-brand-500/20 text-brand-400 border-brand-500/30'
    case 'inactive': return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    case 'maintenance': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'retired': return 'bg-red-500/20 text-red-400 border-red-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    async function fetchAsset() {
      try {
        const res = await fetch(`/api/portal/assets/${params.id}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Asset not found')
          } else {
            setError('Failed to load asset')
          }
          return
        }
        setAsset(await res.json())
      } catch {
        setError('Failed to load asset')
      } finally {
        setLoading(false)
      }
    }
    fetchAsset()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div className="text-center py-12">
        <svg className="h-12 w-12 text-slate-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <h2 className="text-xl font-semibold text-slate-300">{error || 'Asset not found'}</h2>
        <Link href="/portal/assets" className="text-brand-400 hover:text-brand-300 mt-2 inline-block">
          Back to Assets
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tickets', label: 'Tickets', count: asset.tickets.length },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal/assets" className="hover:text-brand-400 flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Assets
        </Link>
        <span>/</span>
        <span className="text-slate-200">{asset.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
            <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{asset.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-slate-400">{asset.make} {asset.model}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(asset.status)}`}>
                {asset.status}
              </span>
              {asset.type && <span className="text-xs text-slate-500">{asset.type}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="bg-slate-800 rounded-lg border border-slate-700">
                <div className="p-4 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-slate-100">Asset Details</h2>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <DetailField label="Type" value={asset.type} />
                  <DetailField label="Serial Number" value={asset.serial_number} />
                  <DetailField label="Asset Tag" value={asset.asset_tag} />
                  <DetailField label="Operating System" value={asset.os} />
                  <DetailField label="IP Address" value={asset.primary_ip} />
                  <DetailField label="MAC Address" value={asset.mac_address} />
                  <DetailField label="Purchase Date" value={formatDate(asset.purchase_date)} />
                  <DetailField label="Install Date" value={formatDate(asset.install_date)} />
                  <DetailField label="Warranty Expiry" value={formatDate(asset.warranty_expire)} />
                </div>
              </div>

              {asset.notes && (
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-100">Notes</h2>
                  </div>
                  <div className="p-4">
                    <p className="text-slate-300 whitespace-pre-wrap">{asset.notes}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'tickets' && (
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-100">Related Tickets</h2>
              </div>
              {asset.tickets.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No tickets linked to this asset</div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {asset.tickets.map((ticket) => {
                    const tNum = `${ticket.prefix || 'TKT'}-${String(ticket.ticket_number).padStart(4, '0')}`
                    return (
                      <Link
                        key={ticket.id}
                        href={`/portal/tickets/${ticket.id}`}
                        className="p-4 flex items-center justify-between hover:bg-slate-700/50 block"
                      >
                        <div>
                          <p className="text-slate-200 font-medium">{ticket.subject}</p>
                          <p className="text-sm text-slate-500 mt-0.5">{tNum} &middot; {formatDate(ticket.created_at)}</p>
                        </div>
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `${ticket.status_color || '#64748b'}20`,
                            color: ticket.status_color || '#64748b',
                          }}
                        >
                          {ticket.status}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Assignment</h2>
            </div>
            <div className="p-4 space-y-4">
              {asset.contact_name && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Assigned To</label>
                  <Link
                    href={`/portal/contacts/${asset.contact_id}`}
                    className="flex items-center gap-2 mt-2 text-slate-200 hover:text-brand-400"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    <div>
                      <p className="font-medium">
                        {asset.contact_name}
                        {asset.contact_is_deleted && <span className="text-red-400/60 ml-1">(Deleted)</span>}
                      </p>
                      {asset.contact_email && <p className="text-sm text-slate-400">{asset.contact_email}</p>}
                    </div>
                  </Link>
                </div>
              )}
              {asset.company_name && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Company</label>
                  <Link
                    href={`/portal/companies/${asset.company_id}`}
                    className="flex items-center gap-2 mt-2 text-slate-200 hover:text-brand-400"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                    <p className="font-medium">{asset.company_name}</p>
                  </Link>
                </div>
              )}
              {asset.location_name && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Location</label>
                  <div className="flex items-start gap-2 mt-2 text-slate-200">
                    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    <div>
                      <p className="font-medium">{asset.location_name}</p>
                      {asset.location_address && <p className="text-sm text-slate-400">{asset.location_address}</p>}
                    </div>
                  </div>
                </div>
              )}
              {!asset.contact_name && !asset.company_name && !asset.location_name && (
                <p className="text-sm text-slate-500">No assignment information</p>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Quick Stats</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-brand-400">{asset.tickets.length}</p>
                <p className="text-xs text-slate-500">Tickets</p>
              </div>
              <div className="text-center p-3 bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-slate-400">{formatDate(asset.updated_at)}</p>
                <p className="text-xs text-slate-500">Last Updated</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <label className="text-xs text-slate-500 uppercase tracking-wider">{label}</label>
      <p className="text-slate-200 mt-1">{value || '—'}</p>
    </div>
  )
}
