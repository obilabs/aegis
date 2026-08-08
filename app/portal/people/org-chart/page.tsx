'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon,
  EnvelopeIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'

interface OrgPerson {
  id: string
  name: string
  jobTitle: string
  department: string
  location: string
  email: string
  avatar?: string
  reportsToId?: string
  directReportsCount: number
  depth: number
}

// Mock data - hierarchical org structure
const mockOrgData: OrgPerson[] = [
  { id: '1', name: 'Jane Smith', jobTitle: 'CEO', department: 'Executive', location: 'NYC Office', email: 'jane@company.com', directReportsCount: 4, depth: 0 },
  { id: '2', name: 'Tom Brown', jobTitle: 'CTO', department: 'Technology', location: 'SF Office', email: 'tom@company.com', reportsToId: '1', directReportsCount: 3, depth: 1 },
  { id: '3', name: 'Sarah Chen', jobTitle: 'CFO', department: 'Finance', location: 'NYC Office', email: 'sarah@company.com', reportsToId: '1', directReportsCount: 2, depth: 1 },
  { id: '4', name: 'Mike Davis', jobTitle: 'COO', department: 'Operations', location: 'Remote', email: 'mike@company.com', reportsToId: '1', directReportsCount: 3, depth: 1 },
  { id: '5', name: 'Lisa Park', jobTitle: 'CMO', department: 'Marketing', location: 'NYC Office', email: 'lisa@company.com', reportsToId: '1', directReportsCount: 2, depth: 1 },
  // CTO reports
  { id: '6', name: 'Alex Johnson', jobTitle: 'VP Engineering', department: 'Engineering', location: 'SF Office', email: 'alex@company.com', reportsToId: '2', directReportsCount: 4, depth: 2 },
  { id: '7', name: 'Emily White', jobTitle: 'VP Product', department: 'Product', location: 'SF Office', email: 'emily@company.com', reportsToId: '2', directReportsCount: 2, depth: 2 },
  { id: '8', name: 'David Lee', jobTitle: 'IT Director', department: 'IT', location: 'SF Office', email: 'david@company.com', reportsToId: '2', directReportsCount: 3, depth: 2 },
  // VP Engineering reports
  { id: '9', name: 'Chris Martin', jobTitle: 'Engineering Manager', department: 'Engineering', location: 'SF Office', email: 'chris@company.com', reportsToId: '6', directReportsCount: 5, depth: 3 },
  { id: '10', name: 'Rachel Green', jobTitle: 'Engineering Manager', department: 'Engineering', location: 'Remote', email: 'rachel@company.com', reportsToId: '6', directReportsCount: 4, depth: 3 },
  { id: '11', name: 'Kevin Wong', jobTitle: 'QA Lead', department: 'Engineering', location: 'SF Office', email: 'kevin@company.com', reportsToId: '6', directReportsCount: 3, depth: 3 },
  { id: '12', name: 'Amy Chen', jobTitle: 'DevOps Lead', department: 'Engineering', location: 'Remote', email: 'amy@company.com', reportsToId: '6', directReportsCount: 2, depth: 3 },
  // CFO reports
  { id: '13', name: 'John Miller', jobTitle: 'Controller', department: 'Finance', location: 'NYC Office', email: 'john@company.com', reportsToId: '3', directReportsCount: 2, depth: 2 },
  { id: '14', name: 'Susan Taylor', jobTitle: 'FP&A Manager', department: 'Finance', location: 'NYC Office', email: 'susan@company.com', reportsToId: '3', directReportsCount: 1, depth: 2 },
  // COO reports
  { id: '15', name: 'Mark Wilson', jobTitle: 'HR Director', department: 'HR', location: 'NYC Office', email: 'mark@company.com', reportsToId: '4', directReportsCount: 3, depth: 2 },
  { id: '16', name: 'Nancy Brown', jobTitle: 'Facilities Manager', department: 'Operations', location: 'NYC Office', email: 'nancy@company.com', reportsToId: '4', directReportsCount: 2, depth: 2 },
  { id: '17', name: 'Peter Jones', jobTitle: 'Legal Counsel', department: 'Legal', location: 'NYC Office', email: 'peter@company.com', reportsToId: '4', directReportsCount: 1, depth: 2 },
  // CMO reports
  { id: '18', name: 'Jennifer Adams', jobTitle: 'Marketing Director', department: 'Marketing', location: 'NYC Office', email: 'jennifer@company.com', reportsToId: '5', directReportsCount: 4, depth: 2 },
  { id: '19', name: 'Robert Clark', jobTitle: 'Communications Director', department: 'Marketing', location: 'Remote', email: 'robert@company.com', reportsToId: '5', directReportsCount: 2, depth: 2 },
]

interface OrgNodeProps {
  person: OrgPerson
  children: OrgPerson[]
  allPeople: OrgPerson[]
  expandedNodes: Set<string>
  toggleExpand: (id: string) => void
  selectedId?: string
  onSelect: (id: string) => void
  viewMode: 'tree' | 'cards'
}

function OrgNode({ person, children, allPeople, expandedNodes, toggleExpand, selectedId, onSelect, viewMode }: OrgNodeProps) {
  const isExpanded = expandedNodes.has(person.id)
  const hasChildren = children.length > 0
  const isSelected = selectedId === person.id

  if (viewMode === 'cards') {
    return (
      <div className="flex flex-col items-center">
        {/* Person Card */}
        <div
          onClick={() => onSelect(person.id)}
          className={`relative w-48 p-4 rounded-xl border-2 transition-all cursor-pointer ${
            isSelected
              ? 'bg-brand-500/20 border-brand-500 shadow-lg shadow-brand-500/20'
              : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          {/* Avatar */}
          <div className="flex justify-center mb-3">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center text-lg font-semibold ${
              person.depth === 0 ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white' :
              person.depth === 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' :
              'bg-slate-700 text-slate-300'
            }`}>
              {person.name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
          
          {/* Info */}
          <div className="text-center">
            <p className="font-semibold text-slate-100 truncate">{person.name}</p>
            <p className="text-sm text-slate-400 truncate">{person.jobTitle}</p>
            <p className="text-xs text-slate-500 mt-1">{person.department}</p>
          </div>

          {/* Direct reports badge */}
          {hasChildren && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(person.id); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  isExpanded
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <UsersIcon className="h-3 w-3" />
                {person.directReportsCount}
                {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <>
            {/* Connector line */}
            <div className="w-px h-8 bg-slate-700" />
            
            {/* Horizontal line */}
            {children.length > 1 && (
              <div className="relative w-full flex justify-center">
                <div 
                  className="h-px bg-slate-700" 
                  style={{ width: `${Math.min(children.length * 200, 800)}px` }}
                />
              </div>
            )}
            
            {/* Children nodes */}
            <div className="flex gap-4 pt-8">
              {children.map(child => (
                <OrgNode
                  key={child.id}
                  person={child}
                  children={allPeople.filter(p => p.reportsToId === child.id)}
                  allPeople={allPeople}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // Tree view (list style)
  return (
    <div className="select-none">
      <div
        onClick={() => onSelect(person.id)}
        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-brand-500/20' : 'hover:bg-slate-800'
        }`}
        style={{ paddingLeft: `${person.depth * 24 + 8}px` }}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(person.id); }}
            className="p-0.5 hover:bg-slate-700 rounded"
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-slate-400" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Avatar */}
        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
          person.depth === 0 ? 'bg-brand-500/20 text-brand-400' :
          person.depth === 1 ? 'bg-blue-500/20 text-blue-400' :
          'bg-slate-700 text-slate-300'
        }`}>
          {person.name.split(' ').map(n => n[0]).join('')}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-200 truncate">{person.name}</p>
            {hasChildren && (
              <span className="text-xs text-slate-500">({person.directReportsCount})</span>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">{person.jobTitle} • {person.department}</p>
        </div>

        {/* Location */}
        <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
          <MapPinIcon className="h-3 w-3" />
          {person.location}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map(child => (
            <OrgNode
              key={child.id}
              person={child}
              children={allPeople.filter(p => p.reportsToId === child.id)}
              allPeople={allPeople}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const [people, setPeople] = useState<OrgPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '2']))
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>('cards')
  const [departmentFilter, setDepartmentFilter] = useState('All')

  useEffect(() => {
    setTimeout(() => {
      setPeople(mockOrgData)
      setLoading(false)
    }, 500)
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const expandAll = () => {
    setExpandedNodes(new Set(people.map(p => p.id)))
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  // Get unique departments
  const departments = ['All', ...new Set(people.map(p => p.department))]

  // Filter people
  const filteredPeople = people.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = departmentFilter === 'All' || p.department === departmentFilter
    return matchesSearch && matchesDept
  })

  // Get root nodes (no manager)
  const rootNodes = filteredPeople.filter(p => !p.reportsToId)

  // Selected person details
  const selectedPerson = people.find(p => p.id === selectedId)

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
          <h1 className="text-2xl font-bold text-slate-100">Organization Chart</h1>
          <p className="text-slate-400 mt-1">{people.length} people in the organization</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/people"
            className="px-3 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            People List
          </Link>
          <Link
            href="/portal/people/locations"
            className="px-3 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            Location Map
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-slate-500" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'cards' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'tree' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tree
            </button>
          </div>

          {/* Expand/Collapse */}
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              title="Expand all"
            >
              <ArrowsPointingOutIcon className="h-5 w-5" />
            </button>
            <button
              onClick={collapseAll}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              title="Collapse all"
            >
              <ArrowsPointingInIcon className="h-5 w-5" />
            </button>
            <button
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              title="Export"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Org Chart */}
        <div className={`flex-1 bg-slate-800 rounded-lg border border-slate-700 ${
          viewMode === 'cards' ? 'p-8 overflow-x-auto' : 'p-4'
        }`}>
          {viewMode === 'cards' ? (
            <div className="flex justify-center min-w-max">
              {rootNodes.map(person => (
                <OrgNode
                  key={person.id}
                  person={person}
                  children={filteredPeople.filter(p => p.reportsToId === person.id)}
                  allPeople={filteredPeople}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <div>
              {rootNodes.map(person => (
                <OrgNode
                  key={person.id}
                  person={person}
                  children={filteredPeople.filter(p => p.reportsToId === person.id)}
                  allPeople={filteredPeople}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>

        {/* Selected Person Panel */}
        {selectedPerson && (
          <div className="w-80 bg-slate-800 rounded-lg border border-slate-700 p-6 h-fit sticky top-6">
            <div className="text-center mb-6">
              <div className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center text-2xl font-semibold ${
                selectedPerson.depth === 0 ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white' :
                selectedPerson.depth === 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' :
                'bg-slate-700 text-slate-300'
              }`}>
                {selectedPerson.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mt-4">{selectedPerson.name}</h3>
              <p className="text-slate-400">{selectedPerson.jobTitle}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <BuildingOfficeIcon className="h-5 w-5 text-slate-500" />
                <span className="text-slate-300">{selectedPerson.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPinIcon className="h-5 w-5 text-slate-500" />
                <span className="text-slate-300">{selectedPerson.location}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <EnvelopeIcon className="h-5 w-5 text-slate-500" />
                <a href={`mailto:${selectedPerson.email}`} className="text-brand-400 hover:underline">
                  {selectedPerson.email}
                </a>
              </div>
              {selectedPerson.directReportsCount > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  <UsersIcon className="h-5 w-5 text-slate-500" />
                  <span className="text-slate-300">{selectedPerson.directReportsCount} direct reports</span>
                </div>
              )}
            </div>

            {/* Reports To */}
            {selectedPerson.reportsToId && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Reports To</p>
                {(() => {
                  const manager = people.find(p => p.id === selectedPerson.reportsToId)
                  if (!manager) return null
                  return (
                    <button
                      onClick={() => setSelectedId(manager.id)}
                      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
                        {manager.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-200">{manager.name}</p>
                        <p className="text-xs text-slate-500">{manager.jobTitle}</p>
                      </div>
                    </button>
                  )
                })()}
              </div>
            )}

            {/* Direct Reports */}
            {selectedPerson.directReportsCount > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Direct Reports</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {people.filter(p => p.reportsToId === selectedPerson.id).map(report => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedId(report.id)}
                      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
                        {report.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-200">{report.name}</p>
                        <p className="text-xs text-slate-500">{report.jobTitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-slate-700 space-y-2">
              <Link
                href={`/portal/contacts/${selectedPerson.id}`}
                className="block w-full text-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                View Full Profile
              </Link>
              <button className="w-full px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                Send Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-sm text-slate-400">Total People</p>
          <p className="text-2xl font-bold text-slate-100">{people.length}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-sm text-slate-400">Departments</p>
          <p className="text-2xl font-bold text-slate-100">{new Set(people.map(p => p.department)).size}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-sm text-slate-400">Locations</p>
          <p className="text-2xl font-bold text-slate-100">{new Set(people.map(p => p.location)).size}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-sm text-slate-400">Avg Team Size</p>
          <p className="text-2xl font-bold text-slate-100">
            {(people.filter(p => p.directReportsCount > 0).reduce((sum, p) => sum + p.directReportsCount, 0) / 
              people.filter(p => p.directReportsCount > 0).length).toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  )
}
