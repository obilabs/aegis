'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MapPinIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ComputerDesktopIcon,
  GlobeAmericasIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  HomeIcon,
  MapIcon,
  ListBulletIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

interface Location {
  id: string
  name: string
  code: string
  level: 'country' | 'region' | 'city' | 'building' | 'floor' | 'office'
  parentId?: string
  path: string
  latitude?: number
  longitude?: number
  employeeCount: number
  assetCount: number
  address?: string
  isRemote?: boolean
  children?: Location[]
}

// Mock hierarchical location data
const mockLocations: Location[] = [
  {
    id: 'ca',
    name: 'Canada',
    code: 'CA',
    level: 'country',
    path: 'Canada',
    employeeCount: 45,
    assetCount: 62,
    latitude: 56.1304,
    longitude: -106.3468,
    children: [
      {
        id: 'ca-ab',
        name: 'Alberta',
        code: 'AB',
        level: 'region',
        parentId: 'ca',
        path: 'Canada/Alberta',
        employeeCount: 28,
        assetCount: 35,
        children: [
          {
            id: 'ca-ab-edm',
            name: 'Edmonton Office',
            code: 'EDM',
            level: 'building',
            parentId: 'ca-ab',
            path: 'Canada/Alberta/Edmonton Office',
            latitude: 53.5461,
            longitude: -113.4938,
            employeeCount: 15,
            assetCount: 20,
            address: '10123 99 St NW, Edmonton, AB T5J 3H1',
          },
          {
            id: 'ca-ab-cal',
            name: 'Calgary Office',
            code: 'CAL',
            level: 'building',
            parentId: 'ca-ab',
            path: 'Canada/Alberta/Calgary Office',
            latitude: 51.0447,
            longitude: -114.0719,
            employeeCount: 13,
            assetCount: 15,
            address: '225 6 Ave SW, Calgary, AB T2P 1N2',
          },
        ],
      },
      {
        id: 'ca-mb',
        name: 'Manitoba',
        code: 'MB',
        level: 'region',
        parentId: 'ca',
        path: 'Canada/Manitoba',
        employeeCount: 17,
        assetCount: 27,
        children: [
          {
            id: 'ca-mb-wpg',
            name: 'Winnipeg HQ',
            code: 'WPG',
            level: 'building',
            parentId: 'ca-mb',
            path: 'Canada/Manitoba/Winnipeg HQ',
            latitude: 49.8951,
            longitude: -97.1384,
            employeeCount: 12,
            assetCount: 18,
            address: '201 Portage Ave, Winnipeg, MB R3B 3K6',
          },
          {
            id: 'ca-mb-bdn',
            name: 'Brandon Office',
            code: 'BDN',
            level: 'building',
            parentId: 'ca-mb',
            path: 'Canada/Manitoba/Brandon Office',
            latitude: 49.8485,
            longitude: -99.9500,
            employeeCount: 5,
            assetCount: 9,
            address: '1039 Princess Ave, Brandon, MB R7A 0P5',
          },
        ],
      },
    ],
  },
  {
    id: 'us',
    name: 'United States',
    code: 'US',
    level: 'country',
    path: 'United States',
    employeeCount: 120,
    assetCount: 180,
    latitude: 37.0902,
    longitude: -95.7129,
    children: [
      {
        id: 'us-ca',
        name: 'California',
        code: 'CA',
        level: 'region',
        parentId: 'us',
        path: 'United States/California',
        employeeCount: 85,
        assetCount: 120,
        children: [
          {
            id: 'us-ca-sf',
            name: 'San Francisco',
            code: 'SF',
            level: 'building',
            parentId: 'us-ca',
            path: 'United States/California/San Francisco',
            latitude: 37.7749,
            longitude: -122.4194,
            employeeCount: 60,
            assetCount: 85,
            address: '100 California St, San Francisco, CA 94111',
          },
          {
            id: 'us-ca-la',
            name: 'Los Angeles',
            code: 'LA',
            level: 'building',
            parentId: 'us-ca',
            path: 'United States/California/Los Angeles',
            latitude: 34.0522,
            longitude: -118.2437,
            employeeCount: 25,
            assetCount: 35,
            address: '633 W 5th St, Los Angeles, CA 90071',
          },
        ],
      },
      {
        id: 'us-ny',
        name: 'New York',
        code: 'NY',
        level: 'region',
        parentId: 'us',
        path: 'United States/New York',
        employeeCount: 35,
        assetCount: 60,
        children: [
          {
            id: 'us-ny-nyc',
            name: 'NYC Office',
            code: 'NYC',
            level: 'building',
            parentId: 'us-ny',
            path: 'United States/New York/NYC Office',
            latitude: 40.7128,
            longitude: -74.0060,
            employeeCount: 35,
            assetCount: 60,
            address: '350 5th Ave, New York, NY 10118',
          },
        ],
      },
    ],
  },
  {
    id: 'remote',
    name: 'Remote Workers',
    code: 'RMT',
    level: 'country',
    path: 'Remote Workers',
    employeeCount: 23,
    assetCount: 30,
    isRemote: true,
    children: [
      {
        id: 'remote-us',
        name: 'Remote - US',
        code: 'RMT-US',
        level: 'region',
        parentId: 'remote',
        path: 'Remote Workers/Remote - US',
        employeeCount: 15,
        assetCount: 18,
        isRemote: true,
      },
      {
        id: 'remote-ca',
        name: 'Remote - Canada',
        code: 'RMT-CA',
        level: 'region',
        parentId: 'remote',
        path: 'Remote Workers/Remote - Canada',
        employeeCount: 5,
        assetCount: 8,
        isRemote: true,
      },
      {
        id: 'remote-eu',
        name: 'Remote - Europe',
        code: 'RMT-EU',
        level: 'region',
        parentId: 'remote',
        path: 'Remote Workers/Remote - Europe',
        employeeCount: 3,
        assetCount: 4,
        isRemote: true,
      },
    ],
  },
]

// Flatten locations for map view
function flattenLocations(locations: Location[]): Location[] {
  const result: Location[] = []
  function traverse(locs: Location[]) {
    for (const loc of locs) {
      result.push(loc)
      if (loc.children) traverse(loc.children)
    }
  }
  traverse(locations)
  return result
}

interface LocationNodeProps {
  location: Location
  expanded: Set<string>
  toggleExpand: (id: string) => void
  selectedId?: string
  onSelect: (id: string) => void
  depth?: number
}

function LocationNode({ location, expanded, toggleExpand, selectedId, onSelect, depth = 0 }: LocationNodeProps) {
  const isExpanded = expanded.has(location.id)
  const hasChildren = location.children && location.children.length > 0
  const isSelected = selectedId === location.id

  const levelIcon = {
    country: GlobeAmericasIcon,
    region: MapPinIcon,
    city: BuildingOfficeIcon,
    building: BuildingOfficeIcon,
    floor: BuildingOfficeIcon,
    office: BuildingOfficeIcon,
  }
  const Icon = location.isRemote ? HomeIcon : levelIcon[location.level]

  return (
    <div>
      <div
        onClick={() => onSelect(location.id)}
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-brand-500/20 border border-brand-500/50' : 'hover:bg-slate-700/50'
        }`}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(location.id); }}
            className="p-1 hover:bg-slate-600 rounded"
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-slate-400" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* Icon */}
        <div className={`p-2 rounded-lg ${
          location.level === 'country' ? 'bg-blue-500/20' :
          location.level === 'region' ? 'bg-purple-500/20' :
          location.isRemote ? 'bg-orange-500/20' :
          'bg-brand-500/20'
        }`}>
          <Icon className={`h-5 w-5 ${
            location.level === 'country' ? 'text-blue-400' :
            location.level === 'region' ? 'text-purple-400' :
            location.isRemote ? 'text-orange-400' :
            'text-brand-400'
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-200">{location.name}</p>
            <span className="text-xs text-slate-500 font-mono">{location.code}</span>
          </div>
          {location.address && (
            <p className="text-xs text-slate-500 truncate">{location.address}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-slate-400">
            <UsersIcon className="h-4 w-4" />
            <span>{location.employeeCount}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <ComputerDesktopIcon className="h-4 w-4" />
            <span>{location.assetCount}</span>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {location.children!.map(child => (
            <LocationNode
              key={child.id}
              location={child}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['ca', 'us', 'remote']))
  const [selectedId, setSelectedId] = useState<string | undefined>()

  useEffect(() => {
    setTimeout(() => {
      setLocations(mockLocations)
      setLoading(false)
    }, 500)
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Get all locations with coordinates for map
  const allLocations = flattenLocations(locations)
  const mapLocations = allLocations.filter(l => l.latitude && l.longitude && !l.isRemote)

  // Selected location
  const selectedLocation = allLocations.find(l => l.id === selectedId)

  // Stats
  const totalEmployees = locations.reduce((sum, l) => sum + l.employeeCount, 0)
  const totalAssets = locations.reduce((sum, l) => sum + l.assetCount, 0)
  const officeCount = mapLocations.filter(l => l.level === 'building').length

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
          <h1 className="text-2xl font-bold text-slate-100">Locations</h1>
          <p className="text-slate-400 mt-1">Office locations and employee distribution</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/people/org-chart"
            className="px-3 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            Org Chart
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
            <PlusIcon className="h-4 w-4" />
            Add Location
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <GlobeAmericasIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Countries</p>
              <p className="text-2xl font-bold text-slate-100">{locations.filter(l => !l.isRemote).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg">
              <BuildingOfficeIcon className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Offices</p>
              <p className="text-2xl font-bold text-slate-100">{officeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <UsersIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Employees</p>
              <p className="text-2xl font-bold text-slate-100">{totalEmployees}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <HomeIcon className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Remote</p>
              <p className="text-2xl font-bold text-slate-100">
                {locations.find(l => l.isRemote)?.employeeCount || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListBulletIcon className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'map' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {viewMode === 'list' ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              {locations.map(location => (
                <LocationNode
                  key={location.id}
                  location={location}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              {/* Map Placeholder - In production, use Mapbox, Google Maps, or Leaflet */}
              <div className="relative h-[600px] bg-slate-900">
                {/* World map background */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-slate-700 text-sm">
                    Interactive map would render here using Mapbox/Leaflet
                  </div>
                </div>
                
                {/* Location markers */}
                <div className="absolute inset-0 p-8">
                  <svg viewBox="0 0 800 400" className="w-full h-full">
                    {/* Simple world outline */}
                    <path
                      d="M100,200 Q200,100 400,150 T700,200 Q600,300 400,250 T100,200"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1"
                    />
                    
                    {/* Location dots */}
                    {mapLocations.filter(l => l.level === 'building').map((loc, i) => {
                      // Simple projection for demo
                      const x = ((loc.longitude! + 130) / 60) * 800
                      const y = ((60 - loc.latitude!) / 40) * 400
                      const size = Math.max(8, Math.min(20, loc.employeeCount / 3))
                      
                      return (
                        <g key={loc.id}>
                          <circle
                            cx={x}
                            cy={y}
                            r={size}
                            className={`cursor-pointer transition-all ${
                              selectedId === loc.id 
                                ? 'fill-brand-500 stroke-brand-300' 
                                : 'fill-blue-500/70 stroke-blue-300/50 hover:fill-blue-400'
                            }`}
                            strokeWidth="2"
                            onClick={() => setSelectedId(loc.id)}
                          />
                          <text
                            x={x}
                            y={y + size + 14}
                            textAnchor="middle"
                            className="fill-slate-400 text-xs"
                          >
                            {loc.code}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Employee Count</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-slate-300">1-20</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-xs text-slate-300">21-40</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-blue-500" />
                      <span className="text-xs text-slate-300">41+</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Location Panel */}
        {selectedLocation && (
          <div className="w-80 bg-slate-800 rounded-lg border border-slate-700 p-6 h-fit sticky top-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${
                selectedLocation.isRemote ? 'bg-orange-500/20' : 'bg-brand-500/20'
              }`}>
                {selectedLocation.isRemote ? (
                  <HomeIcon className="h-6 w-6 text-orange-400" />
                ) : (
                  <BuildingOfficeIcon className="h-6 w-6 text-brand-400" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">{selectedLocation.name}</h3>
                <p className="text-sm text-slate-500 font-mono">{selectedLocation.code}</p>
              </div>
            </div>

            {selectedLocation.address && (
              <div className="mb-4 p-3 bg-slate-900 rounded-lg">
                <p className="text-sm text-slate-400">{selectedLocation.address}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Employees</span>
                <span className="text-slate-200 font-medium">{selectedLocation.employeeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Assets</span>
                <span className="text-slate-200 font-medium">{selectedLocation.assetCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Level</span>
                <span className="text-slate-200 capitalize">{selectedLocation.level}</span>
              </div>
              {selectedLocation.latitude && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Coordinates</span>
                  <span className="text-slate-200 text-sm font-mono">
                    {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude?.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Path</p>
              <p className="text-sm text-slate-300">{selectedLocation.path}</p>
            </div>

            <div className="mt-6 space-y-2">
              <button className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
                View Employees
              </button>
              <button className="w-full px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                View Assets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
