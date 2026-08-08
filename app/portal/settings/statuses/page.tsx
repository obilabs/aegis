'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  InboxIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CalendarIcon,
  NoSymbolIcon,
  CubeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

type BaseStatus = 'open' | 'pending' | 'closed'

interface TicketStatus {
  id: string
  name: string
  color: string
  icon: string
  description: string
  base_status: BaseStatus
  sla_paused: boolean
  is_default: boolean
  is_system: boolean
  is_enabled: boolean
  sort_order: number
}

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  'inbox': <InboxIcon className="h-5 w-5" />,
  'play': <PlayIcon className="h-5 w-5" />,
  'arrow-up': <ArrowsUpDownIcon className="h-5 w-5" />,
  'user-clock': <UserIcon className="h-5 w-5" />,
  'building': <BuildingOfficeIcon className="h-5 w-5" />,
  'users': <UsersIcon className="h-5 w-5" />,
  'calendar': <CalendarIcon className="h-5 w-5" />,
  'ban': <NoSymbolIcon className="h-5 w-5" />,
  'package': <CubeIcon className="h-5 w-5" />,
  'pause': <PauseIcon className="h-5 w-5" />,
  'check-circle': <CheckCircleIcon className="h-5 w-5" />,
  'check': <CheckIcon className="h-5 w-5" />,
  'x-circle': <XCircleIcon className="h-5 w-5" />,
  'clock': <ClockIcon className="h-5 w-5" />,
}

const baseStatusInfo: Record<BaseStatus, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  open: {
    label: 'Open',
    icon: <PlayIcon className="h-4 w-4" />,
    color: 'text-blue-400',
    description: 'SLA timer is counting',
  },
  pending: {
    label: 'Pending',
    icon: <PauseIcon className="h-4 w-4" />,
    color: 'text-yellow-400',
    description: 'SLA timer is paused',
  },
  closed: {
    label: 'Closed',
    icon: <StopIcon className="h-4 w-4" />,
    color: 'text-slate-400',
    description: 'SLA timer stopped',
  },
}

// Default statuses used when API is not yet available (setup wizard hasn't run)
const defaultStatuses: TicketStatus[] = [
  { id: '1', name: 'New', color: '#3b82f6', icon: 'inbox', description: 'Newly created ticket, not yet triaged', base_status: 'open', sla_paused: false, is_default: true, is_system: true, is_enabled: true, sort_order: 10 },
  { id: '2', name: 'In Progress', color: '#eab308', icon: 'play', description: 'Actively being worked on', base_status: 'open', sla_paused: false, is_default: false, is_system: true, is_enabled: true, sort_order: 20 },
  { id: '3', name: 'Pending User', color: '#8b5cf6', icon: 'user-clock', description: 'Waiting for customer response', base_status: 'pending', sla_paused: true, is_default: false, is_system: true, is_enabled: true, sort_order: 30 },
  { id: '4', name: 'Resolved', color: '#22c55e', icon: 'check-circle', description: 'Issue resolved, awaiting confirmation', base_status: 'closed', sla_paused: false, is_default: false, is_system: true, is_enabled: true, sort_order: 70 },
  { id: '5', name: 'Closed', color: '#64748b', icon: 'check', description: 'Ticket complete', base_status: 'closed', sla_paused: false, is_default: false, is_system: true, is_enabled: true, sort_order: 80 },
]

export default function TicketStatusesPage() {
  const [statuses, setStatuses] = useState<TicketStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStatus, setNewStatus] = useState<Partial<TicketStatus>>({
    name: '',
    color: '#6366f1',
    icon: 'clock',
    description: '',
    base_status: 'open',
    sla_paused: false,
    is_enabled: true,
  })

  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch('/api/portal/ticket-statuses')
        if (res.ok) {
          const data = await res.json()
          setStatuses(data.statuses || [])
        } else {
          setStatuses(defaultStatuses)
        }
      } catch {
        setStatuses(defaultStatuses)
      } finally {
        setLoading(false)
      }
    }
    fetchStatuses()
  }, [])

  const toggleEnabled = (id: string) => {
    setStatuses(statuses.map(s => 
      s.id === id ? { ...s, is_enabled: !s.is_enabled } : s
    ))
  }

  const setAsDefault = (id: string) => {
    setStatuses(statuses.map(s => ({
      ...s,
      is_default: s.id === id,
    })))
  }

  const handleAddStatus = () => {
    if (!newStatus.name?.trim()) return
    
    const status: TicketStatus = {
      id: String(statuses.length + 1),
      name: newStatus.name!,
      color: newStatus.color!,
      icon: newStatus.icon!,
      description: newStatus.description || '',
      base_status: newStatus.base_status!,
      sla_paused: newStatus.base_status === 'pending',
      is_default: false,
      is_system: false,
      is_enabled: true,
      sort_order: Math.max(...statuses.map(s => s.sort_order)) + 10,
    }
    
    setStatuses([...statuses, status])
    setShowAddForm(false)
    setNewStatus({
      name: '',
      color: '#6366f1',
      icon: 'clock',
      description: '',
      base_status: 'open',
      sla_paused: false,
      is_enabled: true,
    })
  }

  const groupedStatuses = {
    open: statuses.filter(s => s.base_status === 'open'),
    pending: statuses.filter(s => s.base_status === 'pending'),
    closed: statuses.filter(s => s.base_status === 'closed'),
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
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link href="/portal/settings" className="hover:text-brand-400 flex items-center gap-1">
              <ArrowLeftIcon className="h-4 w-4" />
              Settings
            </Link>
            <span>/</span>
            <span className="text-slate-200">Ticket Statuses</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Ticket Statuses</h1>
          <p className="text-slate-400 mt-1">
            Customize ticket statuses for your workflow. Each status maps to a base status that controls SLA behavior.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Status
        </button>
      </div>

      {/* Base Status Legend */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Base Status Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(baseStatusInfo) as BaseStatus[]).map((key) => {
            const info = baseStatusInfo[key]
            return (
              <div key={key} className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg">
                <div className={`p-2 rounded-lg bg-slate-800 ${info.color}`}>
                  {info.icon}
                </div>
                <div>
                  <p className={`font-medium ${info.color}`}>{info.label}</p>
                  <p className="text-sm text-slate-500">{info.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Status Form */}
      {showAddForm && (
        <div className="bg-slate-800 rounded-lg border border-brand-500/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Add New Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={newStatus.name}
                onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., Waiting for Approval"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Base Status</label>
              <select
                value={newStatus.base_status}
                onChange={(e) => setNewStatus({ 
                  ...newStatus, 
                  base_status: e.target.value as BaseStatus,
                  sla_paused: e.target.value === 'pending',
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="open">Open (SLA counting)</option>
                <option value="pending">Pending (SLA paused)</option>
                <option value="closed">Closed (SLA stopped)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newStatus.color}
                  onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                  className="h-10 w-20 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={newStatus.color}
                  onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Icon</label>
              <select
                value={newStatus.icon}
                onChange={(e) => setNewStatus({ ...newStatus, icon: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="clock">Clock</option>
                <option value="inbox">Inbox</option>
                <option value="play">Play</option>
                <option value="pause">Pause</option>
                <option value="user-clock">User Clock</option>
                <option value="building">Building</option>
                <option value="users">Users</option>
                <option value="calendar">Calendar</option>
                <option value="ban">Ban</option>
                <option value="package">Package</option>
                <option value="check">Check</option>
                <option value="check-circle">Check Circle</option>
                <option value="x-circle">X Circle</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={newStatus.description}
                onChange={(e) => setNewStatus({ ...newStatus, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Brief description of when to use this status"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStatus}
              disabled={!newStatus.name?.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              Add Status
            </button>
          </div>
        </div>
      )}

      {/* Status Groups */}
      {(Object.keys(groupedStatuses) as BaseStatus[]).map((baseStatus) => {
        const info = baseStatusInfo[baseStatus]
        const statusList = groupedStatuses[baseStatus]
        
        return (
          <div key={baseStatus} className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-slate-900 ${info.color}`}>
                {info.icon}
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${info.color}`}>{info.label} Statuses</h2>
                <p className="text-sm text-slate-500">{info.description}</p>
              </div>
              <span className="ml-auto px-2 py-1 text-xs bg-slate-700 rounded-full text-slate-300">
                {statusList.filter(s => s.is_enabled).length} enabled
              </span>
            </div>
            <div className="divide-y divide-slate-700">
              {statusList.map((status) => (
                <div 
                  key={status.id} 
                  className={`p-4 flex items-center gap-4 ${!status.is_enabled ? 'opacity-50' : ''}`}
                >
                  {/* Color & Icon */}
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${status.color}20` }}
                  >
                    <div style={{ color: status.color }}>
                      {iconMap[status.icon] || <ClockIcon className="h-5 w-5" />}
                    </div>
                  </div>
                  
                  {/* Name & Description */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{status.name}</span>
                      {status.is_default && (
                        <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                          Default
                        </span>
                      )}
                      {status.is_system && (
                        <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                          System
                        </span>
                      )}
                      {status.sla_paused && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded flex items-center gap-1">
                          <PauseIcon className="h-3 w-3" /> SLA Paused
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{status.description}</p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!status.is_default && status.is_enabled && (
                      <button
                        onClick={() => setAsDefault(status.id)}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded transition-colors"
                        title="Set as default"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => toggleEnabled(status.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        status.is_enabled 
                          ? 'text-brand-400 hover:bg-brand-500/20' 
                          : 'text-slate-500 hover:bg-slate-700'
                      }`}
                      title={status.is_enabled ? 'Disable' : 'Enable'}
                    >
                      {status.is_enabled ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <XMarkIcon className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {!status.is_system && (
                      <button
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Help Text */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">How Status Mapping Works</h3>
        <ul className="text-sm text-slate-500 space-y-1">
          <li>• <strong className="text-blue-400">Open</strong> statuses keep the SLA timer running - use for active work</li>
          <li>• <strong className="text-yellow-400">Pending</strong> statuses pause the SLA timer - use when waiting on external factors</li>
          <li>• <strong className="text-slate-400">Closed</strong> statuses stop the SLA timer and mark the ticket as complete</li>
          <li>• You can create custom statuses that map to any base status for better visibility</li>
          <li>• System statuses cannot be deleted but can be disabled</li>
        </ul>
      </div>
    </div>
  )
}
