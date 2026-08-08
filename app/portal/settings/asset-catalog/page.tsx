'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  CubeIcon,
  ChevronLeftIcon,
  NoSymbolIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetType {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string
  is_active: boolean
  subtype_count: number
}

interface AssetSubtype {
  id: string
  asset_type_id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
}

interface AssetModel {
  id: string
  asset_subtype_id: string
  name: string
  model_number: string | null
  vendor_name: string | null
  eol_date: string | null
  eos_date: string | null
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_PRESETS: { name: string; value: string; tw: string }[] = [
  { name: 'blue',    value: '#3b82f6', tw: 'bg-blue-500' },
  { name: 'green',   value: '#22c55e', tw: 'bg-green-500' },
  { name: 'amber',   value: '#f59e0b', tw: 'bg-amber-500' },
  { name: 'purple',  value: '#a855f7', tw: 'bg-purple-500' },
  { name: 'slate',   value: '#64748b', tw: 'bg-slate-500' },
  { name: 'cyan',    value: '#06b6d4', tw: 'bg-cyan-500' },
  { name: 'emerald', value: '#10b981', tw: 'bg-brand-500' },
  { name: 'yellow',  value: '#eab308', tw: 'bg-yellow-500' },
  { name: 'red',     value: '#ef4444', tw: 'bg-red-500' },
  { name: 'pink',    value: '#ec4899', tw: 'bg-pink-500' },
  { name: 'stone',   value: '#78716c', tw: 'bg-stone-500' },
]

const MOCK_TYPES: AssetType[] = [
  { id: '1', name: 'Laptop',       description: 'Portable computers',          icon: null, color: '#3b82f6', is_active: true,  subtype_count: 3 },
  { id: '2', name: 'Desktop',      description: 'Stationary workstations',     icon: null, color: '#a855f7', is_active: true,  subtype_count: 2 },
  { id: '3', name: 'Monitor',      description: 'External displays',           icon: null, color: '#06b6d4', is_active: true,  subtype_count: 2 },
  { id: '4', name: 'Peripheral',   description: 'Keyboards, mice, docks, etc', icon: null, color: '#f59e0b', is_active: true,  subtype_count: 4 },
  { id: '5', name: 'Mobile Device', description: 'Phones and tablets',         icon: null, color: '#22c55e', is_active: true,  subtype_count: 2 },
  { id: '6', name: 'Printer',      description: 'Printers and scanners',       icon: null, color: '#78716c', is_active: false, subtype_count: 1 },
]

const MOCK_SUBTYPES: Record<string, AssetSubtype[]> = {
  '1': [
    { id: 's1', asset_type_id: '1', name: 'Windows Laptop',  slug: 'windows-laptop',  description: null, is_active: true },
    { id: 's2', asset_type_id: '1', name: 'MacBook',         slug: 'macbook',          description: null, is_active: true },
    { id: 's3', asset_type_id: '1', name: 'Chromebook',      slug: 'chromebook',       description: null, is_active: true },
  ],
  '2': [
    { id: 's4', asset_type_id: '2', name: 'Standard Desktop', slug: 'standard-desktop', description: null, is_active: true },
    { id: 's5', asset_type_id: '2', name: 'Workstation',      slug: 'workstation',      description: null, is_active: true },
  ],
  '3': [
    { id: 's6', asset_type_id: '3', name: '24" Monitor', slug: '24-monitor', description: null, is_active: true },
    { id: 's7', asset_type_id: '3', name: '27"+ Monitor', slug: '27-plus-monitor', description: null, is_active: true },
  ],
  '4': [
    { id: 's8',  asset_type_id: '4', name: 'Keyboard',      slug: 'keyboard',      description: null, is_active: true },
    { id: 's9',  asset_type_id: '4', name: 'Mouse',          slug: 'mouse',          description: null, is_active: true },
    { id: 's10', asset_type_id: '4', name: 'Docking Station', slug: 'docking-station', description: null, is_active: true },
    { id: 's11', asset_type_id: '4', name: 'Headset',        slug: 'headset',        description: null, is_active: true },
  ],
  '5': [
    { id: 's12', asset_type_id: '5', name: 'Smartphone', slug: 'smartphone', description: null, is_active: true },
    { id: 's13', asset_type_id: '5', name: 'Tablet',     slug: 'tablet',     description: null, is_active: true },
  ],
  '6': [
    { id: 's14', asset_type_id: '6', name: 'Laser Printer', slug: 'laser-printer', description: null, is_active: true },
  ],
}

const MOCK_MODELS: Record<string, AssetModel[]> = {
  's2': [
    { id: 'm1', asset_subtype_id: 's2', name: 'MacBook Pro 14" M3',     model_number: 'MBP14-M3',     vendor_name: 'Apple', eol_date: '2029-11-01', eos_date: '2030-11-01', is_active: true },
    { id: 'm2', asset_subtype_id: 's2', name: 'MacBook Pro 16" M3 Max', model_number: 'MBP16-M3MAX',  vendor_name: 'Apple', eol_date: '2029-11-01', eos_date: '2030-11-01', is_active: true },
    { id: 'm3', asset_subtype_id: 's2', name: 'MacBook Air 15" M3',     model_number: 'MBA15-M3',     vendor_name: 'Apple', eol_date: '2029-06-01', eos_date: '2030-06-01', is_active: true },
  ],
  's1': [
    { id: 'm4', asset_subtype_id: 's1', name: 'ThinkPad X1 Carbon Gen 11', model_number: '21HM',       vendor_name: 'Lenovo', eol_date: '2028-06-01', eos_date: '2029-06-01', is_active: true },
    { id: 'm5', asset_subtype_id: 's1', name: 'Dell Latitude 5540',        model_number: 'LAT-5540',   vendor_name: 'Dell',   eol_date: '2028-03-01', eos_date: '2029-03-01', is_active: true },
  ],
  's4': [
    { id: 'm6', asset_subtype_id: 's4', name: 'Dell OptiPlex 7010',  model_number: 'OPT-7010', vendor_name: 'Dell',    eol_date: '2028-01-01', eos_date: '2029-01-01', is_active: true },
    { id: 'm7', asset_subtype_id: 's4', name: 'HP ProDesk 400 G9',   model_number: 'PD400G9',  vendor_name: 'HP',      eol_date: '2028-06-01', eos_date: '2029-06-01', is_active: true },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function isDatePast(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

// ---------------------------------------------------------------------------
// Component: DropdownMenu (three-dot actions)
// ---------------------------------------------------------------------------

function ActionMenu({
  onEdit,
  onToggleActive,
  isActive,
  label,
}: {
  onEdit: () => void
  onToggleActive: () => void
  isActive: boolean
  label: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-40 py-1 text-sm">
            <button
              onClick={() => {
                onEdit()
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
            >
              <PencilIcon className="h-4 w-4" />
              Edit {label}
            </button>
            <button
              onClick={() => {
                onToggleActive()
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
            >
              {isActive ? (
                <>
                  <NoSymbolIcon className="h-4 w-4 text-red-400" />
                  <span className="text-red-400">Deactivate</span>
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 text-brand-400" />
                  <span className="text-brand-400">Activate</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AssetCatalogPage() {
  // Data state
  const [types, setTypes] = useState<AssetType[]>([])
  const [selectedType, setSelectedType] = useState<AssetType | null>(null)
  const [subtypes, setSubtypes] = useState<AssetSubtype[]>([])
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | null>(null)
  const [models, setModels] = useState<AssetModel[]>([])

  // Loading state
  const [loading, setLoading] = useState(true)
  const [loadingSubtypes, setLoadingSubtypes] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Add/Edit forms
  const [showAddType, setShowAddType] = useState(false)
  const [showAddSubtype, setShowAddSubtype] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [editingItem, setEditingItem] = useState<{ kind: 'type' | 'subtype' | 'model'; data: any } | null>(null)

  // Form data
  const [typeForm, setTypeForm] = useState({ name: '', description: '', icon: '', color: '#3b82f6' })
  const [subtypeForm, setSubtypeForm] = useState({ name: '', description: '' })
  const [modelForm, setModelForm] = useState({ name: '', model_number: '', vendor_name: '', eol_date: '', eos_date: '' })

  // Saving state
  const [savingType, setSavingType] = useState(false)
  const [savingSubtype, setSavingSubtype] = useState(false)
  const [savingModel, setSavingModel] = useState(false)

  // Mobile drill-down navigation
  const [mobileView, setMobileView] = useState<'types' | 'subtypes' | 'models'>('types')

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/settings/asset-types')
      if (res.ok) {
        const data = await res.json()
        setTypes(data.types || data.data || [])
        return
      }
    } catch {
      // API not available yet -- fall back to mock data
    }
    // Use mock data as fallback
    setTypes(MOCK_TYPES)
  }, [])

  useEffect(() => {
    fetchTypes().finally(() => setLoading(false))
  }, [fetchTypes])

  const fetchSubtypes = useCallback(async (typeId: string) => {
    setLoadingSubtypes(true)
    setSubtypes([])
    setSelectedSubtype(null)
    setModels([])
    try {
      const res = await fetch(`/api/portal/settings/asset-types/${typeId}`)
      if (res.ok) {
        const data = await res.json()
        setSubtypes(data.subtypes || data.data?.subtypes || [])
        setLoadingSubtypes(false)
        return
      }
    } catch {
      // fallback
    }
    setSubtypes(MOCK_SUBTYPES[typeId] || [])
    setLoadingSubtypes(false)
  }, [])

  const fetchModels = useCallback(async (subtypeId: string) => {
    setLoadingModels(true)
    setModels([])
    try {
      const res = await fetch(`/api/portal/settings/asset-models?subtype_id=${subtypeId}`)
      if (res.ok) {
        const data = await res.json()
        setModels(data.models || data.data || [])
        setLoadingModels(false)
        return
      }
    } catch {
      // fallback
    }
    setModels(MOCK_MODELS[subtypeId] || [])
    setLoadingModels(false)
  }, [])

  // -------------------------------------------------------------------------
  // Selection handlers
  // -------------------------------------------------------------------------

  const handleSelectType = (type: AssetType) => {
    setSelectedType(type)
    setSelectedSubtype(null)
    setModels([])
    fetchSubtypes(type.id)
    setMobileView('subtypes')
  }

  const handleSelectSubtype = (subtype: AssetSubtype) => {
    setSelectedSubtype(subtype)
    fetchModels(subtype.id)
    setMobileView('models')
  }

  const handleMobileBack = () => {
    if (mobileView === 'models') {
      setMobileView('subtypes')
      setSelectedSubtype(null)
      setModels([])
    } else if (mobileView === 'subtypes') {
      setMobileView('types')
      setSelectedType(null)
      setSubtypes([])
    }
  }

  // -------------------------------------------------------------------------
  // Type CRUD
  // -------------------------------------------------------------------------

  const handleOpenAddType = () => {
    setTypeForm({ name: '', description: '', icon: '', color: '#3b82f6' })
    setEditingItem(null)
    setShowAddType(true)
  }

  const handleEditType = (type: AssetType) => {
    setTypeForm({ name: type.name, description: type.description || '', icon: type.icon || '', color: type.color })
    setEditingItem({ kind: 'type', data: type })
    setShowAddType(true)
  }

  const handleSaveType = async () => {
    if (!typeForm.name.trim()) return
    setSavingType(true)
    try {
      const isEditing = editingItem?.kind === 'type'
      const url = isEditing
        ? `/api/portal/settings/asset-types/${editingItem.data.id}`
        : '/api/portal/settings/asset-types'
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeForm),
      })
      if (res.ok) {
        setShowAddType(false)
        setEditingItem(null)
        await fetchTypes()
        // If we edited the selected type, update it
        if (isEditing && selectedType?.id === editingItem.data.id) {
          setSelectedType(prev => prev ? { ...prev, name: typeForm.name, color: typeForm.color, description: typeForm.description || null, icon: typeForm.icon || null } : null)
        }
      } else {
        // If API not wired, update locally
        if (isEditing) {
          setTypes(prev => prev.map(t => t.id === editingItem.data.id ? { ...t, name: typeForm.name, color: typeForm.color, description: typeForm.description || null, icon: typeForm.icon || null } : t))
          if (selectedType?.id === editingItem.data.id) {
            setSelectedType(prev => prev ? { ...prev, name: typeForm.name, color: typeForm.color, description: typeForm.description || null, icon: typeForm.icon || null } : null)
          }
        } else {
          const newType: AssetType = {
            id: `new-${Date.now()}`,
            name: typeForm.name,
            description: typeForm.description || null,
            icon: typeForm.icon || null,
            color: typeForm.color,
            is_active: true,
            subtype_count: 0,
          }
          setTypes(prev => [...prev, newType])
        }
        setShowAddType(false)
        setEditingItem(null)
      }
    } catch {
      // Local-only fallback
      const isEditing = editingItem?.kind === 'type'
      if (isEditing) {
        setTypes(prev => prev.map(t => t.id === editingItem.data.id ? { ...t, ...typeForm, description: typeForm.description || null, icon: typeForm.icon || null } : t))
      } else {
        const newType: AssetType = {
          id: `new-${Date.now()}`,
          name: typeForm.name,
          description: typeForm.description || null,
          icon: typeForm.icon || null,
          color: typeForm.color,
          is_active: true,
          subtype_count: 0,
        }
        setTypes(prev => [...prev, newType])
      }
      setShowAddType(false)
      setEditingItem(null)
    } finally {
      setSavingType(false)
    }
  }

  const handleToggleTypeActive = async (type: AssetType) => {
    try {
      await fetch(`/api/portal/settings/asset-types/${type.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !type.is_active }),
      })
    } catch {
      // Local-only fallback
    }
    setTypes(prev => prev.map(t => t.id === type.id ? { ...t, is_active: !t.is_active } : t))
    if (selectedType?.id === type.id) {
      setSelectedType(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
    }
  }

  // -------------------------------------------------------------------------
  // Subtype CRUD
  // -------------------------------------------------------------------------

  const handleOpenAddSubtype = () => {
    setSubtypeForm({ name: '', description: '' })
    setEditingItem(null)
    setShowAddSubtype(true)
  }

  const handleEditSubtype = (subtype: AssetSubtype) => {
    setSubtypeForm({ name: subtype.name, description: subtype.description || '' })
    setEditingItem({ kind: 'subtype', data: subtype })
    setShowAddSubtype(true)
  }

  const handleSaveSubtype = async () => {
    if (!subtypeForm.name.trim() || !selectedType) return
    setSavingSubtype(true)
    try {
      const isEditing = editingItem?.kind === 'subtype'
      const url = isEditing
        ? `/api/portal/settings/asset-types/${selectedType.id}/subtypes/${editingItem.data.id}`
        : `/api/portal/settings/asset-types/${selectedType.id}/subtypes`
      const payload = { ...subtypeForm, slug: slugify(subtypeForm.name) }
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowAddSubtype(false)
        setEditingItem(null)
        fetchSubtypes(selectedType.id)
        fetchTypes()
        return
      }
    } catch {
      // fallback
    }
    // Local fallback
    const isEditing = editingItem?.kind === 'subtype'
    if (isEditing) {
      setSubtypes(prev => prev.map(s => s.id === editingItem.data.id ? { ...s, name: subtypeForm.name, slug: slugify(subtypeForm.name), description: subtypeForm.description || null } : s))
    } else {
      const newSubtype: AssetSubtype = {
        id: `new-${Date.now()}`,
        asset_type_id: selectedType.id,
        name: subtypeForm.name,
        slug: slugify(subtypeForm.name),
        description: subtypeForm.description || null,
        is_active: true,
      }
      setSubtypes(prev => [...prev, newSubtype])
      setTypes(prev => prev.map(t => t.id === selectedType.id ? { ...t, subtype_count: t.subtype_count + 1 } : t))
    }
    setShowAddSubtype(false)
    setEditingItem(null)
    setSavingSubtype(false)
  }

  const handleToggleSubtypeActive = async (subtype: AssetSubtype) => {
    if (!selectedType) return
    try {
      await fetch(`/api/portal/settings/asset-types/${selectedType.id}/subtypes/${subtype.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !subtype.is_active }),
      })
    } catch {
      // fallback
    }
    setSubtypes(prev => prev.map(s => s.id === subtype.id ? { ...s, is_active: !s.is_active } : s))
    if (selectedSubtype?.id === subtype.id) {
      setSelectedSubtype(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
    }
  }

  // -------------------------------------------------------------------------
  // Model CRUD
  // -------------------------------------------------------------------------

  const handleOpenAddModel = () => {
    setModelForm({ name: '', model_number: '', vendor_name: '', eol_date: '', eos_date: '' })
    setEditingItem(null)
    setShowAddModel(true)
  }

  const handleEditModel = (model: AssetModel) => {
    setModelForm({
      name: model.name,
      model_number: model.model_number || '',
      vendor_name: model.vendor_name || '',
      eol_date: model.eol_date || '',
      eos_date: model.eos_date || '',
    })
    setEditingItem({ kind: 'model', data: model })
    setShowAddModel(true)
  }

  const handleSaveModel = async () => {
    if (!modelForm.name.trim() || !selectedSubtype) return
    setSavingModel(true)
    try {
      const isEditing = editingItem?.kind === 'model'
      const url = isEditing
        ? `/api/portal/settings/asset-models/${editingItem.data.id}`
        : '/api/portal/settings/asset-models'
      const payload = {
        ...modelForm,
        subtype_id: selectedSubtype.id,
        eol_date: modelForm.eol_date || null,
        eos_date: modelForm.eos_date || null,
      }
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowAddModel(false)
        setEditingItem(null)
        fetchModels(selectedSubtype.id)
        return
      }
    } catch {
      // fallback
    }
    // Local fallback
    const isEditing = editingItem?.kind === 'model'
    if (isEditing) {
      setModels(prev => prev.map(m => m.id === editingItem.data.id ? {
        ...m,
        name: modelForm.name,
        model_number: modelForm.model_number || null,
        vendor_name: modelForm.vendor_name || null,
        eol_date: modelForm.eol_date || null,
        eos_date: modelForm.eos_date || null,
      } : m))
    } else {
      const newModel: AssetModel = {
        id: `new-${Date.now()}`,
        asset_subtype_id: selectedSubtype.id,
        name: modelForm.name,
        model_number: modelForm.model_number || null,
        vendor_name: modelForm.vendor_name || null,
        eol_date: modelForm.eol_date || null,
        eos_date: modelForm.eos_date || null,
        is_active: true,
      }
      setModels(prev => [...prev, newModel])
    }
    setShowAddModel(false)
    setEditingItem(null)
    setSavingModel(false)
  }

  const handleToggleModelActive = async (model: AssetModel) => {
    try {
      await fetch(`/api/portal/settings/asset-models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !model.is_active }),
      })
    } catch {
      // fallback
    }
    setModels(prev => prev.map(m => m.id === model.id ? { ...m, is_active: !m.is_active } : m))
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Link href="/portal/settings" className="hover:text-brand-400 flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" />
            Settings
          </Link>
          <span>/</span>
          <span className="text-slate-200">Asset Catalog</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <CubeIcon className="h-7 w-7" />
          Asset Catalog
        </h1>
        <p className="text-slate-400 mt-1">
          Manage asset types, subtypes, and models
        </p>
      </div>

      {/* Three-column layout (desktop) / stacked with navigation (mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 min-h-[560px]">

        {/* ============================================================= */}
        {/* LEFT COLUMN: Asset Types                                       */}
        {/* ============================================================= */}
        <div className={`bg-slate-800 rounded-lg border border-slate-700 flex flex-col ${
          mobileView !== 'types' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Asset Types</h2>
            <span className="text-xs text-slate-500">{types.filter(t => t.is_active).length} active</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {types.length === 0 ? (
              <div className="p-6 text-center">
                <CubeIcon className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No asset types yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {types.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type)}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors group ${
                      selectedType?.id === type.id
                        ? 'bg-slate-900 border-l-2 border-l-brand-500'
                        : 'hover:bg-slate-700/40 border-l-2 border-l-transparent'
                    } ${!type.is_active ? 'opacity-50' : ''}`}
                  >
                    {/* Color dot */}
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-slate-700"
                      style={{ backgroundColor: type.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{type.name}</p>
                      {type.description && (
                        <p className="text-xs text-slate-500 truncate">{type.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">
                        {type.subtype_count}
                      </span>
                      <ActionMenu
                        onEdit={() => handleEditType(type)}
                        onToggleActive={() => handleToggleTypeActive(type)}
                        isActive={type.is_active}
                        label="Type"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-700">
            <button
              onClick={handleOpenAddType}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-600/30 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Type
            </button>
          </div>
        </div>

        {/* ============================================================= */}
        {/* MIDDLE COLUMN: Subtypes                                        */}
        {/* ============================================================= */}
        <div className={`bg-slate-800 rounded-lg border border-slate-700 flex flex-col ${
          mobileView !== 'subtypes' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              {/* Mobile back button */}
              <button
                onClick={handleMobileBack}
                className="lg:hidden p-1 text-slate-400 hover:text-slate-200 -ml-1"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider truncate">
                  {selectedType ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedType.color }}
                      />
                      {selectedType.name} Subtypes
                    </span>
                  ) : (
                    'Subtypes'
                  )}
                </h2>
              </div>
              {selectedType && subtypes.length > 0 && (
                <span className="text-xs text-slate-500 flex-shrink-0">{subtypes.filter(s => s.is_active).length} active</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedType ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center">
                  <ChevronLeftIcon className="h-5 w-5 text-slate-500 rotate-180" />
                </div>
                <p className="text-sm text-slate-500">Select a type to see its subtypes</p>
              </div>
            ) : loadingSubtypes ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
              </div>
            ) : subtypes.length === 0 ? (
              <div className="p-6 text-center">
                <CubeIcon className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No subtypes yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Add subtypes to categorize {selectedType.name} assets
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {subtypes.map((subtype) => (
                  <button
                    key={subtype.id}
                    onClick={() => handleSelectSubtype(subtype)}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${
                      selectedSubtype?.id === subtype.id
                        ? 'bg-slate-900 border-l-2 border-l-brand-500'
                        : 'hover:bg-slate-700/40 border-l-2 border-l-transparent'
                    } ${!subtype.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{subtype.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{subtype.slug}</p>
                    </div>
                    <ActionMenu
                      onEdit={() => handleEditSubtype(subtype)}
                      onToggleActive={() => handleToggleSubtypeActive(subtype)}
                      isActive={subtype.is_active}
                      label="Subtype"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedType && (
            <div className="p-3 border-t border-slate-700">
              <button
                onClick={handleOpenAddSubtype}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-600/30 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add Subtype
              </button>
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/* RIGHT COLUMN: Models                                           */}
        {/* ============================================================= */}
        <div className={`bg-slate-800 rounded-lg border border-slate-700 flex flex-col ${
          mobileView !== 'models' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              {/* Mobile back button */}
              <button
                onClick={handleMobileBack}
                className="lg:hidden p-1 text-slate-400 hover:text-slate-200 -ml-1"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider truncate">
                  {selectedSubtype ? (
                    <>
                      {selectedSubtype.name} Models
                    </>
                  ) : (
                    'Models'
                  )}
                </h2>
                {selectedType && selectedSubtype && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {selectedType.name} / {selectedSubtype.name}
                  </p>
                )}
              </div>
              {selectedSubtype && models.length > 0 && (
                <span className="text-xs text-slate-500 flex-shrink-0">{models.filter(m => m.is_active).length} active</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedSubtype ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center">
                  <ChevronLeftIcon className="h-5 w-5 text-slate-500 rotate-180" />
                </div>
                <p className="text-sm text-slate-500">Select a subtype to see its models</p>
              </div>
            ) : loadingModels ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
              </div>
            ) : models.length === 0 ? (
              <div className="p-6 text-center">
                <CubeIcon className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No models defined yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Add specific hardware models for tracking
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {models.map((model) => {
                  const eolPast = isDatePast(model.eol_date)
                  const eosPast = isDatePast(model.eos_date)

                  return (
                    <div
                      key={model.id}
                      className={`p-3 transition-colors hover:bg-slate-700/30 ${!model.is_active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-200">{model.name}</p>
                            {!model.is_active && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            {model.model_number && (
                              <span className="font-mono">{model.model_number}</span>
                            )}
                            {model.vendor_name && (
                              <span>{model.vendor_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className={eolPast ? 'text-red-400' : 'text-slate-500'}>
                              {eolPast && <ExclamationTriangleIcon className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                              EOL: {formatDate(model.eol_date)}
                            </span>
                            <span className={eosPast ? 'text-red-400' : 'text-slate-500'}>
                              {eosPast && <ExclamationTriangleIcon className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                              EOS: {formatDate(model.eos_date)}
                            </span>
                          </div>
                        </div>
                        <ActionMenu
                          onEdit={() => handleEditModel(model)}
                          onToggleActive={() => handleToggleModelActive(model)}
                          isActive={model.is_active}
                          label="Model"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {selectedSubtype && (
            <div className="p-3 border-t border-slate-700">
              <button
                onClick={handleOpenAddModel}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-600/30 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add Model
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* INLINE FORM: Add/Edit Type                                        */}
      {/* ================================================================= */}
      {showAddType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingItem?.kind === 'type' ? 'Edit Asset Type' : 'New Asset Type'}
              </h3>
              <button onClick={() => { setShowAddType(false); setEditingItem(null) }} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="e.g., Laptop, Monitor, Peripheral"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  placeholder="Brief description of this asset type"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              {/* Icon (text field) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Icon
                  <span className="text-slate-500 font-normal ml-1">(optional, e.g., laptop, server)</span>
                </label>
                <input
                  type="text"
                  value={typeForm.icon}
                  onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })}
                  placeholder="e.g., laptop"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setTypeForm({ ...typeForm, color: preset.value })}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        typeForm.color === preset.value
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-slate-600 hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="color"
                    value={typeForm.color}
                    onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                    className="h-8 w-12 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={typeForm.color}
                    onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                    className="flex-1 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  {/* Preview dot */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: typeForm.color }}
                    />
                    <span className="text-xs text-slate-400">Preview</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddType(false); setEditingItem(null) }}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveType}
                disabled={!typeForm.name.trim() || savingType}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingType ? 'Saving...' : editingItem?.kind === 'type' ? 'Update Type' : 'Create Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* INLINE FORM: Add/Edit Subtype                                     */}
      {/* ================================================================= */}
      {showAddSubtype && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingItem?.kind === 'subtype' ? 'Edit Subtype' : 'New Subtype'}
              </h3>
              <button onClick={() => { setShowAddSubtype(false); setEditingItem(null) }} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={subtypeForm.name}
                  onChange={(e) => setSubtypeForm({ ...subtypeForm, name: e.target.value })}
                  placeholder="e.g., MacBook, Windows Laptop"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>
              {/* Auto-generated slug preview */}
              {subtypeForm.name.trim() && (
                <div className="px-3 py-2 bg-slate-900 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-500">
                    Slug: <span className="text-slate-300 font-mono">{slugify(subtypeForm.name)}</span>
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                  <span className="text-slate-500 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subtypeForm.description}
                  onChange={(e) => setSubtypeForm({ ...subtypeForm, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddSubtype(false); setEditingItem(null) }}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubtype}
                disabled={!subtypeForm.name.trim() || savingSubtype}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingSubtype ? 'Saving...' : editingItem?.kind === 'subtype' ? 'Update Subtype' : 'Create Subtype'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: Add/Edit Model                                             */}
      {/* ================================================================= */}
      {showAddModel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto pt-8 pb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingItem?.kind === 'model' ? 'Edit Model' : 'New Model'}
              </h3>
              <button onClick={() => { setShowAddModel(false); setEditingItem(null) }} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={modelForm.name}
                  onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                  placeholder="e.g., MacBook Pro 14&quot; M3"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>
              {/* Model Number + Vendor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Model Number</label>
                  <input
                    type="text"
                    value={modelForm.model_number}
                    onChange={(e) => setModelForm({ ...modelForm, model_number: e.target.value })}
                    placeholder="e.g., MBP14-M3"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={modelForm.vendor_name}
                    onChange={(e) => setModelForm({ ...modelForm, vendor_name: e.target.value })}
                    placeholder="e.g., Apple, Dell"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              </div>
              {/* EOL + EOS dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End of Life Date</label>
                  <input
                    type="date"
                    value={modelForm.eol_date}
                    onChange={(e) => setModelForm({ ...modelForm, eol_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End of Support Date</label>
                  <input
                    type="date"
                    value={modelForm.eos_date}
                    onChange={(e) => setModelForm({ ...modelForm, eos_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 [color-scheme:dark]"
                  />
                </div>
              </div>
              {/* Help text */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 p-3">
                <p className="text-xs text-slate-500">
                  EOL (End of Life) means the vendor stops selling or updating the product.
                  EOS (End of Support) means no more patches or technical support.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddModel(false); setEditingItem(null) }}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!modelForm.name.trim() || savingModel}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingModel ? 'Saving...' : editingItem?.kind === 'model' ? 'Update Model' : 'Create Model'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Help Footer                                                       */}
      {/* ================================================================= */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">About the Asset Catalog</h3>
        <ul className="text-sm text-slate-500 space-y-1">
          <li>
            <span className="text-slate-400 font-medium">Types</span> are the broadest categories (Laptop, Monitor, Peripheral, etc.)
          </li>
          <li>
            <span className="text-slate-400 font-medium">Subtypes</span> refine a type (Windows Laptop vs. MacBook vs. Chromebook)
          </li>
          <li>
            <span className="text-slate-400 font-medium">Models</span> are specific products with vendor, model number, and lifecycle dates
          </li>
          <li>
            Deactivated items are hidden from new asset creation but preserved for existing records
          </li>
        </ul>
      </div>
    </div>
  )
}
