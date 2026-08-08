'use client'

/**
 * /portal/account/api-keys — self-service personal keys.
 *
 * Any authenticated user. Lists keys this user owns, lets them issue a
 * new one (capped by their role-derived scope ceiling, against a 5-key
 * quota), and revoke. Admins manage their OWN personal keys here too —
 * the admin Settings page is strictly for org-owned integrations.
 *
 * Org-wide audit of personal keys (so admins can see + revoke other
 * users' keys) lives at /portal/settings/api-keys.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  KeyIcon,
  PlusIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  XCircleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import type { ApiScope } from '@obilabs/api-scopes'
import { ScopePicker } from '@/components/api-keys/ScopePicker'
import { Button } from '@/components/ui/Button'

interface PersonalKey {
  id: string
  name: string
  key_prefix: string
  scopes: ApiScope[] | null
  permissions?: ApiScope[] | string[]
  rate_limit: number
  expires_at: string | null
  last_used_at: string | null
  is_active: boolean
  created_at: string
}

interface Quota { used: number; max: number }

export default function MyApiKeysPage() {
  const [loading, setLoading] = useState(true)
  const [keys, setKeys] = useState<PersonalKey[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const [maxScopes, setMaxScopes] = useState<ApiScope[]>([])
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [newKeyDropped, setNewKeyDropped] = useState<ApiScope[]>([])
  const [copied, setCopied] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/me/api-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(data.apiKeys || [])
        setQuota(data.quota || null)
        setMaxScopes(data.maxScopes || [])
        return
      }
      if (res.status === 401) {
        window.location.href = '/signin'
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error || `Failed to load keys (${res.status})`)
    } catch (err) {
      console.error('Failed to load personal API keys:', err)
      setError('Failed to load API keys')
    }
  }, [])

  useEffect(() => {
    fetchKeys().finally(() => setLoading(false))
  }, [fetchKeys])

  const handleRevoke = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/portal/me/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRevokeId(null)
        fetchKeys()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to revoke API key')
      }
    } catch (err) {
      console.error('Failed to revoke:', err)
      setError('Failed to revoke API key')
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isExpired = (e: string | null) => (e ? new Date(e) < new Date() : false)
  const active = keys.filter((k) => k.is_active && !isExpired(k.expires_at))
  const inactive = keys.filter((k) => !k.is_active || isExpired(k.expires_at))
  const quotaExhausted = quota !== null && quota.used >= quota.max

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
        <div className="flex items-center gap-4">
          <Link
            href="/portal/dashboard"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">My API Keys</h1>
            <p className="text-slate-400 mt-1">
              Personal keys for your own automation
              {quota ? ` · ${quota.used}/${quota.max} used` : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          disabled={quotaExhausted}
          leftIcon={<PlusIcon />}
          title={quotaExhausted ? `Quota reached (${quota?.max}). Revoke one to create another.` : undefined}
        >
          Create API Key
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheckIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-300">What you can grant</h3>
          <p className="text-sm text-blue-300/80 mt-1">
            Personal keys can only be granted scopes within your role
            permissions. Anything outside that ceiling is dropped at creation
            time. Quota: {quota?.max ?? 5} active keys per user.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Active Keys</h2>
          <span className="text-sm text-slate-500">
            {active.length} of {quota?.max ?? 5}
          </span>
        </div>
        {active.length === 0 ? (
          <div className="p-8 text-center">
            <KeyIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No personal keys yet</h3>
            <p className="text-slate-500">
              Create one for your monitoring scripts, browser extensions, or
              integrations you control.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {active.map((k) => (
              <KeyRow key={k.id} apiKey={k} onRevoke={() => setRevokeId(k.id)} />
            ))}
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-400">Revoked / Expired</h2>
            <span className="text-sm text-slate-600">
              {inactive.length} key{inactive.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {inactive.map((k) => (
              <KeyRow key={k.id} apiKey={k} inactive />
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePersonalKeyModal
          ceiling={maxScopes}
          onClose={() => setShowCreate(false)}
          onCreated={(fullKey, dropped) => {
            setShowCreate(false)
            setNewKey(fullKey)
            setNewKeyDropped(dropped)
            fetchKeys()
          }}
          onError={setError}
        />
      )}

      {newKey && (
        <RevealKeyModal
          fullKey={newKey}
          dropped={newKeyDropped}
          copied={copied}
          onCopy={() => copy(newKey)}
          onClose={() => { setNewKey(null); setNewKeyDropped([]); setCopied(false) }}
        />
      )}

      {revokeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Revoke API Key?</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Anything using this key will immediately fail with 401.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRevokeId(null)} className="px-4 py-2 text-slate-400 hover:text-slate-200">
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(revokeId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function KeyRow({
  apiKey,
  inactive,
  onRevoke,
}: {
  apiKey: PersonalKey
  inactive?: boolean
  onRevoke?: () => void
}) {
  const expired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date()
  const scopes = (apiKey.scopes && apiKey.scopes.length > 0)
    ? apiKey.scopes
    : (Array.isArray(apiKey.permissions) ? apiKey.permissions : [])

  return (
    <div className={`p-4 ${inactive ? 'opacity-50' : 'hover:bg-slate-800/30'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              apiKey.is_active && !expired ? 'bg-brand-500/10' : 'bg-slate-800'
            }`}
          >
            <KeyIcon
              className={`h-5 w-5 ${
                apiKey.is_active && !expired ? 'text-brand-400' : 'text-slate-500'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-slate-200">{apiKey.name}</h3>
              <code className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded font-mono">
                {apiKey.key_prefix}...
              </code>
              {!apiKey.is_active && (
                <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Revoked</span>
              )}
              {expired && apiKey.is_active && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">Expired</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {scopes.length === 0 ? (
                <span className="text-xs text-amber-400 italic">No scopes — key has no v1 access</span>
              ) : (
                scopes.map((s) => (
                  <code key={s} className="px-1.5 py-0.5 text-[11px] bg-slate-800 text-slate-300 rounded font-mono">
                    {s}
                  </code>
                ))
              )}
            </div>
          </div>
        </div>

        {!inactive && onRevoke && (
          <button
            onClick={onRevoke}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Revoke key"
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 ml-14">
        <span className="flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          Last used: {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleString() : 'Never'}
        </span>
        {apiKey.expires_at && (
          <span>Expires: {new Date(apiKey.expires_at).toLocaleDateString()}</span>
        )}
        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

function CreatePersonalKeyModal({
  ceiling,
  onClose,
  onCreated,
  onError,
}: {
  ceiling: ApiScope[]
  onClose: () => void
  onCreated: (fullKey: string, dropped: ApiScope[]) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiScope[]>([])
  const [expiresInDays, setExpiresInDays] = useState(90)
  const [submitting, setSubmitting] = useState(false)

  const ready = name.length > 0 && scopes.length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/me/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes, expires_in_days: expiresInDays }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError(data.message || data.error || 'Failed to create API key')
        return
      }
      const data = await res.json()
      onCreated(data.api_key, data.dropped || [])
    } catch (err) {
      console.error('Create failed:', err)
      onError('Failed to create API key')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 my-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">Create personal API key</h2>
          <p className="text-sm text-slate-400 mt-1">
            For your own automation. Scopes are capped by your role permissions.
          </p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Key name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Chrome extension", "Monitoring script"'
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Scopes <span className="text-red-400">*</span>
            </label>
            <ScopePicker
              value={scopes}
              onChange={setScopes}
              ceiling={ceiling}
              typeHint="personal"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Expires in</label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days (default)</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <Button type="submit" disabled={!ready} isLoading={submitting}>
              {submitting ? 'Creating…' : 'Create API Key'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RevealKeyModal({
  fullKey,
  dropped,
  copied,
  onCopy,
  onClose,
}: {
  fullKey: string
  dropped: ApiScope[]
  copied: boolean
  onCopy: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">API Key Created</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-300">Save this key now!</h3>
              <p className="text-sm text-amber-300/80 mt-1">
                This is the only time it will be shown in full.
              </p>
            </div>
          </div>

          {dropped.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-300">
              <strong>Note:</strong> {dropped.length} scope{dropped.length !== 1 ? 's were' : ' was'}{' '}
              dropped because {dropped.length !== 1 ? 'they' : 'it'} exceed your role
              permissions:
              <div className="mt-1 flex flex-wrap gap-1">
                {dropped.map((s) => (
                  <code key={s} className="px-1.5 py-0.5 bg-slate-900 rounded font-mono">
                    {s}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
            <code className="text-brand-400 text-sm break-all font-mono">{fullKey}</code>
            <button
              onClick={onCopy}
              className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircleIcon className="h-5 w-5 text-brand-400" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400 font-mono">
            curl -H &quot;Authorization: Bearer {fullKey.slice(0, 12)}...&quot;{' '}
            {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/tickets
          </div>

          <Button onClick={onClose} className="w-full">
            I&apos;ve saved the key
          </Button>
        </div>
      </div>
    </div>
  )
}
