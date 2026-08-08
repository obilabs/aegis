'use client'

import { useState, useEffect } from 'react'
import DynamicFormRenderer from '@/components/features/DynamicFormRenderer'
import type { FormField } from '@/components/features/DynamicFormRenderer'

interface CatalogItem {
  id: string
  name: string
  slug: string
  short_description: string | null
  description: string | null
  icon: string | null
  display_order: number
  is_active: boolean
  requires_approval: boolean
  request_form: FormField[] | string
  estimated_fulfillment_days: number | null
  fulfillment_instructions: string | null
  auto_category: string | null
  auto_subcategory: string | null
  application_id: string | null
  owner_id: string | null
  category_name: string | null
  owner_name: string | null
  created_at: string
}

interface Category {
  id: string
  name: string
}

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
]

const dynamicSources = [
  { value: '', label: 'Static options' },
  { value: 'applications', label: 'Applications (dynamic)' },
  { value: 'application.access_levels', label: 'Application Access Levels (dynamic)' },
]

const emptyField: FormField = {
  name: '',
  type: 'text',
  label: '',
  required: false,
}

const emptyForm = {
  name: '',
  slug: '',
  short_description: '',
  description: '',
  icon: '',
  category_id: '',
  requires_approval: false,
  request_form: [] as FormField[],
  estimated_fulfillment_days: '',
  fulfillment_instructions: '',
  auto_category: '',
  display_order: '0',
}

export default function CatalogSettingsPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      const res = await fetch('/api/portal/settings/catalog')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setCategories(data.categories || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function parseFormFields(raw: FormField[] | string): FormField[] {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return [] }
    }
    return raw || []
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setPreviewMode(false)
    setShowModal(true)
  }

  function openEdit(item: CatalogItem) {
    setEditing(item)
    setForm({
      name: item.name,
      slug: item.slug || '',
      short_description: item.short_description || '',
      description: item.description || '',
      icon: item.icon || '',
      category_id: '', // Would need category_id from item
      requires_approval: item.requires_approval,
      request_form: parseFormFields(item.request_form),
      estimated_fulfillment_days: item.estimated_fulfillment_days?.toString() || '',
      fulfillment_instructions: item.fulfillment_instructions || '',
      auto_category: item.auto_category || '',
      display_order: item.display_order?.toString() || '0',
    })
    setPreviewMode(false)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        estimated_fulfillment_days: form.estimated_fulfillment_days
          ? parseInt(form.estimated_fulfillment_days) : null,
        display_order: parseInt(form.display_order) || 0,
        short_description: form.short_description || null,
        description: form.description || null,
        icon: form.icon || null,
        fulfillment_instructions: form.fulfillment_instructions || null,
        auto_category: form.auto_category || null,
        category_id: form.category_id || null,
      }

      if (editing) {
        await fetch(`/api/portal/settings/catalog/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/portal/settings/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setShowModal(false)
      fetchItems()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: CatalogItem) {
    if (item.is_active) {
      await fetch(`/api/portal/settings/catalog/${item.id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/portal/settings/catalog/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
    }
    fetchItems()
  }

  // Form field editor helpers
  function addField() {
    setForm({
      ...form,
      request_form: [...form.request_form, { ...emptyField, name: `field_${form.request_form.length + 1}` }],
    })
  }

  function updateField(index: number, updates: Partial<FormField>) {
    const fields = [...form.request_form]
    fields[index] = { ...fields[index], ...updates }
    // Auto-generate name from label
    if (updates.label && !fields[index].name.includes('_custom')) {
      fields[index].name = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
    }
    setForm({ ...form, request_form: fields })
  }

  function removeField(index: number) {
    setForm({ ...form, request_form: form.request_form.filter((_, i) => i !== index) })
  }

  function moveField(index: number, direction: -1 | 1) {
    const fields = [...form.request_form]
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return
    ;[fields[index], fields[newIndex]] = [fields[newIndex], fields[index]]
    setForm({ ...form, request_form: fields })
  }

  const visible = showInactive ? items : items.filter(i => i.is_active)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Service Catalog</h1>
          <p className="text-slate-400 mt-1">Manage catalog items available for service requests</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
        >
          Add Catalog Item
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-brand-500"
          />
          Show inactive
        </label>
        <span className="text-sm text-slate-500">{visible.length} item{visible.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Category</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Approval</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Form Fields</th>
              <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No catalog items yet. Add your first item to get started.
                </td>
              </tr>
            ) : (
              visible.map((item) => {
                const fields = parseFormFields(item.request_form)
                return (
                  <tr key={item.id} className="hover:bg-slate-700/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.icon && <span className="text-lg">{item.icon}</span>}
                        <div>
                          <p className="font-medium text-slate-200">{item.name}</p>
                          <p className="text-xs text-slate-500">/{item.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                      {item.category_name || '—'}
                    </td>
                    <td className="p-4 text-sm">
                      {item.requires_approval ? (
                        <span className="text-amber-400">Required</span>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                      {fields.length} field{fields.length !== 1 ? 's' : ''}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        item.is_active
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-sm text-slate-400 hover:text-brand-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(item)}
                          className={`text-sm ${item.is_active ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-brand-400'}`}
                        >
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                {editing ? 'Edit Catalog Item' : 'Add Catalog Item'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    previewMode
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {previewMode ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>

            {previewMode ? (
              <div className="p-6">
                <h3 className="text-sm font-medium text-slate-400 mb-4">Form Preview</h3>
                {form.request_form.length === 0 ? (
                  <p className="text-sm text-slate-500">No form fields defined yet.</p>
                ) : (
                  <DynamicFormRenderer
                    fields={form.request_form}
                    values={{}}
                    onChange={() => {}}
                    errors={{}}
                  />
                )}
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                      placeholder="e.g., Application Access"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Slug</label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                      placeholder="auto-generated from name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={form.short_description}
                    onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                    placeholder="Shown on catalog card"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                    rows={2}
                    placeholder="Detailed description shown on request form page"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Est. Fulfillment (days)</label>
                    <input
                      type="number"
                      value={form.estimated_fulfillment_days}
                      onChange={(e) => setForm({ ...form, estimated_fulfillment_days: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Icon</label>
                    <input
                      type="text"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                      placeholder="e.g., key, monitor"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.requires_approval}
                      onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800 text-brand-500"
                    />
                    Requires approval
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Fulfillment Instructions</label>
                  <textarea
                    value={form.fulfillment_instructions}
                    onChange={(e) => setForm({ ...form, fulfillment_instructions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
                    rows={2}
                    placeholder="Instructions for IT staff when fulfilling this request"
                  />
                </div>

                {/* Form Fields Editor */}
                <div className="border-t border-slate-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-200">Request Form Fields</h3>
                    <button
                      onClick={addField}
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
                    >
                      + Add Field
                    </button>
                  </div>

                  {form.request_form.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">
                      No form fields yet. Click &quot;+ Add Field&quot; to define the request form.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {form.request_form.map((field, i) => (
                        <div key={i} className="bg-slate-900 rounded-lg border border-slate-600 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-500 font-mono w-6">#{i + 1}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveField(i, -1)}
                                disabled={i === 0}
                                className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                                title="Move up"
                              >
                                &uarr;
                              </button>
                              <button
                                onClick={() => moveField(i, 1)}
                                disabled={i === form.request_form.length - 1}
                                className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                                title="Move down"
                              >
                                &darr;
                              </button>
                            </div>
                            <div className="flex-1" />
                            <button
                              onClick={() => removeField(i)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-slate-400 mb-0.5">Label</label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(i, { label: e.target.value })}
                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                                placeholder="Field label"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-0.5">Type</label>
                              <select
                                value={field.type}
                                onChange={(e) => updateField(i, { type: e.target.value as FormField['type'] })}
                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                              >
                                {fieldTypes.map(ft => (
                                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-end gap-2">
                              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={field.required || false}
                                  onChange={(e) => updateField(i, { required: e.target.checked })}
                                  className="rounded border-slate-600 bg-slate-800 text-brand-500"
                                />
                                Required
                              </label>
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-400 mb-0.5">Data Source</label>
                                <select
                                  value={field.source || ''}
                                  onChange={(e) => updateField(i, { source: e.target.value || undefined })}
                                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                                >
                                  {dynamicSources.map(ds => (
                                    <option key={ds.value} value={ds.value}>{ds.label}</option>
                                  ))}
                                </select>
                              </div>
                              {!field.source && (
                                <div>
                                  <label className="block text-xs text-slate-400 mb-0.5">Options (comma-separated)</label>
                                  <input
                                    type="text"
                                    value={(field.options || []).join(', ')}
                                    onChange={(e) => updateField(i, {
                                      options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    })}
                                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                                    placeholder="Option 1, Option 2, ..."
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-2">
                            <label className="block text-xs text-slate-400 mb-0.5">Placeholder</label>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={(e) => updateField(i, { placeholder: e.target.value || undefined })}
                              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                              placeholder="Optional placeholder text"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
