'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  DocumentTextIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  TicketIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

interface AIPrompt {
  id: string
  name: string
  description: string
  use_case: string
  system_prompt: string
  temperature: number
  max_tokens: number
  is_active: boolean
}

const useCaseIcons: Record<string, any> = {
  general: SparklesIcon,
  chat: ChatBubbleLeftRightIcon,
  ticket_triage: TicketIcon,
  kb_search: BookOpenIcon,
  troubleshooting: WrenchScrewdriverIcon,
}

const defaultPrompts: AIPrompt[] = [
  {
    id: '1',
    name: 'IT Support Assistant',
    description: 'General IT support and troubleshooting',
    use_case: 'chat',
    system_prompt: `You are a helpful IT support assistant for Aegis ITSM. You help users with:
- Troubleshooting technical issues
- Answering questions about IT policies and procedures
- Guiding users through common tasks
- Providing information from the knowledge base

Be concise, friendly, and professional. If you don't know something, say so and suggest they contact IT support directly.`,
    temperature: 0.7,
    max_tokens: 2000,
    is_active: true,
  },
  {
    id: '2',
    name: 'Ticket Triage',
    description: 'Categorize and prioritize incoming tickets',
    use_case: 'ticket_triage',
    system_prompt: `You are an IT ticket triage assistant. Analyze the ticket description and provide:
1. Suggested category (Hardware, Software, Network, Access, Other)
2. Suggested priority (Low, Medium, High, Urgent)
3. Brief summary (1-2 sentences)
4. Suggested initial response

Format your response as JSON with keys: category, priority, summary, suggested_response`,
    temperature: 0.3,
    max_tokens: 500,
    is_active: true,
  },
  {
    id: '3',
    name: 'KB Article Generator',
    description: 'Generate knowledge base articles from notes',
    use_case: 'kb_search',
    system_prompt: `You are a technical writer creating knowledge base articles. Given rough notes or a problem/solution description, create a well-structured KB article with:
1. Clear title
2. Problem description
3. Step-by-step solution
4. Additional notes or warnings
5. Related topics

Use clear, simple language suitable for non-technical users.`,
    temperature: 0.5,
    max_tokens: 2000,
    is_active: true,
  },
]

export default function AIPromptsPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    // TODO: Fetch from API
    setTimeout(() => {
      setPrompts(defaultPrompts)
      setLoading(false)
    }, 500)
  }, [])

  const handleSavePrompt = (prompt: AIPrompt) => {
    if (editingPrompt) {
      setPrompts(prompts.map(p => p.id === prompt.id ? prompt : p))
    } else {
      setPrompts([...prompts, { ...prompt, id: String(prompts.length + 1) }])
    }
    setEditingPrompt(null)
    setShowAddForm(false)
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
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link href="/portal/settings/ai" className="hover:text-brand-400 flex items-center gap-1">
              <ArrowLeftIcon className="h-4 w-4" />
              AI Configuration
            </Link>
            <span>/</span>
            <span className="text-slate-200">Prompts & Presets</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <DocumentTextIcon className="h-7 w-7 text-purple-400" />
            AI Prompts & Presets
          </h1>
          <p className="text-slate-400 mt-1">
            Configure system prompts for different AI use cases.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Prompt
        </button>
      </div>

      {/* Edit/Add Form */}
      {(editingPrompt || showAddForm) && (
        <PromptEditor
          prompt={editingPrompt || undefined}
          onSave={handleSavePrompt}
          onCancel={() => {
            setEditingPrompt(null)
            setShowAddForm(false)
          }}
        />
      )}

      {/* Prompts List */}
      <div className="grid gap-4">
        {prompts.map((prompt) => {
          const Icon = useCaseIcons[prompt.use_case] || SparklesIcon
          return (
            <div
              key={prompt.id}
              className={`bg-slate-800 rounded-lg border ${
                prompt.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'
              }`}
            >
              <div className="p-4 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Icon className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{prompt.name}</h3>
                      {prompt.is_active && (
                        <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{prompt.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Use case: <span className="text-slate-400 capitalize">{prompt.use_case.replace('_', ' ')}</span></span>
                      <span>Temperature: <span className="text-slate-400">{prompt.temperature}</span></span>
                      <span>Max tokens: <span className="text-slate-400">{prompt.max_tokens}</span></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingPrompt(prompt)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4">
                <details className="group">
                  <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
                    View system prompt
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900 rounded-lg text-xs text-slate-400 whitespace-pre-wrap overflow-x-auto">
                    {prompt.system_prompt}
                  </pre>
                </details>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PromptEditor({
  prompt,
  onSave,
  onCancel,
}: {
  prompt?: AIPrompt
  onSave: (prompt: AIPrompt) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<AIPrompt>(
    prompt || {
      id: '',
      name: '',
      description: '',
      use_case: 'general',
      system_prompt: '',
      temperature: 0.7,
      max_tokens: 2000,
      is_active: true,
    }
  )

  return (
    <div className="bg-slate-800 rounded-lg border border-brand-500/50 p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">
        {prompt ? 'Edit Prompt' : 'Create New Prompt'}
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., IT Support Assistant"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Use Case</label>
            <select
              value={form.use_case}
              onChange={(e) => setForm({ ...form, use_case: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="general">General</option>
              <option value="chat">Chat Support</option>
              <option value="ticket_triage">Ticket Triage</option>
              <option value="kb_search">Knowledge Base</option>
              <option value="troubleshooting">Troubleshooting</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Brief description of what this prompt does"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">System Prompt</label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            rows={8}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
            placeholder="Enter the system prompt that will be sent to the AI..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-500 mt-1">0 = deterministic, 2 = creative</p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Max Tokens</label>
            <input
              type="number"
              min="100"
              max="8000"
              step="100"
              value={form.max_tokens}
              onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-500 mt-1">Maximum response length</p>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-300">Active</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.name || !form.system_prompt}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CheckIcon className="h-4 w-4" />
          {prompt ? 'Save Changes' : 'Create Prompt'}
        </button>
      </div>
    </div>
  )
}
