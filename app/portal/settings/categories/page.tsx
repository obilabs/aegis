'use client'

import { useState, useEffect } from 'react'

interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  display_order: number
  is_active: boolean
  description_template: string | null
  subject_prefix: string | null
  parent_id: string | null
  depth: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [maxDepth, setMaxDepth] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTemplate, setEditTemplate] = useState('')
  const [editPrefix, setEditPrefix] = useState('')
  const [editActive, setEditActive] = useState(true)

  // New category form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newParentId, setNewParentId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/portal/settings/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
        if (data.max_depth !== undefined) setMaxDepth(data.max_depth)
      }
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }

  const topLevel = categories.filter(c => !c.parent_id)
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleEdit = (cat: Category) => {
    setEditing(cat)
    setEditName(cat.name)
    setEditDescription(cat.description || '')
    setEditTemplate(cat.description_template || '')
    setEditPrefix(cat.subject_prefix || '')
    setEditActive(cat.is_active !== false)
    setSaveMsg('')
    setShowNewForm(false)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setSaveMsg('')

    try {
      const body: Record<string, unknown> = {
        name: editName.trim() || editing.name,
        description: editDescription.trim() || null,
        description_template: editTemplate.trim() || null,
        subject_prefix: editPrefix.trim() || null,
        is_active: editActive,
      }

      const res = await fetch(`/api/portal/settings/categories/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditing(updated)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? This will also remove any subcategories.`)) return

    try {
      const res = await fetch(`/api/portal/settings/categories/${cat.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
        return
      }
      // Remove from state — includes children via cascade
      setCategories(prev => prev.filter(c => c.id !== cat.id && c.parent_id !== cat.id))
      if (editing?.id === cat.id) setEditing(null)
    } catch {
      alert('Failed to delete category')
    }
  }

  const openNewForm = (parentId: string | null) => {
    setShowNewForm(true)
    setNewParentId(parentId)
    setNewName('')
    setNewDescription('')
    setEditing(null)
    // Auto-expand parent
    if (parentId) setExpandedIds(prev => new Set(prev).add(parentId))
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreatingNew(true)

    try {
      const res = await fetch('/api/portal/settings/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          parent_id: newParentId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }

      const created = await res.json()
      setCategories(prev => [...prev, created])
      setShowNewForm(false)
      setNewName('')
      setNewDescription('')
      // Auto-expand parent to show new child
      if (newParentId) setExpandedIds(prev => new Set(prev).add(newParentId))
      handleEdit(created)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setCreatingNew(false)
    }
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
          <h1 className="text-2xl font-bold text-slate-100">Ticket Categories</h1>
          <p className="text-slate-400 mt-1">
            Manage categories{maxDepth > 0 ? ' and subcategories' : ''}, templates, and prefixes
          </p>
        </div>
        <button
          onClick={() => openNewForm(null)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors text-sm font-medium"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Tree */}
        <div className="lg:col-span-1 space-y-1">
          {topLevel.map(cat => {
            const children = getChildren(cat.id)
            const isExpanded = expandedIds.has(cat.id)
            const isSelected = editing?.id === cat.id
            const hasChildren = children.length > 0

            return (
              <div key={cat.id}>
                {/* Parent category row */}
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-500/10 border-brand-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => handleEdit(cat)}
                >
                  {/* Expand/collapse toggle */}
                  {(hasChildren || maxDepth > 0) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id) }}
                      className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color || '#64748b'}20` }}
                  >
                    <CategoryIcon name={cat.icon} color={cat.color || '#64748b'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200 truncate">{cat.name}</p>
                      {cat.is_active === false && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-400 rounded flex-shrink-0">
                          Off
                        </span>
                      )}
                    </div>
                  </div>
                  {hasChildren && (
                    <span className="text-xs text-slate-500">{children.length}</span>
                  )}
                </div>

                {/* Children */}
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {children.map(child => {
                      const grandchildren = getChildren(child.id)
                      const childExpanded = expandedIds.has(child.id)
                      const childSelected = editing?.id === child.id

                      return (
                        <div key={child.id}>
                          <div
                            className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-pointer ${
                              childSelected
                                ? 'bg-brand-500/10 border-brand-500/50'
                                : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                            }`}
                            onClick={() => handleEdit(child)}
                          >
                            {maxDepth > 1 && (grandchildren.length > 0) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(child.id) }}
                                className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                <svg
                                  className={`h-3.5 w-3.5 transition-transform ${childExpanded ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                              </button>
                            )}
                            <span className="text-sm text-slate-300 truncate flex-1">{child.name}</span>
                            {child.is_active === false && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-400 rounded">Off</span>
                            )}
                          </div>

                          {/* Grandchildren (depth 2) */}
                          {childExpanded && grandchildren.length > 0 && (
                            <div className="ml-5 mt-1 space-y-1">
                              {grandchildren.map(gc => (
                                <div
                                  key={gc.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                                    editing?.id === gc.id
                                      ? 'bg-brand-500/10 border-brand-500/50'
                                      : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600'
                                  }`}
                                  onClick={() => handleEdit(gc)}
                                >
                                  <span className="text-sm text-slate-400 truncate flex-1">{gc.name}</span>
                                  {gc.is_active === false && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-400 rounded">Off</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Add subcategory button */}
                    {cat.depth < maxDepth && (
                      <button
                        onClick={() => openNewForm(cat.id)}
                        className="flex items-center gap-2 p-2 w-full text-left text-xs text-slate-500 hover:text-brand-400 transition-colors rounded-lg hover:bg-slate-800/40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add subcategory
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {categories.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No categories configured. Click "Add Category" to create one.
            </div>
          )}
        </div>

        {/* Edit Panel / New Form */}
        <div className="lg:col-span-2">
          {showNewForm ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-100">
                {newParentId ? 'New Subcategory' : 'New Category'}
              </h2>
              {newParentId && (
                <p className="text-sm text-slate-400">
                  Under: <span className="text-slate-300">{categories.find(c => c.id === newParentId)?.name}</span>
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newParentId ? 'e.g. Laptop Issue' : 'e.g. Hardware'}
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creatingNew || !newName.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 font-medium transition-colors text-sm"
                >
                  {creatingNew ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
          ) : editing ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${editing.color || '#64748b'}20` }}
                  >
                    <CategoryIcon name={editing.icon} color={editing.color || '#64748b'} size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{editing.name}</h2>
                    <p className="text-sm text-slate-400">
                      {editing.parent_id
                        ? `Subcategory of ${categories.find(c => c.id === editing.parent_id)?.name || 'unknown'}`
                        : 'Top-level category'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Add subcategory — only for categories below max depth */}
                  {editing.depth < maxDepth && (
                    <button
                      onClick={() => openNewForm(editing.id)}
                      className="p-2 text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Add subcategory"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(editing)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Delete category"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Brief description of this category"
                  className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>

              {/* Subject Prefix */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Subject Prefix
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Pre-filled at the start of the subject line when this category is selected (e.g. &quot;Hardware: &quot;)
                </p>
                <input
                  type="text"
                  value={editPrefix}
                  onChange={(e) => setEditPrefix(e.target.value)}
                  placeholder="e.g. Hardware: "
                  className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                />
              </div>

              {/* Description Template */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description Template
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Pre-fills the ticket description when this category is selected. Use [brackets] for placeholder text users should replace.
                </p>
                <textarea
                  rows={10}
                  value={editTemplate}
                  onChange={(e) => setEditTemplate(e.target.value)}
                  placeholder={"**What happened?**\n[Describe the issue]\n\n**When did it start?**\n[Date/time]"}
                  className="w-full px-4 py-3 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none font-mono"
                />
                {editTemplate && (
                  <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Preview:</p>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap">
                      {editTemplate}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Active
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inactive categories are hidden from ticket creation forms
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditActive(!editActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editActive ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Save */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                {saveMsg && (
                  <span className={`text-sm ${saveMsg === 'Saved' ? 'text-brand-400' : 'text-red-400'}`}>
                    {saveMsg}
                  </span>
                )}
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 font-medium transition-colors text-sm"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-12 flex flex-col items-center justify-center text-center">
              <svg className="h-12 w-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
              </svg>
              <p className="text-slate-400 text-sm">Select a category from the left to edit</p>
              <p className="text-slate-500 text-xs mt-1">Configure description templates, subcategories, and prefixes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryIcon({ name, color, size = 16 }: { name: string | null; color: string; size?: number }) {
  const style = { color }
  const cls = `flex-shrink-0`

  switch (name) {
    case 'computer-desktop':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
        </svg>
      )
    case 'window':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z" />
        </svg>
      )
    case 'globe-alt':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      )
    case 'user':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      )
    case 'envelope':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      )
    case 'shield-check':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      )
    case 'chat-bubble-left':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      )
    case 'ellipsis-horizontal':
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
      )
    default:
      return (
        <svg className={cls} width={size} height={size} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
      )
  }
}
