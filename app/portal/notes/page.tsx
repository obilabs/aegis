'use client'

import { useState, useEffect } from 'react'
import {
  DocumentTextIcon,
  ListBulletIcon,
  PlusIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface Note {
  id: string
  content: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

interface Task {
  id: string
  title: string
  is_completed: boolean
  is_archived: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
}

const NUDGE_THRESHOLD = 5
const ACTIVE_LIMIT = 10

export default function NotesTasksPage() {
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks'>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notesCount, setNotesCount] = useState(0)
  const [tasksCount, setTasksCount] = useState(0)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotes()
    fetchTasks()
  }, [])

  const fetchNotes = async () => {
    try {
      const response = await fetch('/api/portal/notes')
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes)
        setNotesCount(data.activeCount)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/portal/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks)
        setTasksCount(data.activeCount)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return
    try {
      const response = await fetch('/api/portal/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      })
      if (response.ok) {
        const note = await response.json()
        setNotes([note, ...notes])
        setNotesCount(notesCount + 1)
        setNewNoteContent('')
      } else {
        const err = await response.json()
        alert(err.error)
      }
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  const handleUpdateNote = async (id: string, content: string) => {
    try {
      const response = await fetch(`/api/portal/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (response.ok) {
        const updated = await response.json()
        setNotes(notes.map(n => n.id === id ? updated : n))
        setEditingNote(null)
      }
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  const handleArchiveNote = async (id: string) => {
    try {
      const response = await fetch(`/api/portal/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      })
      if (response.ok) {
        setNotes(notes.filter(n => n.id !== id))
        setNotesCount(notesCount - 1)
      }
    } catch (error) {
      console.error('Error archiving note:', error)
    }
  }

  const handleDeleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/portal/notes/${id}`, { method: 'DELETE' })
      if (response.ok) {
        const note = notes.find(n => n.id === id)
        setNotes(notes.filter(n => n.id !== id))
        if (note && !note.is_archived) setNotesCount(notesCount - 1)
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    try {
      const response = await fetch('/api/portal/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim() }),
      })
      if (response.ok) {
        const task = await response.json()
        setTasks([...tasks, task])
        setTasksCount(tasksCount + 1)
        setNewTaskTitle('')
      } else {
        const err = await response.json()
        alert(err.error)
      }
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const handleToggleTask = async (id: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/portal/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !isCompleted }),
      })
      if (response.ok) {
        const updated = await response.json()
        setTasks(tasks.map(t => t.id === id ? { ...t, ...updated } : t))
      }
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleArchiveTask = async (id: string) => {
    try {
      const response = await fetch(`/api/portal/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      })
      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== id))
        setTasksCount(tasksCount - 1)
      }
    } catch (error) {
      console.error('Error archiving task:', error)
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await fetch(`/api/portal/tasks/${id}`, { method: 'DELETE' })
      if (response.ok) {
        const task = tasks.find(t => t.id === id)
        setTasks(tasks.filter(t => t.id !== id))
        if (task && !task.is_archived) setTasksCount(tasksCount - 1)
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const currentCount = activeTab === 'notes' ? notesCount : tasksCount
  const showNudge = currentCount >= NUDGE_THRESHOLD && currentCount < ACTIVE_LIMIT
  const atLimit = currentCount >= ACTIVE_LIMIT

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">My Notes & Tasks</h1>
        <p className="text-slate-400 mt-1">Personal scratchpad — not tied to any ticket</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'notes'
              ? 'bg-slate-700 text-brand-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DocumentTextIcon className="h-4 w-4" />
          Notes ({notesCount})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'tasks'
              ? 'bg-slate-700 text-brand-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListBulletIcon className="h-4 w-4" />
          Tasks ({tasksCount})
        </button>
      </div>

      {/* Nudge / Limit Warning */}
      {showNudge && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            You have {currentCount} active {activeTab}. Consider moving older items to a ticket or the team backlog.
          </p>
        </div>
      )}
      {atLimit && (
        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            You&apos;ve reached the limit of {ACTIVE_LIMIT} active {activeTab}. Archive or move items before adding new ones.
          </p>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add Note */}
          {!atLimit && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write a quick note..."
                className="w-full bg-transparent text-slate-200 placeholder-slate-500 outline-none resize-none"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Note
                </button>
              </div>
            </div>
          )}

          {/* Notes List */}
          {notes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No notes yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 group">
                  {editingNote === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-200 outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => setEditingNote(null)}
                          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateNote(note.id, editContent)}
                          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-500"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p
                        className="text-slate-300 whitespace-pre-wrap cursor-pointer hover:bg-slate-700/50 rounded p-1 -m-1"
                        onClick={() => {
                          setEditingNote(note.id)
                          setEditContent(note.content)
                        }}
                      >
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/50">
                        <span className="text-xs text-slate-500">{formatDate(note.updated_at)}</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleArchiveNote(note.id)}
                            className="text-slate-500 hover:text-amber-400 transition-colors"
                            title="Archive"
                          >
                            <ArchiveBoxIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            {/* Task Progress */}
            {tasks.length > 0 && (
              <div className="px-4 pt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{tasks.filter(t => t.is_completed).length} of {tasks.length} completed</span>
                  <span>{Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: `${(tasks.filter(t => t.is_completed).length / tasks.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Task List */}
            <div className="p-4 space-y-2">
              {tasks.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <ListBulletIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks yet. Add one below.</p>
                </div>
              )}
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 group">
                  <button
                    onClick={() => handleToggleTask(task.id, task.is_completed)}
                    className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                      task.is_completed
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'border-slate-600 hover:border-brand-500'
                    }`}
                  >
                    {task.is_completed && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${task.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleArchiveTask(task.id)}
                      className="text-slate-500 hover:text-amber-400 transition-colors p-1"
                      title="Archive"
                    >
                      <ArchiveBoxIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Task */}
              {!atLimit && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-700/50 mt-2">
                  <PlusIcon className="h-5 w-5 text-slate-600 flex-shrink-0" />
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask()
                    }}
                    placeholder="Add a task..."
                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert Actions Hint */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-600">
          Items can be converted to tickets or moved to the team backlog
        </p>
      </div>
    </div>
  )
}
