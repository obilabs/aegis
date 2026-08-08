'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpenIcon,
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  GlobeAltIcon,
  UserGroupIcon,
  LockClosedIcon,
  BuildingOfficeIcon,
  CheckIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

interface KBFolder {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  visibility: 'public' | 'everyone' | 'teams'
  visible_to_teams: string[]
  article_count: number
  is_default: boolean
}

const VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can see (no login required)',
    icon: GlobeAltIcon,
    color: 'emerald',
  },
  {
    value: 'everyone',
    label: 'All Staff',
    description: 'Anyone logged in can see',
    icon: BuildingOfficeIcon,
    color: 'blue',
  },
  {
    value: 'teams',
    label: 'Specific Teams',
    description: 'Only selected teams can see',
    icon: LockClosedIcon,
    color: 'amber',
  },
]

export default function KnowledgeBaseSettingsPage() {
  const [folders, setFolders] = useState<KBFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState<KBFolder | null>(null)
  const [settings, setSettings] = useState({
    anyone_can_publish: false,
    require_approval: true,
    show_author_names: true,
    enable_feedback: true,
  })

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'everyone' as 'public' | 'everyone' | 'teams',
    visible_to_teams: [] as string[],
  })

  useEffect(() => {
    fetchFolders()
    fetchSettings()
  }, [])

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/kb/folders')
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/kb')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings || settings)
      }
    } catch (error) {
      console.error('Failed to fetch KB settings:', error)
    }
  }

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await fetch('/api/settings/kb', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      setSettings(newSettings)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingFolder 
        ? `/api/kb/folders/${editingFolder.id}`
        : '/api/kb/folders'
      
      const res = await fetch(url, {
        method: editingFolder ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        fetchFolders()
        setShowAddModal(false)
        setEditingFolder(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save folder:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this folder? Articles inside will be moved to "Uncategorized".')) return

    try {
      await fetch(`/api/kb/folders/${id}`, { method: 'DELETE' })
      fetchFolders()
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      visibility: 'everyone',
      visible_to_teams: [],
    })
  }

  const openEditModal = (folder: KBFolder) => {
    setEditingFolder(folder)
    setFormData({
      name: folder.name,
      description: folder.description || '',
      visibility: folder.visibility,
      visible_to_teams: folder.visible_to_teams || [],
    })
    setShowAddModal(true)
  }

  const getVisibilityIcon = (visibility: string) => {
    const option = VISIBILITY_OPTIONS.find(o => o.value === visibility)
    if (!option) return null
    const Icon = option.icon
    return <Icon className={`h-4 w-4 text-${option.color}-400`} />
  }

  const getVisibilityLabel = (visibility: string) => {
    return VISIBILITY_OPTIONS.find(o => o.value === visibility)?.label || visibility
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/portal/settings"
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpenIcon className="h-7 w-7" />
            Knowledge Base Settings
          </h1>
          <p className="text-slate-400 mt-1">
            Organize your help articles and control who can see them
          </p>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Publishing Settings</h2>
        
        <div className="space-y-4">
          {/* Anyone Can Publish Toggle */}
          <div className="flex items-start justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-slate-200">Anyone can publish articles</h3>
                <span className="px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                  Recommended for small teams
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Let all team members create and publish KB articles without approval.
                Great for teams under 10 people.
              </p>
            </div>
            <button
              onClick={() => saveSettings({ ...settings, anyone_can_publish: !settings.anyone_can_publish, require_approval: settings.anyone_can_publish })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.anyone_can_publish ? 'bg-brand-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.anyone_can_publish ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Require Approval Toggle (only show if anyone_can_publish is off) */}
          {!settings.anyone_can_publish && (
            <div className="flex items-start justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex-1">
                <h3 className="font-medium text-slate-200">Require approval for new articles</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Articles must be approved by a manager before they're visible.
                </p>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, require_approval: !settings.require_approval })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.require_approval ? 'bg-brand-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.require_approval ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Show Feedback Toggle */}
          <div className="flex items-start justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium text-slate-200">Show "Was this helpful?" on articles</h3>
              <p className="text-sm text-slate-400 mt-1">
                Let readers vote on whether articles answered their question.
              </p>
            </div>
            <button
              onClick={() => saveSettings({ ...settings, enable_feedback: !settings.enable_feedback })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.enable_feedback ? 'bg-brand-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.enable_feedback ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Folders</h2>
            <p className="text-sm text-slate-400">
              Organize articles into folders. Each folder can have different visibility.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setEditingFolder(null)
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            New Folder
          </button>
        </div>

        {folders.length === 0 ? (
          <div className="p-8 text-center">
            <FolderIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No folders yet</h3>
            <p className="text-slate-500 mb-4">
              Create folders to organize your knowledge base articles
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <FolderIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-200">{folder.name}</h3>
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded">
                        {getVisibilityIcon(folder.visibility)}
                        {getVisibilityLabel(folder.visibility)}
                      </span>
                    </div>
                    {folder.description && (
                      <p className="text-sm text-slate-500">{folder.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">
                    {folder.article_count} article{folder.article_count !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(folder)}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {!folder.is_default && (
                      <button
                        onClick={() => handleDelete(folder.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-300">Need help?</h3>
          <p className="text-sm text-blue-300/80 mt-1">
            Check out our <Link href="/kb/how-to-use-knowledge-base" className="underline hover:text-blue-200">guide to using the Knowledge Base</Link> for tips on writing great articles.
          </p>
        </div>
      </div>

      {/* Add/Edit Folder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-slate-100">
                {editingFolder ? 'Edit Folder' : 'New Folder'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Getting Started"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What kind of articles go here?"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Who can see articles in this folder?
                </label>
                <div className="space-y-2">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, visibility: option.value as any })}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                          formData.visibility === option.value
                            ? `border-${option.color}-500 bg-${option.color}-500/10`
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <Icon className={`h-5 w-5 text-${option.color}-400`} />
                        <div className="flex-1">
                          <div className="font-medium text-slate-200">{option.label}</div>
                          <div className="text-xs text-slate-500">{option.description}</div>
                        </div>
                        {formData.visibility === option.value && (
                          <CheckIcon className={`h-5 w-5 text-${option.color}-400`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingFolder(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                >
                  {editingFolder ? 'Save Changes' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
