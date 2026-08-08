'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  SparklesIcon,
  ServerIcon,
  CloudIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  ChatBubbleLeftRightIcon,
  LockClosedIcon,
  ScaleIcon,
  GlobeAltIcon,
  KeyIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'

interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'ollama' | 'anthropic' | 'google' | 'custom'
  api_url: string
  api_key?: string
  is_local: boolean
  is_active: boolean
  is_default: boolean
  status: 'connected' | 'error' | 'unknown'
  models: AIModel[]
  availableModels?: string[]
}

interface AIModel {
  id: string
  model_name: string
  display_name: string
  use_case: 'general' | 'summarization' | 'code' | 'chat'
  is_default: boolean
  is_active: boolean
}

const providerTypes = [
  { id: 'ollama', name: 'Ollama', icon: <ServerIcon className="h-5 w-5" />, description: 'Self-hosted, local AI', is_local: true },
  { id: 'openai', name: 'OpenAI', icon: <CloudIcon className="h-5 w-5" />, description: 'GPT-4, GPT-3.5', is_local: false },
  { id: 'anthropic', name: 'Anthropic', icon: <BeakerIcon className="h-5 w-5" />, description: 'Claude models', is_local: false },
  { id: 'google', name: 'Google AI', icon: <SparklesIcon className="h-5 w-5" />, description: 'Gemini models', is_local: false },
  { id: 'custom', name: 'Custom', icon: <ServerIcon className="h-5 w-5" />, description: 'OpenAI-compatible API', is_local: false },
]

type ResponseMode = 'strict' | 'balanced' | 'open'

interface AIConfig {
  response_mode: ResponseMode
  auto_draft_threshold: number
  session_retention_days: number
}

const responseModes: { id: ResponseMode; name: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'strict',
    name: 'Strict',
    description: 'Only answer from knowledge base. Suggest tickets when no articles match.',
    icon: <LockClosedIcon className="h-5 w-5" />,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Prefer knowledge base, label general advice clearly.',
    icon: <ScaleIcon className="h-5 w-5" />,
  },
  {
    id: 'open',
    name: 'Open',
    description: 'Use all knowledge freely, cite KB when relevant.',
    icon: <GlobeAltIcon className="h-5 w-5" />,
  },
]

function ResponseModeSettings() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/settings/ai/config')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setConfig(data.data)
          }
        }
      } catch {
        // Config may not exist yet
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
  }, [])

  const saveConfig = async (updates: Partial<AIConfig>) => {
    setSaving(true)
    setSavedMessage(false)

    try {
      const res = await fetch('/api/settings/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        setSavedMessage(true)
        setTimeout(() => setSavedMessage(false), 2000)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleModeChange = async (mode: ResponseMode) => {
    if (!config || config.response_mode === mode) return

    const previousMode = config.response_mode
    setConfig({ ...config, response_mode: mode })

    const success = await saveConfig({ response_mode: mode })
    if (!success) {
      setConfig(prev => prev ? { ...prev, response_mode: previousMode } : prev)
    }
  }

  const handleThresholdChange = async (value: number) => {
    if (!config || config.auto_draft_threshold === value) return

    const previousValue = config.auto_draft_threshold
    setConfig({ ...config, auto_draft_threshold: value })

    const success = await saveConfig({ auto_draft_threshold: value })
    if (!success) {
      setConfig(prev => prev ? { ...prev, auto_draft_threshold: previousValue } : prev)
    }
  }

  if (loading) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">AI Response Mode</h3>
              <p className="text-sm text-slate-500">
                Control how the AI assistant uses knowledge base articles vs. general knowledge
              </p>
            </div>
          </div>
          {savedMessage && (
            <div className="flex items-center gap-1.5 text-sm text-brand-400">
              <CheckCircleIcon className="h-4 w-4" />
              Saved
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {responseModes.map((mode) => {
            const isSelected = (config?.response_mode || 'balanced') === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                disabled={saving}
                className={`relative p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                } ${saving ? 'opacity-70' : ''}`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircleIcon className="h-5 w-5 text-brand-400" />
                  </div>
                )}
                <div className={`mb-2 ${isSelected ? 'text-brand-400' : 'text-slate-400'}`}>
                  {mode.icon}
                </div>
                <p className={`font-medium ${isSelected ? 'text-brand-400' : 'text-slate-200'}`}>
                  {mode.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">{mode.description}</p>
                {mode.id === 'balanced' && (
                  <span className="inline-block mt-2 px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                    Default
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* KB Gap Detection Threshold */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-200">KB Gap Auto-Draft Threshold</p>
              <p className="text-xs text-slate-500">
                Automatically create a draft KB article when a topic is asked this many times without a matching article.
                Set to 0 to disable auto-drafting.
              </p>
            </div>
            <span className="text-lg font-bold text-brand-400 min-w-[2.5rem] text-right">
              {config?.auto_draft_threshold ?? 3}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">0</span>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={config?.auto_draft_threshold ?? 3}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setConfig(prev => prev ? { ...prev, auto_draft_threshold: val } : prev)
              }}
              onMouseUp={(e) => handleThresholdChange(parseInt((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => handleThresholdChange(parseInt((e.target as HTMLInputElement).value))}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              disabled={saving}
            />
            <span className="text-xs text-slate-500">20</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {(config?.auto_draft_threshold ?? 3) === 0
              ? 'Auto-drafting is disabled. Gaps are still tracked.'
              : `A draft article will be created after ${config?.auto_draft_threshold ?? 3} occurrences.`}
          </p>
        </div>
      </div>
    </div>
  )
}

function DisclaimerSettings() {
  const [enabled, setEnabled] = useState(true)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)

  useEffect(() => {
    fetch('/api/portal/ai-disclaimer')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEnabled(data.enabled)
          setText(data.text)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (newEnabled: boolean, newText: string) => {
    setSaving(true)
    setSavedMessage(false)
    try {
      await Promise.all([
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'ai_chat_disclaimer_enabled', value: String(newEnabled) }),
        }),
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'ai_chat_disclaimer_text', value: newText }),
        }),
      ])
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 2000)
    } catch { /* non-critical */ }
    finally { setSaving(false) }
  }

  const handleToggle = () => {
    const next = !enabled
    setEnabled(next)
    save(next, text)
  }

  if (loading) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <ShieldExclamationIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">AI Chat Disclaimer</h3>
              <p className="text-sm text-slate-500">
                Informational banner shown at the top of AI chat windows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {savedMessage && (
              <div className="flex items-center gap-1.5 text-sm text-brand-400">
                <CheckCircleIcon className="h-4 w-4" />
                Saved
              </div>
            )}
            <button
              type="button"
              onClick={handleToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-brand-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      {enabled && (
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Disclaimer Text
            </label>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => save(enabled, text)}
              placeholder="Responses are generated by AI and may not always be accurate."
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Users can collapse this banner but cannot dismiss it. Disable the toggle above to hide it entirely.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function TriageSettings({ providers }: { providers: AIProvider[] }) {
  const [aiTriageEnabled, setAiTriageEnabled] = useState(false)
  const [autoStatusEnabled, setAutoStatusEnabled] = useState(false)
  const [loadingFlags, setLoadingFlags] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchFlags() {
      try {
        const res = await fetch('/api/features')
        if (res.ok) {
          const data = await res.json()
          const features = data.features || []
          setAiTriageEnabled(features.some((f: { key: string; enabled: boolean }) => f.key === 'ai_triage' && f.enabled))
          setAutoStatusEnabled(features.some((f: { key: string; enabled: boolean }) => f.key === 'ai_auto_status' && f.enabled))
        }
      } catch {
        // Features API may not be fully available
      } finally {
        setLoadingFlags(false)
      }
    }
    fetchFlags()
  }, [])

  const toggleFeature = async (featureKey: string, enable: boolean) => {
    setSaving(true)
    try {
      const endpoint = enable ? '/api/features/enable' : '/api/features/disable'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, acknowledgeBeta: true }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to toggle feature')
      }
      if (featureKey === 'ai_triage') setAiTriageEnabled(enable)
      if (featureKey === 'ai_auto_status') setAutoStatusEnabled(enable)
    } catch {
      // Revert on failure
      if (featureKey === 'ai_triage') setAiTriageEnabled(!enable)
      if (featureKey === 'ai_auto_status') setAutoStatusEnabled(!enable)
    } finally {
      setSaving(false)
    }
  }

  if (loadingFlags) return null

  const hasActiveProvider = providers.some(p => p.is_active)

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <SparklesIcon className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">AI Triage</h3>
            <p className="text-sm text-slate-500">
              Automatic ticket classification, scoring, and queue management
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* AI Triage Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Enable AI Triage</p>
            <p className="text-xs text-slate-500">
              Use AI to classify ticket action states and compute queue scores.
              Without AI, heuristic scoring still works.
            </p>
          </div>
          <button
            onClick={() => toggleFeature('ai_triage', !aiTriageEnabled)}
            disabled={saving || !hasActiveProvider}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              aiTriageEnabled ? 'bg-brand-600' : 'bg-slate-600'
            } ${!hasActiveProvider ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                aiTriageEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Auto-Status Switching */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Auto-Status Switching</p>
            <p className="text-xs text-slate-500">
              Allow AI to automatically change ticket statuses based on conversation analysis.
              Requires AI Triage to be enabled.
            </p>
          </div>
          <button
            onClick={() => toggleFeature('ai_auto_status', !autoStatusEnabled)}
            disabled={saving || !aiTriageEnabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoStatusEnabled && aiTriageEnabled ? 'bg-brand-600' : 'bg-slate-600'
            } ${!aiTriageEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoStatusEnabled && aiTriageEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Status Info */}
        {!hasActiveProvider && (
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-400/80">
              Add and configure an AI provider above before enabling triage.
            </p>
          </div>
        )}

        {!aiTriageEnabled && hasActiveProvider && (
          <div className="flex items-start gap-2 px-3 py-2 bg-slate-900 rounded-lg">
            <ExclamationTriangleIcon className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              AI triage is disabled. The queue still works using heuristic scoring based on
              ticket status, priority, SLA targets, and reply patterns.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AISettingsPage() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addingModel, setAddingModel] = useState<string | null>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newProvider, setNewProvider] = useState({
    name: '',
    type: 'ollama' as AIProvider['type'],
    api_url: '',
    api_key: '',
  })

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/settings/ai/providers')
      const data = await response.json()
      if (data.success) {
        setProviders(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const handleTestConnection = async (providerId: string) => {
    setTesting(providerId)
    try {
      const response = await fetch(`/api/settings/ai/providers/${providerId}/test`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setProviders(prev => prev.map(p =>
          p.id === providerId
            ? {
                ...p,
                status: data.data.connected ? 'connected' : 'error',
                availableModels: data.data.models || [],
              }
            : p
        ))
      }
    } catch {
      setProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, status: 'error' } : p
      ))
    } finally {
      setTesting(null)
    }
  }

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.api_url) return

    setSaving(true)
    try {
      const response = await fetch('/api/settings/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProvider),
      })

      const data = await response.json()
      if (data.success) {
        setShowAddForm(false)
        setNewProvider({ name: '', type: 'ollama', api_url: '', api_key: '' })
        // Refresh from server to avoid stale state, then test
        await fetchProviders()
        handleTestConnection(data.data.id)
      }
    } catch (error) {
      console.error('Failed to add provider:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Delete this AI provider and all its configured models?')) return

    try {
      const response = await fetch(`/api/settings/ai/providers/${providerId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        setProviders(prev => prev.filter(p => p.id !== providerId))
      }
    } catch (error) {
      console.error('Failed to delete provider:', error)
    }
  }

  const handleAddModel = async (providerId: string, modelName: string) => {
    if (!modelName) return
    
    try {
      const response = await fetch(`/api/settings/ai/providers/${providerId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: modelName,
          display_name: modelName,
          use_case: 'general',
          is_default: providers.find(p => p.id === providerId)?.models.length === 0,
        }),
      })
      
      const data = await response.json()
      if (data.success) {
        setProviders(prev => prev.map(p =>
          p.id === providerId
            ? { ...p, models: [...p.models, data.data] }
            : p
        ))
        setAddingModel(null)
        setNewModelName('')
      }
    } catch (error) {
      console.error('Failed to add model:', error)
    }
  }

  const getDefaultUrl = (type: string) => {
    switch (type) {
      case 'ollama': return 'http://localhost:11434'
      case 'openai': return 'https://api.openai.com/v1'
      case 'anthropic': return 'https://api.anthropic.com/v1'
      case 'google': return 'https://generativelanguage.googleapis.com/v1beta'
      default: return ''
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
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Link href="/portal/settings" className="hover:text-brand-400 flex items-center gap-1">
              <ArrowLeftIcon className="h-4 w-4" />
              Settings
            </Link>
            <span>/</span>
            <span className="text-slate-200">AI Configuration</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <SparklesIcon className="h-7 w-7 text-purple-400" />
            AI Configuration
          </h1>
          <p className="text-slate-400 mt-1">
            Configure AI providers for text generation, summarization, and assistance features.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {/* Self-Hosted Notice */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ServerIcon className="h-6 w-6 text-purple-400 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-purple-300">Self-Hosted AI Support</h3>
            <p className="text-sm text-purple-400/80 mt-1">
              Aegis supports self-hosted AI models via Ollama. Keep your data private by running AI locally.
              <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                Learn more about Ollama →
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Add Provider Form */}
      {showAddForm && (
        <div className="bg-slate-800 rounded-lg border border-brand-500/50 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Add AI Provider</h3>
          
          {/* Provider Type Selection */}
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-2">Provider Type</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {providerTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setNewProvider({ 
                    ...newProvider, 
                    type: type.id as AIProvider['type'],
                    api_url: getDefaultUrl(type.id),
                  })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    newProvider.type === type.id
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className={`mb-2 ${newProvider.type === type.id ? 'text-brand-400' : 'text-slate-400'}`}>
                    {type.icon}
                  </div>
                  <p className={`font-medium ${newProvider.type === type.id ? 'text-brand-400' : 'text-slate-200'}`}>
                    {type.name}
                  </p>
                  <p className="text-xs text-slate-500">{type.description}</p>
                  {type.is_local && (
                    <span className="inline-block mt-2 px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                      Local
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., My Ollama Server"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">API URL</label>
              <input
                type="text"
                value={newProvider.api_url}
                onChange={(e) => setNewProvider({ ...newProvider, api_url: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="http://localhost:11434"
              />
            </div>
            {newProvider.type !== 'ollama' && (
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={newProvider.api_key}
                  onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="sk-..."
                />
                <p className="text-xs text-slate-500 mt-1">API key is encrypted and stored securely</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-6">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddProvider}
              disabled={!newProvider.name || !newProvider.api_url}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              Add Provider
            </button>
          </div>
        </div>
      )}

      {/* Providers List */}
      {providers.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <SparklesIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No AI Providers Configured</h3>
          <p className="text-slate-500 mb-4">
            Add an AI provider to enable text generation, summarization, and AI assistance features.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Your First Provider
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="bg-slate-800 rounded-lg border border-slate-700">
              {/* Provider Header */}
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${provider.is_local ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {provider.is_local ? <ServerIcon className="h-6 w-6" /> : <CloudIcon className="h-6 w-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{provider.name}</h3>
                      {provider.is_local && (
                        <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                          Self-Hosted
                        </span>
                      )}
                      {provider.is_active && (
                        <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{provider.api_url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Connection Status */}
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm ${
                    provider.status === 'connected' 
                      ? 'bg-brand-500/20 text-brand-400'
                      : provider.status === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {provider.status === 'connected' ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : provider.status === 'error' ? (
                      <ExclamationTriangleIcon className="h-4 w-4" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-500" />
                    )}
                    {provider.status === 'connected' ? 'Connected' : provider.status === 'error' ? 'Error' : 'Unknown'}
                  </div>
                  <button
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testing === provider.id}
                    className="p-2 text-slate-400 hover:text-brand-400 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Test Connection"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${testing === provider.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProvider(provider.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Provider"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Models */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-300">Configured Models</h4>
                  <button 
                    onClick={() => setAddingModel(addingModel === provider.id ? null : provider.id)}
                    className="text-sm text-brand-400 hover:text-brand-300"
                  >
                    {addingModel === provider.id ? 'Cancel' : '+ Add Model'}
                  </button>
                </div>

                {/* Add Model Form */}
                {addingModel === provider.id && (
                  <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-brand-500/30">
                    <div className="flex gap-2">
                      {provider.availableModels && provider.availableModels.length > 0 ? (
                        <select
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Select a model...</option>
                          {provider.availableModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="Model name (e.g., llama3.2)"
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      )}
                      <button
                        onClick={() => handleAddModel(provider.id, newModelName)}
                        disabled={!newModelName}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {provider.availableModels && provider.availableModels.length > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        {provider.availableModels.length} models available on this server
                      </p>
                    )}
                  </div>
                )}

                {provider.models.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500 mb-2">No models configured yet.</p>
                    {provider.status === 'connected' && provider.availableModels && provider.availableModels.length > 0 && (
                      <p className="text-xs text-brand-400">
                        Found {provider.availableModels.length} models. Click "Add Model" to configure one.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {provider.models.map((model) => (
                      <div 
                        key={model.id}
                        className={`p-3 rounded-lg border ${
                          model.is_active 
                            ? 'border-slate-700 bg-slate-900' 
                            : 'border-slate-800 bg-slate-900/50 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-200 truncate">{model.display_name}</span>
                          {model.is_default && (
                            <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded flex-shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono truncate">{model.model_name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500 capitalize">{model.use_case}</span>
                          <span className={`text-xs ${model.is_active ? 'text-brand-400' : 'text-slate-500'}`}>
                            {model.is_active ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prompts Link */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <SparklesIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-slate-200">AI Prompts & Presets</h3>
              <p className="text-sm text-slate-500">Configure system prompts for different use cases</p>
            </div>
          </div>
          <Link
            href="/portal/settings/ai/prompts"
            className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Manage Prompts
          </Link>
        </div>
      </div>

      {/* AI Response Mode */}
      <ResponseModeSettings />

      {/* AI Chat Disclaimer */}
      <DisclaimerSettings />

      {/* AI Triage Settings */}
      <TriageSettings providers={providers} />

      {/* Help Text */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Quick Setup Guide</h3>
        <div className="text-sm text-slate-500 space-y-2">
          <p><strong className="text-purple-400">For Ollama (Recommended for Privacy):</strong></p>
          <ol className="list-decimal list-inside ml-2 space-y-1">
            <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">ollama.ai</a></li>
            <li>Run <code className="px-1 py-0.5 bg-slate-900 rounded text-brand-400">ollama pull llama2</code> to download a model</li>
            <li>Start Ollama with <code className="px-1 py-0.5 bg-slate-900 rounded text-brand-400">ollama serve</code></li>
            <li>Add provider above with URL <code className="px-1 py-0.5 bg-slate-900 rounded text-brand-400">http://localhost:11434</code></li>
          </ol>
          <p className="mt-3"><strong className="text-blue-400">For Cloud Providers:</strong></p>
          <p className="ml-2">Get an API key from your provider and add it above. Your key is encrypted at rest.</p>
        </div>
      </div>

      {/* Related Settings */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-slate-100">Related Settings</h3>
          <p className="text-sm text-slate-500 mt-1">
            Other settings that work alongside AI configuration.
          </p>
        </div>
        <div className="divide-y divide-slate-700">
          <Link
            href="/portal/settings/api-keys"
            className="flex items-center gap-4 p-4 hover:bg-slate-700/50 transition-colors group"
          >
            <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
              <KeyIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-200 group-hover:text-white transition-colors">API Keys</p>
              <p className="text-sm text-slate-500">
                Manage API keys for external integrations, browser extensions, and automation scripts that use AI chat.
              </p>
            </div>
            <ArrowLeftIcon className="h-4 w-4 text-slate-600 rotate-180 group-hover:text-slate-400 transition-colors" />
          </Link>
          <Link
            href="/portal/settings/knowledge-base/gaps"
            className="flex items-center gap-4 p-4 hover:bg-slate-700/50 transition-colors group"
          >
            <div className="p-2 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
              <LightBulbIcon className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-200 group-hover:text-white transition-colors">KB Gap Detection</p>
              <p className="text-sm text-slate-500">
                Review topics users ask about that aren&apos;t covered by knowledge base articles. Auto-drafts articles when thresholds are met.
              </p>
            </div>
            <ArrowLeftIcon className="h-4 w-4 text-slate-600 rotate-180 group-hover:text-slate-400 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}
