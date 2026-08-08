'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  mobile?: string
  title?: string
  department?: string
  company_id?: string
  company_name?: string
  contact_type: 'employee' | 'customer' | 'vendor' | 'partner'
  is_primary: boolean
  is_technical: boolean
  is_billing: boolean
  is_vip: boolean
  has_portal_access: boolean
  ticket_count: number
  last_ticket_at?: string
  created_at: string
}

type FilterType = 'all' | 'employee' | 'customer' | 'vendor' | 'partner'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  useEffect(() => {
    fetch('/api/portal/contacts')
      .then(res => res.json())
      .then(data => setContacts(data.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const departments = ['all', ...new Set(contacts.filter(c => c.department).map(c => c.department!))]

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'employee': return 'bg-blue-500/20 text-blue-400'
      case 'customer': return 'bg-brand-500/20 text-brand-400'
      case 'vendor': return 'bg-purple-500/20 text-purple-400'
      case 'partner': return 'bg-amber-500/20 text-amber-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'employee':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        )
      case 'customer':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        )
      case 'vendor':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
          </svg>
        )
      case 'partner':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        )
      default:
        return null
    }
  }

  const filteredContacts = contacts.filter(contact => {
    if (typeFilter !== 'all' && contact.contact_type !== typeFilter) return false
    if (departmentFilter !== 'all' && contact.department !== departmentFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase()
      return (
        fullName.includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        contact.title?.toLowerCase().includes(query) ||
        contact.company_name?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const typeCounts = {
    all: contacts.length,
    employee: contacts.filter(c => c.contact_type === 'employee').length,
    customer: contacts.filter(c => c.contact_type === 'customer').length,
    vendor: contacts.filter(c => c.contact_type === 'vendor').length,
    partner: contacts.filter(c => c.contact_type === 'partner').length,
  }

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-slate-400 mt-1">Employees, customers, vendors, and partners</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portal/admin/contacts/trash"
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Deleted Contacts
          </Link>
          <Link
            href="/portal/contacts/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Contact
          </Link>
        </div>
      </div>

      {/* Type Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'All', count: typeCounts.all, type: 'all' as FilterType, color: 'slate', desc: 'Total contacts' },
          { label: 'Employees', count: typeCounts.employee, type: 'employee' as FilterType, color: 'blue', desc: 'Internal staff' },
          { label: 'Customers', count: typeCounts.customer, type: 'customer' as FilterType, color: 'emerald', desc: 'Customer contacts' },
          { label: 'Vendors', count: typeCounts.vendor, type: 'vendor' as FilterType, color: 'purple', desc: 'Suppliers' },
          { label: 'Partners', count: typeCounts.partner, type: 'partner' as FilterType, color: 'amber', desc: 'Business partners' },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setTypeFilter(stat.type)}
            className={`bg-slate-900 rounded-lg border p-4 text-left transition-colors ${
              typeFilter === stat.type
                ? 'border-brand-500/50'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 uppercase">{stat.label}</p>
              {stat.type !== 'all' && (
                <span className={`p-1 rounded ${getTypeColor(stat.type)}`}>
                  {getTypeIcon(stat.type)}
                </span>
              )}
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              stat.color === 'blue' ? 'text-blue-400' :
              stat.color === 'emerald' ? 'text-brand-400' :
              stat.color === 'purple' ? 'text-purple-400' :
              stat.color === 'amber' ? 'text-amber-400' :
              'text-slate-300'
            }`}>{stat.count}</p>
            <p className="text-xs text-slate-600 mt-0.5">{stat.desc}</p>
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
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>

          {/* Department Filter (for employees) */}
          {typeFilter === 'employee' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Department:</span>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="all">All Departments</option>
                {departments.filter(d => d !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/portal/contacts/${contact.id}`}
            className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-brand-500/50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-semibold text-white">
                  {contact.first_name[0]}{contact.last_name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-white truncate">
                    {contact.first_name} {contact.last_name}
                  </h3>
                  {contact.is_vip && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">VIP</span>
                  )}
                  {contact.is_primary && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-500/10 text-brand-400 rounded">Primary</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{contact.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${getTypeColor(contact.contact_type)}`}>
                    {contact.contact_type}
                  </span>
                  {contact.is_technical && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-400 rounded">Technical</span>
                  )}
                  {contact.is_billing && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-400 rounded">Billing</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <span className="text-slate-400 truncate">{contact.email}</span>
              </div>
              {contact.company_name && (
                <div className="flex items-center gap-2 text-xs">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                  </svg>
                  <span className="text-slate-400 truncate">{contact.company_name}</span>
                </div>
              )}
              {contact.department && !contact.company_name && (
                <div className="flex items-center gap-2 text-xs">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  <span className="text-slate-400">{contact.department}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{contact.ticket_count} tickets</span>
                {contact.has_portal_access && (
                  <span className="flex items-center gap-1 text-brand-400">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Portal
                  </span>
                )}
              </div>
              {contact.last_ticket_at && (
                <span className="text-slate-600">Last: {formatTimeAgo(contact.last_ticket_at)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
          <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="text-slate-400">No contacts found</p>
          <p className="text-sm text-slate-600 mt-1">Try adjusting your filters or add a new contact</p>
        </div>
      )}
    </div>
  )
}
