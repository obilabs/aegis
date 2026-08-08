'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpenIcon,
  PlusIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  PencilIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  EyeIcon,
  HandThumbUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

interface KBContributor {
  id: string
  user_id: string | null
  contact_id: string | null
  display_name: string
  bio: string | null
  expertise_areas: string[]
  is_active: boolean
  is_featured: boolean
  requires_approval: boolean
  can_self_publish: boolean
  articles_published: number
  articles_drafted: number
  total_views: number
  total_helpful_votes: number
  user_email?: string
  contact_email?: string
  created_at: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

export default function KBContributorsPage() {
  const [contributors, setContributors] = useState<KBContributor[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContributor, setEditingContributor] = useState<KBContributor | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    display_name: '',
    bio: '',
    expertise_areas: '',
    requires_approval: true,
    can_self_publish: false,
    is_featured: false,
  })

  useEffect(() => {
    fetchContributors()
    fetchUsers()
  }, [])

  const fetchContributors = async () => {
    try {
      const res = await fetch('/api/settings/kb-contributors')
      if (res.ok) {
        const data = await res.json()
        setContributors(data.contributors || [])
      }
    } catch (error) {
      console.error('Failed to fetch contributors:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/settings/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingContributor
        ? `/api/settings/kb-contributors/${editingContributor.id}`
        : '/api/settings/kb-contributors'

      const res = await fetch(url, {
        method: editingContributor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expertise_areas: formData.expertise_areas
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      })

      if (res.ok) {
        fetchContributors()
        setShowAddModal(false)
        setEditingContributor(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save contributor:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this contributor?')) return

    try {
      const res = await fetch(`/api/settings/kb-contributors/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchContributors()
      }
    } catch (error) {
      console.error('Failed to delete contributor:', error)
    }
  }

  const toggleActive = async (contributor: KBContributor) => {
    try {
      await fetch(`/api/settings/kb-contributors/${contributor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !contributor.is_active }),
      })
      fetchContributors()
    } catch (error) {
      console.error('Failed to toggle contributor:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      user_id: '',
      display_name: '',
      bio: '',
      expertise_areas: '',
      requires_approval: true,
      can_self_publish: false,
      is_featured: false,
    })
  }

  const openEditModal = (contributor: KBContributor) => {
    setEditingContributor(contributor)
    setFormData({
      user_id: contributor.user_id || '',
      display_name: contributor.display_name || '',
      bio: contributor.bio || '',
      expertise_areas: contributor.expertise_areas?.join(', ') || '',
      requires_approval: contributor.requires_approval,
      can_self_publish: contributor.can_self_publish,
      is_featured: contributor.is_featured,
    })
    setShowAddModal(true)
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
        <div className="flex items-center gap-4">
          <Link
            href="/portal/settings"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">KB Contributors</h1>
            <p className="text-slate-400 mt-1">
              Allow team leads and SMEs to contribute to the knowledge base
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingContributor(null)
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Contributor
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h3 className="font-medium text-slate-200 mb-2">About KB Contributors</h3>
        <p className="text-sm text-slate-400">
          Contributors can create and edit knowledge base articles. By default, their articles
          require approval before publishing. You can grant trusted contributors the ability to
          self-publish without review.
        </p>
      </div>

      {/* Contributors List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {contributors.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpenIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No contributors yet</h3>
            <p className="text-slate-500 mb-4">
              Add team members who can contribute to the knowledge base
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add First Contributor
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {contributors.map((contributor) => (
              <div
                key={contributor.id}
                className="p-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-200">
                          {contributor.display_name}
                        </h3>
                        {contributor.is_featured && (
                          <SparklesIcon className="h-4 w-4 text-amber-400" title="Featured Contributor" />
                        )}
                        {!contributor.is_active && (
                          <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {contributor.user_email || contributor.contact_email}
                      </p>
                      {contributor.expertise_areas?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contributor.expertise_areas.map((area) => (
                            <span
                              key={area}
                              className="px-2 py-0.5 text-xs bg-brand-500/10 text-brand-400 rounded"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      )}
                      {contributor.bio && (
                        <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                          {contributor.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-400">
                          <DocumentTextIcon className="h-4 w-4" />
                          <span className="font-medium text-slate-200">
                            {contributor.articles_published}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">Published</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-400">
                          <EyeIcon className="h-4 w-4" />
                          <span className="font-medium text-slate-200">
                            {contributor.total_views?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">Views</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-400">
                          <HandThumbUpIcon className="h-4 w-4" />
                          <span className="font-medium text-slate-200">
                            {contributor.total_helpful_votes || 0}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">Helpful</div>
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="flex items-center gap-2">
                      {contributor.can_self_publish ? (
                        <span className="px-2 py-1 text-xs bg-brand-500/10 text-brand-400 rounded">
                          Self-publish
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-amber-500/10 text-amber-400 rounded">
                          Needs approval
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(contributor)}
                        className={`p-2 rounded-lg transition-colors ${
                          contributor.is_active
                            ? 'text-brand-400 hover:bg-brand-500/10'
                            : 'text-slate-500 hover:bg-slate-800'
                        }`}
                        title={contributor.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {contributor.is_active ? (
                          <CheckCircleIcon className="h-5 w-5" />
                        ) : (
                          <XCircleIcon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(contributor)}
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(contributor.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-slate-100">
                {editingContributor ? 'Edit Contributor' : 'Add Contributor'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingContributor && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select User
                  </label>
                  <select
                    value={formData.user_id}
                    onChange={(e) => {
                      const user = users.find((u) => u.id === e.target.value)
                      setFormData({
                        ...formData,
                        user_id: e.target.value,
                        display_name: user?.name || '',
                      })
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                    required
                  >
                    <option value="">Select a user...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email}) - {user.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="John Smith"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bio (optional)
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brief description of expertise..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Expertise Areas (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.expertise_areas}
                  onChange={(e) =>
                    setFormData({ ...formData, expertise_areas: e.target.value })
                  }
                  placeholder="VPN, Email, Security, Networking"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.can_self_publish}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        can_self_publish: e.target.checked,
                        requires_approval: !e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-slate-300">Can self-publish articles</span>
                    <p className="text-xs text-slate-500">
                      Skip approval workflow for this contributor
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) =>
                      setFormData({ ...formData, is_featured: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-slate-300">Featured contributor</span>
                    <p className="text-xs text-slate-500">
                      Show on KB homepage and author pages
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingContributor(null)
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
                  {editingContributor ? 'Save Changes' : 'Add Contributor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
