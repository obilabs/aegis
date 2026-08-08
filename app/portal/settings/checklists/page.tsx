'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ListBulletIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface Template {
  id: string
  name: string
  description: string | null
  category_id: string | null
  category_name: string | null
  is_active: boolean
  item_count: number
  created_at: string
  created_by_name: string | null
}

interface TemplateItem {
  title: string
  description: string
  is_required: boolean
  service_category: string
  default_assignee_type: string
  default_assignee_id: string
}

interface Category {
  id: string
  name: string
}

const EMPTY_ITEM: TemplateItem = {
  title: '',
  description: '',
  is_required: false,
  service_category: '',
  default_assignee_type: 'ticket_assignee',
  default_assignee_id: '',
}

export default function ChecklistTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
  })
  const [items, setItems] = useState<TemplateItem[]>([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchCategories()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/portal/settings/checklist-templates?active=false')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/settings/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || data || [])
      }
    } catch {
      // Categories endpoint may not exist yet
    }
  }

  const handleEdit = async (templateId: string) => {
    try {
      const response = await fetch(`/api/portal/settings/checklist-templates/${templateId}`)
      if (response.ok) {
        const data = await response.json()
        setFormData({
          name: data.template.name,
          description: data.template.description || '',
          category_id: data.template.category_id || '',
        })
        setItems(data.items.length > 0 ? data.items.map((i: any) => ({
          title: i.title,
          description: i.description || '',
          is_required: i.is_required,
          service_category: i.service_category || '',
          default_assignee_type: i.default_assignee_type || 'ticket_assignee',
          default_assignee_id: i.default_assignee_id || '',
        })) : [{ ...EMPTY_ITEM }])
        setEditingId(templateId)
        setShowEditor(true)
      }
    } catch (error) {
      console.error('Error fetching template:', error)
    }
  }

  const handleNew = () => {
    setFormData({ name: '', description: '', category_id: '' })
    setItems([{ ...EMPTY_ITEM }])
    setEditingId(null)
    setShowEditor(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    const validItems = items.filter(i => i.title.trim())
    if (validItems.length === 0) return

    setSaving(true)
    try {
      const url = editingId
        ? `/api/portal/settings/checklist-templates/${editingId}`
        : '/api/portal/settings/checklist-templates'

      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          category_id: formData.category_id || null,
          items: validItems,
        }),
      })

      if (response.ok) {
        setShowEditor(false)
        fetchTemplates()
      }
    } catch (error) {
      console.error('Error saving template:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this checklist template?')) return
    try {
      const response = await fetch(`/api/portal/settings/checklist-templates/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== id))
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const addItem = () => {
    setItems([...items, { ...EMPTY_ITEM }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof TemplateItem, value: any) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Checklist Templates</h1>
          <p className="text-slate-400 mt-1">Reusable task checklists for tickets. Can auto-apply by category.</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
          <ListBulletIcon className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No checklist templates yet</p>
          <p className="text-sm text-slate-500 mt-1">Create templates to standardize task checklists on tickets</p>
          <button
            onClick={handleNew}
            className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500"
          >
            Create First Template
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`bg-slate-800 rounded-lg border border-slate-700 p-4 ${!template.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">{template.name}</h3>
                    {!template.is_active && (
                      <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">Inactive</span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-slate-400 mt-1">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>{template.item_count} items</span>
                    {template.category_name && (
                      <span className="px-1.5 py-0.5 bg-slate-700 rounded">
                        Auto-applies to: {template.category_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(template.id)}
                    className="p-2 text-slate-400 hover:text-brand-400 transition-colors"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto pt-8 pb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingId ? 'Edit Template' : 'New Checklist Template'}
              </h3>
              <button onClick={() => setShowEditor(false)} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., New Employee Onboarding"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="When to use this checklist"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Auto-apply to Category
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="">None (manual only)</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist Items */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Checklist Items</label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 bg-slate-900 rounded-lg p-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(index, 'title', e.target.value)}
                            placeholder="Task title"
                            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          />
                          <label className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_required}
                              onChange={(e) => updateItem(index, 'is_required', e.target.checked)}
                              className="rounded border-slate-600"
                            />
                            Required
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.service_category}
                            onChange={(e) => updateItem(index, 'service_category', e.target.value)}
                            placeholder="Service (e.g., google_workspace)"
                            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          />
                          <select
                            value={item.default_assignee_type}
                            onChange={(e) => updateItem(index, 'default_assignee_type', e.target.value)}
                            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          >
                            <option value="ticket_assignee">Ticket assignee</option>
                            <option value="specific">Specific user</option>
                            <option value="unassigned">Unassigned</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="mt-1 p-1 text-slate-500 hover:text-red-400 transition-colors"
                        disabled={items.length <= 1}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="mt-2 flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Item
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim() || items.filter(i => i.title.trim()).length === 0 || saving}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
