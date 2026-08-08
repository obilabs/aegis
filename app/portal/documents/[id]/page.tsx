'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface DocumentDetail {
  id: string
  title: string
  description: string | null
  content: string | null
  is_public: boolean
  is_pinned: boolean
  tags: string[]
  folder_id: string | null
  folder_name: string | null
  company_name: string | null
  created_by_name: string | null
  view_count: number
  created_at: string
  updated_at: string
}

interface Version {
  id: string
  version_number: number
  title: string
  change_summary: string | null
  created_at: string
  created_by_name: string | null
}

interface Attachment {
  id: string
  file_name: string
  file_type: string | null
  file_size: number
  created_at: string
  uploaded_by_name: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string | null): string {
  if (!type) return 'file'
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (type.includes('spreadsheet') || type.includes('excel')) return 'spreadsheet'
  if (type.includes('word') || type.includes('document')) return 'document'
  if (type.includes('presentation') || type.includes('powerpoint')) return 'presentation'
  return 'file'
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [changeSummary, setChangeSummary] = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function fetchDocument() {
    try {
      const res = await fetch(`/api/portal/documents/${id}`)
      if (!res.ok) throw new Error('Not found')
      const json = await res.json()
      setDoc(json.document)
      setVersions(json.versions || [])
      setAttachments(json.attachments || [])
      setTitle(json.document.title)
      setDescription(json.document.description || '')
      setContent(json.document.content || '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocument()
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/portal/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          content,
          changeSummary: changeSummary || undefined,
        }),
      })
      if (res.ok) {
        setEditing(false)
        setChangeSummary('')
        fetchDocument()
      }
    } catch {
      console.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      const res = await fetch(`/api/portal/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/portal/documents')
      }
    } catch {
      console.error('Failed to delete')
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`/api/portal/documents/${id}/attachments`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json()
          alert(err.error || 'Upload failed')
        }
      }
      fetchDocument()
    } catch {
      console.error('Failed to upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAttachment(attachmentId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return
    try {
      await fetch(`/api/portal/documents/${id}/attachments/${attachmentId}`, { method: 'DELETE' })
      fetchDocument()
    } catch {
      console.error('Failed to delete attachment')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-slate-300">Document not found</h2>
        <Link href="/portal/documents" className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300">
          Back to Documents
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/portal/documents" className="hover:text-slate-200">Documents</Link>
          {doc.folder_name && (
            <>
              <span>/</span>
              <span className="text-slate-400">{doc.folder_name}</span>
            </>
          )}
          <span>/</span>
          <span className="text-slate-200">{doc.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-slate-800 text-red-400 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={changeSummary}
                onChange={e => setChangeSummary(e.target.value)}
                placeholder="Change summary (optional)"
                className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setTitle(doc.title)
                  setDescription(doc.description || '')
                  setContent(doc.content || '')
                  setChangeSummary('')
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Document Content */}
        <div className="lg:col-span-3 space-y-4">
          {editing ? (
            <>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 text-xl font-bold bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={20}
                className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 font-mono"
                placeholder="Write your document content here..."
              />
            </>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h1 className="text-2xl font-bold text-slate-100">{doc.title}</h1>
              {doc.description && (
                <p className="text-slate-400 mt-2">{doc.description}</p>
              )}
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {doc.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-6 prose prose-invert prose-sm max-w-none">
                {doc.content ? (
                  <div dangerouslySetInnerHTML={{ __html: doc.content }} />
                ) : (
                  <p className="text-slate-500 italic">No content yet. Click Edit to add content.</p>
                )}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div
            className={`bg-slate-800 rounded-lg border p-4 transition-colors ${
              dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                Attachments ({attachments.length})
              </h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-700 rounded-lg">
                <svg className="h-8 w-8 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-xs text-slate-500">Drag files here or click Upload</p>
                <p className="text-[10px] text-slate-600 mt-1">PDF, images, Office docs, text, CSV (max 50MB)</p>
              </div>
            ) : (
              <div className="space-y-1">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 py-2 px-3 bg-slate-900/50 rounded-lg group">
                    <div className="flex-shrink-0">
                      {getFileIcon(att.file_type) === 'image' ? (
                        <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      ) : getFileIcon(att.file_type) === 'pdf' ? (
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/api/portal/documents/${id}/attachments/${att.id}`}
                        className="text-sm text-brand-400 hover:text-brand-300 truncate block"
                        download={att.file_name}
                      >
                        {att.file_name}
                      </a>
                      <p className="text-[10px] text-slate-500">
                        {formatFileSize(att.file_size)} &middot; {att.uploaded_by_name || 'Unknown'} &middot;{' '}
                        {new Date(att.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAttachment(att.id, att.file_name)}
                      className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete attachment"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Author</dt>
                <dd className="text-slate-300">{doc.created_by_name || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-300">
                  {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-300">
                  {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Views</dt>
                <dd className="text-slate-300">{doc.view_count}</dd>
              </div>
              {doc.folder_name && (
                <div>
                  <dt className="text-slate-500">Folder</dt>
                  <dd className="text-slate-300">{doc.folder_name}</dd>
                </div>
              )}
              {doc.company_name && (
                <div>
                  <dt className="text-slate-500">Company</dt>
                  <dd className="text-slate-300">{doc.company_name}</dd>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {doc.is_public && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-brand-500/20 text-brand-400 rounded">Public</span>
                )}
                {doc.is_pinned && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">Pinned</span>
                )}
              </div>
            </dl>
          </div>

          {/* Version History */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Version History</h3>
            {versions.length === 0 ? (
              <p className="text-xs text-slate-500">No versions recorded</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="text-xs border-l-2 border-slate-700 pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-300">v{v.version_number}</span>
                      <span className="text-slate-500">
                        {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {v.change_summary && (
                      <p className="text-slate-400 mt-0.5">{v.change_summary}</p>
                    )}
                    <p className="text-slate-500">{v.created_by_name || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
