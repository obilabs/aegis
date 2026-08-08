'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  UserGroupIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

interface User {
  id: string
  name: string
  email: string
  department: string
  jobTitle: string
}

interface Service {
  id: string
  name: string
  category: string
  availableLevels: string[]
}

const mockUsers: User[] = [
  { id: 'u1', name: 'John Smith', email: 'john.smith@company.com', department: 'Engineering', jobTitle: 'Software Engineer' },
  { id: 'u2', name: 'Emily Brown', email: 'emily.brown@company.com', department: 'Marketing', jobTitle: 'Marketing Manager' },
  { id: 'u3', name: 'David Wilson', email: 'david.wilson@company.com', department: 'Engineering', jobTitle: 'Senior Developer' },
  { id: 'u4', name: 'Sarah Chen', email: 'sarah.chen@company.com', department: 'Finance', jobTitle: 'Financial Analyst' },
  { id: 'u5', name: 'Mike Johnson', email: 'mike.johnson@company.com', department: 'IT', jobTitle: 'IT Administrator' },
  { id: 'u6', name: 'Lisa Park', email: 'lisa.park@company.com', department: 'HR', jobTitle: 'HR Specialist' },
  { id: 'u7', name: 'Tom Anderson', email: 'tom.anderson@company.com', department: 'Sales', jobTitle: 'Sales Representative' },
  { id: 'u8', name: 'Rachel Green', email: 'rachel.green@company.com', department: 'Engineering', jobTitle: 'QA Engineer' },
]

const mockServices: Service[] = [
  { id: 's1', name: 'Slack', category: 'Communication', availableLevels: ['Member', 'Admin'] },
  { id: 's2', name: 'GitHub Enterprise', category: 'Development', availableLevels: ['Developer', 'Maintainer', 'Admin'] },
  { id: 's3', name: 'Jira', category: 'Project Management', availableLevels: ['User', 'Project Admin'] },
  { id: 's4', name: 'Confluence', category: 'Documentation', availableLevels: ['User', 'Space Admin'] },
  { id: 's5', name: 'Google Workspace', category: 'Productivity', availableLevels: ['Standard', 'Business'] },
  { id: 's6', name: 'Zoom', category: 'Communication', availableLevels: ['Basic', 'Pro'] },
]

type BulkMode = 'users_to_service' | 'services_to_user'

interface Assignment {
  userId: string
  serviceId: string
  accessLevel: string
}

export default function BulkAssignPage() {
  const router = useRouter()
  const [mode, setMode] = useState<BulkMode>('users_to_service')
  const [userSearch, setUserSearch] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAccessLevels, setSelectedAccessLevels] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Filter users
  const filteredUsers = mockUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.department.toLowerCase().includes(userSearch.toLowerCase())
  )

  // Filter services
  const filteredServices = mockServices.filter(s =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(serviceSearch.toLowerCase())
  )

  // Toggle user selection
  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSelection = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
      
      // Set default access level for newly selected services
      if (!prev.includes(serviceId)) {
        const service = mockServices.find(s => s.id === serviceId)
        if (service) {
          setSelectedAccessLevels(levels => ({
            ...levels,
            [serviceId]: service.availableLevels[0]
          }))
        }
      }
      
      return newSelection
    })
  }

  // Generate assignments preview
  const generateAssignments = (): Assignment[] => {
    const result: Assignment[] = []
    
    if (mode === 'users_to_service') {
      // Multiple users to selected services
      for (const userId of selectedUsers) {
        for (const serviceId of selectedServices) {
          result.push({
            userId,
            serviceId,
            accessLevel: selectedAccessLevels[serviceId] || mockServices.find(s => s.id === serviceId)?.availableLevels[0] || ''
          })
        }
      }
    } else {
      // Multiple services to selected users
      for (const userId of selectedUsers) {
        for (const serviceId of selectedServices) {
          result.push({
            userId,
            serviceId,
            accessLevel: selectedAccessLevels[serviceId] || mockServices.find(s => s.id === serviceId)?.availableLevels[0] || ''
          })
        }
      }
    }
    
    return result
  }

  const previewAssignments = generateAssignments()

  const handleSubmit = async () => {
    setSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    router.push('/portal/access')
  }

  const selectAllUsers = () => {
    setSelectedUsers(filteredUsers.map(u => u.id))
  }

  const selectAllServices = () => {
    const newSelection = filteredServices.map(s => s.id)
    setSelectedServices(newSelection)
    
    // Set default access levels
    const levels: Record<string, string> = {}
    for (const service of filteredServices) {
      levels[service.id] = service.availableLevels[0]
    }
    setSelectedAccessLevels(prev => ({ ...prev, ...levels }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Bulk Access Assignment</h1>
          <p className="text-slate-400 mt-1">Assign multiple users to services or multiple services to users</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">Mode:</span>
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setMode('users_to_service')}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors ${
                mode === 'users_to_service' 
                  ? 'bg-brand-500 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserGroupIcon className="h-4 w-4" />
              Users → Services
            </button>
            <button
              onClick={() => setMode('services_to_user')}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors ${
                mode === 'services_to_user' 
                  ? 'bg-brand-500 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CubeIcon className="h-4 w-4" />
              Services → Users
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {mode === 'users_to_service' 
            ? 'Select users first, then choose which services to grant them access to.'
            : 'Select services first, then choose which users should have access.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Selection */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-slate-400" />
                Select Users
                {selectedUsers.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                    {selectedUsers.length} selected
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllUsers}
                  className="text-xs text-brand-400 hover:underline"
                >
                  Select all
                </button>
                {selectedUsers.length > 0 && (
                  <button
                    onClick={() => setSelectedUsers([])}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={`w-full p-3 flex items-center gap-3 border-b border-slate-700 last:border-0 transition-colors ${
                  selectedUsers.includes(user.id) 
                    ? 'bg-brand-500/10' 
                    : 'hover:bg-slate-700/50'
                }`}
              >
                <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                  selectedUsers.includes(user.id)
                    ? 'bg-brand-500 border-brand-500'
                    : 'border-slate-600'
                }`}>
                  {selectedUsers.includes(user.id) && (
                    <CheckIcon className="h-3 w-3 text-white" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-slate-200">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.jobTitle} • {user.department}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Services Selection */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <CubeIcon className="h-5 w-5 text-slate-400" />
                Select Services
                {selectedServices.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                    {selectedServices.length} selected
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllServices}
                  className="text-xs text-brand-400 hover:underline"
                >
                  Select all
                </button>
                {selectedServices.length > 0 && (
                  <button
                    onClick={() => { setSelectedServices([]); setSelectedAccessLevels({}); }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search services..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className={`p-3 border-b border-slate-700 last:border-0 transition-colors ${
                  selectedServices.includes(service.id) 
                    ? 'bg-blue-500/10' 
                    : ''
                }`}
              >
                <button
                  onClick={() => toggleService(service.id)}
                  className="w-full flex items-center gap-3"
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                    selectedServices.includes(service.id)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-slate-600'
                  }`}>
                    {selectedServices.includes(service.id) && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-200">{service.name}</p>
                    <p className="text-xs text-slate-500">{service.category}</p>
                  </div>
                </button>
                
                {/* Access Level Selection */}
                {selectedServices.includes(service.id) && (
                  <div className="mt-2 ml-8 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Level:</span>
                    <select
                      value={selectedAccessLevels[service.id] || service.availableLevels[0]}
                      onChange={(e) => setSelectedAccessLevels(prev => ({ ...prev, [service.id]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      {service.availableLevels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      {previewAssignments.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-5 w-5 text-slate-400" />
            Assignment Preview
            <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
              {previewAssignments.length} assignments
            </span>
          </h3>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            {previewAssignments.slice(0, 10).map((assignment, idx) => {
              const user = mockUsers.find(u => u.id === assignment.userId)
              const service = mockServices.find(s => s.id === assignment.serviceId)
              
              return (
                <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-slate-900 rounded">
                  <span className="text-slate-300">{user?.name}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-blue-400">{service?.name}</span>
                  <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                    {assignment.accessLevel}
                  </span>
                </div>
              )
            })}
            {previewAssignments.length > 10 && (
              <p className="text-xs text-slate-500 text-center py-2">
                ... and {previewAssignments.length - 10} more assignments
              </p>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-slate-800 border border-slate-700 rounded-lg">
        <InformationCircleIcon className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-400">
          <p>Bulk assignments will be processed immediately. Users will receive notifications about their new access.</p>
          <p className="mt-1">Services requiring approval will create pending access requests instead.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Link
          href="/portal/access"
          className="px-6 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={previewAssignments.length === 0 || submitting}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Processing...
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4" />
              Assign Access ({previewAssignments.length})
            </>
          )}
        </button>
      </div>
    </div>
  )
}
