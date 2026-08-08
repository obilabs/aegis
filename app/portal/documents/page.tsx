'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Folder {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  icon: string | null
  display_order: number
  is_restricted: boolean
  document_count: number
}

interface Document {
  id: string
  title: string
  description: string | null
  is_public: boolean
  is_pinned: boolean
  is_important: boolean
  view_count: number
  tags: string[]
  folder_id: string | null
  company_id: string | null
  folder_name: string | null
  company_name: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  latest_version: number | null
  attachment_count: number
}

// Recursive folder tree component
function FolderTreeItem({
  folder,
  folders,
  selectedFolder,
  expandedFolders,
  onSelect,
  onToggle,
  onContextMenu,
  depth = 0,
}: {
  folder: Folder
  folders: Folder[]
  selectedFolder: string | null
  expandedFolders: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onContextMenu: (e: React.MouseEvent, folder: Folder) => void
  depth?: number
}) {
  const children = folders.filter(f => f.parent_id === folder.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedFolders.has(folder.id)
  const isSelected = selectedFolder === folder.id

  return (
    <div>
      <button
        onClick={() => onSelect(folder.id)}
        onContextMenu={(e) => onContextMenu(e, folder)}
        className={`w-full text-left py-1.5 text-sm transition-colors flex items-center gap-1.5 group ${
          isSelected
            ? 'bg-brand-500/10 text-brand-400 border-r-2 border-brand-500'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '8px' }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id) }}
            className="p-0.5 hover:text-brand-400"
          >
            <svg className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
        <span className="truncate flex-1">{folder.name}</span>
        {folder.is_restricted && (
          <svg className="h-3 w-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
        <span className="text-[10px] text-slate-600">{folder.document_count}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {children.map(child => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              folders={folders}
              selectedFolder={selectedFolder}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Folder context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folder: Folder } | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Folder permissions modal state
  const [permissionsFolder, setPermissionsFolder] = useState<Folder | null>(null)
  const [permIsRestricted, setPermIsRestricted] = useState(false)
  const [permRoles, setPermRoles] = useState<{ role: string; permission: string }[]>([])
  const [permSaving, setPermSaving] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedFolder) params.set('folderId', selectedFolder)
      if (search) params.set('q', search)
      const res = await fetch(`/api/portal/documents?${params}`)
      const json = await res.json()
      setDocuments(json.documents || [])
      setFolders(json.folders || [])
    } catch {
      console.error('Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [selectedFolder, search])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null)
    if (contextMenu) document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [contextMenu])

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/portal/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          folderId: selectedFolder || undefined,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setNewTitle('')
        setShowNewDoc(false)
        window.location.href = `/portal/documents/${json.document.id}`
      }
    } catch {
      console.error('Failed to create document')
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/portal/documents/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName,
          parentId: selectedFolder || undefined,
        }),
      })
      if (res.ok) {
        setNewFolderName('')
        setShowNewFolder(false)
        fetchDocuments()
      }
    } catch {
      console.error('Failed to create folder')
    } finally {
      setCreating(false)
    }
  }

  async function handleRenameFolder(folderId: string) {
    if (!renameValue.trim()) return
    try {
      const res = await fetch(`/api/portal/documents/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue }),
      })
      if (res.ok) {
        setRenamingFolder(null)
        setRenameValue('')
        fetchDocuments()
      }
    } catch {
      console.error('Failed to rename folder')
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    const msg = folder.document_count > 0
      ? `Delete "${folder.name}"? ${folder.document_count} document(s) will be moved to ${folder.parent_id ? 'the parent folder' : 'All Documents'}.`
      : `Delete "${folder.name}"?`
    if (!confirm(msg)) return
    try {
      const res = await fetch(`/api/portal/documents/folders/${folder.id}`, { method: 'DELETE' })
      if (res.ok) {
        if (selectedFolder === folder.id) setSelectedFolder(null)
        fetchDocuments()
      }
    } catch {
      console.error('Failed to delete folder')
    }
  }

  async function openPermissions(folder: Folder) {
    setPermissionsFolder(folder)
    try {
      const res = await fetch(`/api/portal/documents/folders/${folder.id}/permissions`)
      const json = await res.json()
      setPermIsRestricted(json.isRestricted || false)
      setPermRoles(json.permissions || [])
    } catch {
      setPermIsRestricted(false)
      setPermRoles([])
    }
  }

  async function savePermissions() {
    if (!permissionsFolder) return
    setPermSaving(true)
    try {
      await fetch(`/api/portal/documents/folders/${permissionsFolder.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRestricted: permIsRestricted, permissions: permRoles }),
      })
      setPermissionsFolder(null)
      fetchDocuments()
    } catch {
      console.error('Failed to save permissions')
    } finally {
      setPermSaving(false)
    }
  }

  function addPermRole() {
    setPermRoles(prev => [...prev, { role: '', permission: 'read' }])
  }

  function removePermRole(idx: number) {
    setPermRoles(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePermRole(idx: number, field: 'role' | 'permission', value: string) {
    setPermRoles(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function handleFolderContextMenu(e: React.MouseEvent, folder: Folder) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, folder })
  }

  function toggleFolder(id: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rootFolders = folders.filter(f => !f.parent_id)

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Folder Sidebar */}
      <div className="w-64 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Folders</h3>
          <button
            onClick={() => setShowNewFolder(!showNewFolder)}
            className="p-1 text-slate-400 hover:text-brand-400 transition-colors"
            title="New Folder"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {showNewFolder && (
          <form onSubmit={handleCreateFolder} className="p-2 border-b border-slate-700">
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              autoFocus
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {selectedFolder ? 'Creates subfolder in selected folder' : 'Creates root folder'}
            </p>
            <div className="flex gap-1 mt-1">
              <button type="submit" disabled={creating} className="px-2 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-500 disabled:opacity-50">
                Create
              </button>
              <button type="button" onClick={() => setShowNewFolder(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedFolder ? 'bg-brand-500/10 text-brand-400 border-r-2 border-brand-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
          >
            All Documents
          </button>
          {rootFolders.map(folder =>
            renamingFolder === folder.id ? (
              <div key={folder.id} className="px-3 py-1.5">
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameFolder(folder.id)
                    if (e.key === 'Escape') { setRenamingFolder(null); setRenameValue('') }
                  }}
                  onBlur={() => { setRenamingFolder(null); setRenameValue('') }}
                  className="w-full px-2 py-1 text-sm bg-slate-900 border border-brand-500 rounded text-slate-200 focus:outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                folders={folders}
                selectedFolder={selectedFolder}
                expandedFolders={expandedFolders}
                onSelect={setSelectedFolder}
                onToggle={toggleFolder}
                onContextMenu={handleFolderContextMenu}
              />
            )
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setRenamingFolder(contextMenu.folder.id)
              setRenameValue(contextMenu.folder.name)
              setContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
            Rename
          </button>
          <button
            onClick={() => {
              openPermissions(contextMenu.folder)
              setContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Permissions
          </button>
          <div className="border-t border-slate-700 my-1" />
          <button
            onClick={() => {
              handleDeleteFolder(contextMenu.folder)
              setContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Folder Permissions Modal */}
      {permissionsFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-1">
              Folder Permissions
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {permissionsFolder.name}
            </p>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={permIsRestricted}
                onChange={e => setPermIsRestricted(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500/50"
              />
              <div>
                <span className="text-sm text-slate-200">Restrict access</span>
                <p className="text-xs text-slate-500">Only specified roles can view documents in this folder</p>
              </div>
            </label>

            {permIsRestricted && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase">Role Access</span>
                  <button onClick={addPermRole} className="text-xs text-brand-400 hover:text-brand-300">
                    + Add Role
                  </button>
                </div>
                {permRoles.length === 0 && (
                  <p className="text-xs text-amber-400 bg-amber-500/10 rounded px-3 py-2">
                    No roles configured. Nobody except admins will be able to access this folder.
                  </p>
                )}
                {permRoles.map((pr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={pr.role}
                      onChange={e => updatePermRole(idx, 'role', e.target.value)}
                      className="flex-1 px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    >
                      <option value="">Select role...</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="technician">Technician</option>
                      <option value="user">User</option>
                    </select>
                    <select
                      value={pr.permission}
                      onChange={e => updatePermRole(idx, 'permission', e.target.value)}
                      className="w-24 px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="manage">Manage</option>
                    </select>
                    <button
                      onClick={() => removePermRole(idx)}
                      className="p-1 text-slate-500 hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
              <button
                onClick={() => setPermissionsFolder(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                disabled={permSaving}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {permSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-100">Documents</h1>
          <button
            onClick={() => setShowNewDoc(true)}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 transition-colors"
          >
            New Document
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full px-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          />
        </div>

        {/* New Document Form */}
        {showNewDoc && (
          <form onSubmit={handleCreateDocument} className="mb-4 bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Create New Document</h3>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Document title..."
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={creating || !newTitle.trim()} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors">
                Create & Edit
              </button>
              <button type="button" onClick={() => setShowNewDoc(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
            <svg className="h-12 w-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h2 className="text-lg font-semibold text-slate-300">No documents found</h2>
            <p className="text-sm text-slate-500 mt-1">Create your first document to get started.</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Title</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Folder</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Author</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Files</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Views</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {doc.is_pinned && (
                          <svg className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                        )}
                        <Link href={`/portal/documents/${doc.id}`} className="text-brand-400 hover:text-brand-300 font-medium">
                          {doc.title}
                        </Link>
                        {doc.is_public && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-brand-500/20 text-brand-400 rounded">Public</span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{doc.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{doc.folder_name || '—'}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{doc.created_by_name || '—'}</td>
                    <td className="py-3 px-4 text-center text-slate-500 text-xs">
                      {doc.attachment_count > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                          </svg>
                          {doc.attachment_count}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 text-xs">{doc.view_count}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
