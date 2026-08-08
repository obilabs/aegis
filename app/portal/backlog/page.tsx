'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PlusIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

interface BacklogItem {
  id: string
  team_id: string | null
  title: string
  description: string | null
  category: string | null
  status: string
  priority: string
  review_by: string | null
  converted_ticket_id: string | null
  abort_reason: string | null
  abort_notes: string | null
  aborted_at: string | null
  created_at: string
  updated_at: string
  submitted_by_name: string | null
  aborted_by_name: string | null
  team_name: string | null
  comment_count: number
}

interface BacklogComment {
  id: string
  content: string
  created_at: string
  user_name: string
}

interface StatusMetric {
  status: string
  count: string
  avg_age_days: string | null
}

const KANBAN_COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: 'bg-slate-500' },
  { key: 'planning', label: 'Planning', color: 'bg-blue-500' },
  { key: 'converted', label: 'Converted', color: 'bg-brand-500' },
  { key: 'done', label: 'Done', color: 'bg-green-500' },
]

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
}

const ABORT_REASONS = [
  { value: 'wont_fix', label: "Won't fix" },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'no_longer_relevant', label: 'No longer relevant' },
  { value: 'out_of_scope', label: 'Out of scope' },
]

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getReviewStatus(reviewBy: string | null) {
  if (!reviewBy) return null
  const review = new Date(reviewBy)
  const now = new Date()
  const diffDays = Math.floor((review.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'ok'
}

export default function BacklogPage() {
  const [items, setItems] = useState<BacklogItem[]>([])
  const [metrics, setMetrics] = useState<{ byStatus: StatusMetric[]; overdueCount: number }>({
    byStatus: [],
    overdueCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showAborted, setShowAborted] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null)
  const [comments, setComments] = useState<BacklogComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [showAbortModal, setShowAbortModal] = useState(false)
  const [abortingItem, setAbortingItem] = useState<string | null>(null)
  const [abortData, setAbortData] = useState({ abort_reason: '', abort_notes: '' })
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
  })

  useEffect(() => {
    fetchBacklog()
  }, [])

  const fetchBacklog = async () => {
    try {
      const response = await fetch('/api/portal/backlog')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error('Error fetching backlog:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateItem = async () => {
    if (!newItem.title.trim()) return
    try {
      const response = await fetch('/api/portal/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      })
      if (response.ok) {
        const item = await response.json()
        setItems([item, ...items])
        setNewItem({ title: '', description: '', category: '', priority: 'medium' })
        setShowNewItemModal(false)
        fetchBacklog() // Refresh metrics
      }
    } catch (error) {
      console.error('Error creating item:', error)
    }
  }

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    if (newStatus === 'aborted') {
      setAbortingItem(itemId)
      setAbortData({ abort_reason: '', abort_notes: '' })
      setShowAbortModal(true)
      return
    }

    try {
      const response = await fetch(`/api/portal/backlog/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        const updated = await response.json()
        setItems(items.map(i => i.id === itemId ? { ...i, ...updated } : i))
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleAbort = async () => {
    if (!abortingItem || !abortData.abort_reason) return
    try {
      const response = await fetch(`/api/portal/backlog/${abortingItem}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'aborted', ...abortData }),
      })
      if (response.ok) {
        const updated = await response.json()
        setItems(items.map(i => i.id === abortingItem ? { ...i, ...updated } : i))
        setShowAbortModal(false)
        setAbortingItem(null)
      }
    } catch (error) {
      console.error('Error aborting item:', error)
    }
  }

  const handleSelectItem = async (item: BacklogItem) => {
    setSelectedItem(item)
    try {
      const response = await fetch(`/api/portal/backlog/${item.id}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Error fetching item details:', error)
    }
  }

  const handleAddComment = async () => {
    if (!selectedItem || !newComment.trim()) return
    try {
      const response = await fetch(`/api/portal/backlog/${selectedItem.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (response.ok) {
        const comment = await response.json()
        setComments([...comments, comment])
        setNewComment('')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const activeItems = items.filter(i => i.status !== 'aborted')
  const abortedItems = items.filter(i => i.status === 'aborted')

  // Metrics calculations
  const totalActive = activeItems.length
  const convertedCount = parseInt(metrics.byStatus.find(m => m.status === 'converted')?.count || '0')
    + parseInt(metrics.byStatus.find(m => m.status === 'done')?.count || '0')
  const abortedCount = parseInt(metrics.byStatus.find(m => m.status === 'aborted')?.count || '0')
  const conversionRate = (convertedCount + abortedCount) > 0
    ? Math.round((convertedCount / (convertedCount + abortedCount)) * 100)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Backlog</h1>
          <p className="text-slate-400 mt-1">Improvement ideas and pre-work initiatives</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAborted(!showAborted)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showAborted
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Aborted ({abortedItems.length})
          </button>
          <button
            onClick={() => setShowNewItemModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Item
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Active Items</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{totalActive}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Conversion Rate</p>
          <p className="text-2xl font-bold text-brand-400 mt-1">{conversionRate}%</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Overdue Reviews</p>
          <p className={`text-2xl font-bold mt-1 ${metrics.overdueCount > 0 ? 'text-red-400' : 'text-slate-100'}`}>
            {metrics.overdueCount}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Aborted</p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{abortedCount}</p>
        </div>
      </div>

      {/* Kanban Board */}
      {!showAborted ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((column) => {
            const columnItems = activeItems.filter(i => i.status === column.key)
            return (
              <div key={column.key} className="bg-slate-900 rounded-lg border border-slate-800">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                    <h3 className="text-sm font-semibold text-slate-200">{column.label}</h3>
                    <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                      {columnItems.length}
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {columnItems.map((item) => {
                    const reviewStatus = getReviewStatus(item.review_by)
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`bg-slate-800 rounded-lg border border-slate-700 p-3 cursor-pointer hover:border-slate-600 transition-colors border-l-2 ${
                          PRIORITY_COLORS[item.priority] || 'border-l-slate-600'
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-200 line-clamp-2">{item.title}</p>
                        {item.category && (
                          <span className="inline-block mt-1.5 px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                            {item.category}
                          </span>
                        )}
                        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                          <span>{formatRelativeDate(item.created_at)}</span>
                          <div className="flex items-center gap-2">
                            {item.comment_count > 0 && (
                              <span className="flex items-center gap-0.5">
                                <ChatBubbleLeftIcon className="h-3 w-3" />
                                {item.comment_count}
                              </span>
                            )}
                            {reviewStatus && (
                              <span className={`flex items-center gap-0.5 ${
                                reviewStatus === 'overdue' ? 'text-red-400' :
                                reviewStatus === 'soon' ? 'text-amber-400' : ''
                              }`}>
                                <ClockIcon className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {columnItems.length === 0 && (
                    <p className="text-center text-xs text-slate-600 py-8">No items</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Aborted Items List */
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100">Aborted Items</h2>
          </div>
          {abortedItems.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No aborted items</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {abortedItems.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-300">{item.title}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {item.abort_reason?.replace(/_/g, ' ')}
                        {item.abort_notes && ` — ${item.abort_notes}`}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {item.aborted_at && formatRelativeDate(item.aborted_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Item Detail Drawer */}
      {selectedItem && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedItem(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-800 z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    KANBAN_COLUMNS.find(c => c.key === selectedItem.status)?.color || 'bg-slate-500'
                  }`} />
                  <span className="text-sm text-slate-400 capitalize">{selectedItem.status}</span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <h2 className="text-xl font-bold text-slate-100 mb-2">{selectedItem.title}</h2>
              {selectedItem.description && (
                <p className="text-slate-300 text-sm whitespace-pre-wrap mb-4">{selectedItem.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Priority</label>
                  <p className="text-sm text-slate-200 mt-1 capitalize">{selectedItem.priority}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Category</label>
                  <p className="text-sm text-slate-200 mt-1">{selectedItem.category || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Submitted By</label>
                  <p className="text-sm text-slate-200 mt-1">{selectedItem.submitted_by_name || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Review By</label>
                  <p className={`text-sm mt-1 ${
                    getReviewStatus(selectedItem.review_by) === 'overdue' ? 'text-red-400' :
                    getReviewStatus(selectedItem.review_by) === 'soon' ? 'text-amber-400' : 'text-slate-200'
                  }`}>
                    {selectedItem.review_by
                      ? new Date(selectedItem.review_by).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Status Actions */}
              {selectedItem.status !== 'done' && selectedItem.status !== 'aborted' && (
                <div className="flex flex-wrap gap-2 mb-6 p-3 bg-slate-800 rounded-lg">
                  <span className="text-xs text-slate-500 w-full mb-1">Move to:</span>
                  {selectedItem.status !== 'backlog' && (
                    <button
                      onClick={() => { handleStatusChange(selectedItem.id, 'backlog'); setSelectedItem({ ...selectedItem, status: 'backlog' }) }}
                      className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                    >
                      Backlog
                    </button>
                  )}
                  {selectedItem.status !== 'planning' && (
                    <button
                      onClick={() => { handleStatusChange(selectedItem.id, 'planning'); setSelectedItem({ ...selectedItem, status: 'planning' }) }}
                      className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                    >
                      Planning
                    </button>
                  )}
                  <Link
                    href={`/portal/tickets/new?subject=${encodeURIComponent(selectedItem.title)}&description=${encodeURIComponent(selectedItem.description || '')}`}
                    className="px-3 py-1.5 text-xs bg-brand-500/20 text-brand-400 rounded hover:bg-brand-500/30 transition-colors flex items-center gap-1"
                  >
                    Convert to Ticket
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => handleStatusChange(selectedItem.id, 'aborted')}
                    className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                  >
                    Abort
                  </button>
                </div>
              )}

              {/* Comments */}
              <div className="border-t border-slate-800 pt-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <ChatBubbleLeftIcon className="h-4 w-4" />
                  Discussion ({comments.length})
                </h3>
                <div className="space-y-3 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-300">{comment.user_name}</span>
                        <span className="text-xs text-slate-500">{formatRelativeDate(comment.created_at)}</span>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none text-slate-400" dangerouslySetInnerHTML={{ __html: comment.content }} />
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-slate-600 text-center py-4">No comments yet</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment() }}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Item Modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">New Backlog Item</h3>
              <button onClick={() => setShowNewItemModal(false)} className="text-slate-400 hover:text-slate-200">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="What needs to be done?"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="More context about this idea..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    placeholder="e.g., Infrastructure"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                  <select
                    value={newItem.priority}
                    onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowNewItemModal(false)}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateItem}
                disabled={!newItem.title.trim()}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abort Modal */}
      {showAbortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100">Abort Item</h3>
              <p className="text-sm text-slate-400 mt-1">Why is this being dropped?</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Reason (required)</label>
                <div className="space-y-2">
                  {ABORT_REASONS.map((reason) => (
                    <label key={reason.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="abort_reason"
                        value={reason.value}
                        checked={abortData.abort_reason === reason.value}
                        onChange={(e) => setAbortData({ ...abortData, abort_reason: e.target.value })}
                        className="text-brand-500 focus:ring-brand-500/50"
                      />
                      <span className="text-sm text-slate-300">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optional)</label>
                <textarea
                  value={abortData.abort_notes}
                  onChange={(e) => setAbortData({ ...abortData, abort_notes: e.target.value })}
                  placeholder="Any additional context..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowAbortModal(false); setAbortingItem(null) }}
                className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAbort}
                disabled={!abortData.abort_reason}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                Abort Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
