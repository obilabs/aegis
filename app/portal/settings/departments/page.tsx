'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline'

interface Department {
  id: string
  name: string
  code: string | null
  description: string | null
  parent_id: string | null
  employee_count: number
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchDepartments()
  }, [])

  async function fetchDepartments() {
    try {
      const res = await fetch('/api/portal/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const data = await res.json()
      setDepartments(data.items || [])
    } catch (err) {
      console.error('Error fetching departments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/portal/departments/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addForm.name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create department')
      }
      setShowAdd(false)
      setAddForm({ name: '', code: '', description: '' })
      fetchDepartments()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create department')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id)
    setEditForm({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ name: '', code: '', description: '' })
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.name.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/portal/departments/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim() || null,
          description: editForm.description.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update department')
      }
      setEditingId(null)
      fetchDepartments()
    } catch (err) {
      console.error('Error updating department:', err)
      alert(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/portal/departments/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete department')
      }
      fetchDepartments()
    } catch (err) {
      console.error('Error deleting department:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete department')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="animate-pulse">
          <div className="h-4 w-20 bg-slate-700 rounded mb-3" />
          <div className="h-8 w-48 bg-slate-700 rounded mb-2" />
          <div className="h-4 w-80 bg-slate-700/60 rounded" />
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-slate-700 rounded" />
                  <div className="h-3 w-64 bg-slate-700/50 rounded" />
                </div>
                <div className="h-4 w-16 bg-slate-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Link
            href="/portal/settings"
            className="hover:text-brand-400 flex items-center gap-1 transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Settings
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              <BuildingOffice2Icon className="h-7 w-7 text-brand-400" />
              Departments
            </h1>
            <p className="text-slate-400 mt-1">
              Manage departments in your organization
            </p>
          </div>
          <button
            onClick={() => {
              setShowAdd(true)
              setSaveError(null)
              setAddForm({ name: '', code: '', description: '' })
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Department
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-slate-800 rounded-lg border border-brand-500/30 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">New Department</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g., Engineering"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') setShowAdd(false)
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={addForm.code}
                  onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
                  placeholder="e.g., ENG"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') setShowAdd(false)
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Description
              </label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="Brief description of this department"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') setShowAdd(false)
                }}
              />
            </div>
            {saveError && (
              <p className="text-sm text-red-400">{saveError}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={!addForm.name.trim() || saving}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Creating...' : 'Create Department'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department list */}
      {departments.length === 0 && !showAdd ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
          <BuildingOffice2Icon className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No departments defined yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create departments to organize contacts and employees
          </p>
          <button
            onClick={() => {
              setShowAdd(true)
              setSaveError(null)
              setAddForm({ name: '', code: '', description: '' })
            }}
            className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            Create First Department
          </button>
        </div>
      ) : departments.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-slate-700 grid grid-cols-12 gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">Code</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1 text-right">Employees</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-700/50">
            {departments.map((dept) => (
              <div key={dept.id}>
                {editingId === dept.id ? (
                  /* Editing row */
                  <div className="px-4 py-3 bg-slate-900/50">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={editForm.code}
                          onChange={(e) =>
                            setEditForm({ ...editForm, code: e.target.value })
                          }
                          placeholder="Code"
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                      </div>
                      <div className="col-span-1" />
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editForm.name.trim() || editSaving}
                          className="p-1.5 text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                          title="Save"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display row */
                  <div className="px-4 py-3 grid grid-cols-12 gap-4 items-center group hover:bg-slate-700/20 transition-colors">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <BuildingOffice2Icon className="h-4 w-4 text-brand-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-200 truncate">
                        {dept.name}
                      </span>
                    </div>
                    <div className="col-span-2">
                      {dept.code ? (
                        <span className="px-1.5 py-0.5 text-xs font-mono bg-slate-700/50 text-slate-400 rounded">
                          {dept.code}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">--</span>
                      )}
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm text-slate-400 truncate block">
                        {dept.description || (
                          <span className="text-slate-600">--</span>
                        )}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm text-slate-500">
                        {dept.employee_count}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(dept)}
                        className="p-1.5 text-slate-400 hover:text-brand-400 transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${dept.name}"? This cannot be undone.`
                            )
                          ) {
                            handleDelete(dept.id)
                          }
                        }}
                        disabled={deletingId === dept.id}
                        className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-50 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
