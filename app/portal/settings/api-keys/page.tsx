'use client'

/**
 * /portal/settings/api-keys — single page, two surfaces.
 *
 * The page tries `/api/settings/api-keys` first. A 200 means the
 * caller is an admin and gets the org-wide view; a 403 means a
 * non-admin and we fall back to the self-service personal-key view
 * at `/api/portal/me/api-keys`. Probing the endpoint avoids the
 * Better Auth `additionalFields.role` projection bug (HTTP
 * get-session doesn't reliably surface it) and matches what each
 * surface is actually authorized to see.
 *
 * Admin surface:
 *   - org-wide list (with owner email, type, scopes, migration flag)
 *   - filter by type / owner
 *   - create modal with a Personal / MTP polling / Delegated-write
 *     radio at top; fields adapt to the type
 *   - org-wide "verify migrated scopes" banner with dismiss action
 *
 * Non-admin (self-service) surface:
 *   - personal-only list (quota X/5 shown)
 *   - create modal with name + ScopePicker capped by user's ceiling
 *   - revoke own keys
 *
 * Created-key reveal modal (once-only) and the existing revoke/edit
 * dialogs are shared between surfaces.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  KeyIcon,
  PlusIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  XCircleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  UserIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import type { ApiScope } from '@obilabs/api-scopes'
import { ScopePicker } from '@/components/api-keys/ScopePicker'
import { Button } from '@/components/ui/Button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KeyType =
  | 'personal'
  | 'mtp-polling'
  | 'delegated-write'
  | 'standard'
  | 'aegis-mtp-pairing'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: ApiScope[] | string[] // legacy column, kept for back-compat
  scopes: ApiScope[] | null
  rate_limit: number
  expires_at: string | null
  last_used_at: string | null
  is_active: boolean
  ai_context_level: string
  created_at: string
  key_type: KeyType
  key_owner_user_id: string | null
  key_owner_email?: string | null
  key_owner_name?: string | null
  migrated_at?: string | null
}

interface CascadePreview {
  child_keys: number
  msp_users: number
  active_sessions: number
  customer_linked_users: number
}

const TYPE_LABEL: Record<KeyType, string> = {
  personal: 'Personal',
  'mtp-polling': 'MTP polling',
  'delegated-write': 'Delegated write',
  standard: 'Standard (legacy)',
  'aegis-mtp-pairing': 'Aegis MTP pairing',
}

const TYPE_COLOR: Record<KeyType, string> = {
  personal: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  'mtp-polling': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  'delegated-write': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  standard: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  'aegis-mtp-pairing': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
}

const TYPE_ICON: Record<KeyType, typeof UserIcon> = {
  personal: UserIcon,
  'mtp-polling': BuildingOfficeIcon,
  'delegated-write': ArrowsRightLeftIcon,
  standard: KeyIcon,
  'aegis-mtp-pairing': ArrowsRightLeftIcon,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiKeysPage() {
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingMigrations, setPendingMigrations] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState<string | null>(null)

  // Filters. The ?type=X query string pre-selects the type filter so
  // the Settings landing "MTP Pairing" tile can deep-link straight
  // into the filtered list (replaces the deleted bespoke page).
  const searchParams = useSearchParams()
  const typeFromQuery = searchParams.get('type')
  const initialTypeFilter: KeyType | 'all' =
    typeFromQuery === 'personal' ||
    typeFromQuery === 'mtp-polling' ||
    typeFromQuery === 'delegated-write' ||
    typeFromQuery === 'aegis-mtp-pairing' ||
    typeFromQuery === 'standard'
      ? typeFromQuery
      : 'all'
  const [typeFilter, setTypeFilter] = useState<KeyType | 'all'>(initialTypeFilter)
  const [ownerFilter, setOwnerFilter] = useState<string>('all')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [newKeyDropped, setNewKeyDropped] = useState<ApiScope[]>([])
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  // Cascade revocation — MSP pairing keys open this modal instead of
  // the standard revoke modal. State holds the fetched preview + the
  // active countdown banner.
  const [cascadeModal, setCascadeModal] = useState<{
    keyId: string
    keyName: string
    preview: CascadePreview
  } | null>(null)
  const [cascadeQueue, setCascadeQueue] = useState<{
    queueId: string
    keyId: string
    keyName: string
    commitAfter: string
  } | null>(null)
  const [cascadeSecondsLeft, setCascadeSecondsLeft] = useState<number>(0)

  // ---------------------------------------------------------------------------
  // Data fetch — admin-only surface
  //
  // /portal/settings/api-keys is the admin's org-wide audit + integration-
  // key surface. Non-admins see a redirect to /portal/account/api-keys
  // (their own personal keys live there, NOT here).
  // ---------------------------------------------------------------------------

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/api-keys')
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.apiKeys || [])
        setPendingMigrations(data.migration?.pendingVerification ?? 0)
        setBannerDismissed(data.migration?.dismissedAt ?? null)
        return
      }
      if (res.status === 401) {
        window.location.href = '/signin'
        return
      }
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error || `Failed to load keys (${res.status})`)
    } catch (err) {
      console.error('Failed to load API keys:', err)
      setError('Failed to load API keys')
    }
  }, [])

  useEffect(() => {
    fetchKeys().finally(() => setLoading(false))
  }, [fetchKeys])

  // Cascade countdown — tick every second while a queue is active.
  // When countdown hits zero, refetch to pick up the committed state.
  useEffect(() => {
    if (!cascadeQueue) {
      setCascadeSecondsLeft(0)
      return
    }
    const commitAt = new Date(cascadeQueue.commitAfter).getTime()
    const tick = () => {
      const remaining = Math.max(0, Math.round((commitAt - Date.now()) / 1000))
      setCascadeSecondsLeft(remaining)
      if (remaining === 0) {
        // Refresh once at commit time; then the queue banner clears
        // itself on next fetch (the pairing key row shows revoked).
        fetchKeys()
        setCascadeQueue(null)
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [cascadeQueue, fetchKeys])

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const owners = Array.from(
    new Map(
      apiKeys
        .filter((k) => k.key_owner_user_id && k.key_owner_email)
        .map((k) => [
          k.key_owner_user_id!,
          { id: k.key_owner_user_id!, email: k.key_owner_email!, name: k.key_owner_name },
        ]),
    ).values(),
  )

  const filteredKeys = apiKeys.filter((k) => {
    if (typeFilter !== 'all' && k.key_type !== typeFilter) return false
    if (ownerFilter !== 'all' && k.key_owner_user_id !== ownerFilter) return false
    return true
  })

  const isExpired = (e: string | null) => (e ? new Date(e) < new Date() : false)
  const activeKeys = filteredKeys.filter((k) => k.is_active && !isExpired(k.expires_at))
  const inactiveKeys = filteredKeys.filter((k) => !k.is_active || isExpired(k.expires_at))

  const showOrgBanner = pendingMigrations > 0 && !bannerDismissed

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const dismissBanner = async () => {
    try {
      const res = await fetch('/api/settings/api-keys/dismiss-migration-banner', {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setBannerDismissed(data.dismissedAt)
      }
    } catch (err) {
      console.error('Failed to dismiss banner:', err)
    }
  }

  const openRevokeFlow = async (key: ApiKey) => {
    // MSP pairing keys go through the cascade preview + modal.
    // Everything else uses the plain revoke confirm.
    if (key.key_type === 'aegis-mtp-pairing') {
      setError(null)
      try {
        const res = await fetch(`/api/settings/api-keys/${key.id}/cascade-preview`)
        if (res.ok) {
          const preview = await res.json()
          setCascadeModal({
            keyId: key.id,
            keyName: key.name,
            preview,
          })
          return
        }
        // Fall through to plain revoke on preview failure — MSP keys
        // that pre-date the cascade schema won't have children anyway.
      } catch (err) {
        console.error('cascade preview failed:', err)
      }
    }
    setShowRevokeConfirm(key.id)
  }

  const submitCascade = async (reason: string, skipUndo: boolean) => {
    if (!cascadeModal) return
    setError(null)
    try {
      const res = await fetch(
        `/api/settings/api-keys/${cascadeModal.keyId}/revoke-cascade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, skip_undo: skipUndo }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok || res.status === 202) {
        if (data.queued) {
          setCascadeQueue({
            queueId: data.queue_id,
            keyId: cascadeModal.keyId,
            keyName: cascadeModal.keyName,
            commitAfter: data.commit_after,
          })
        }
        setCascadeModal(null)
        fetchKeys()
      } else {
        setError(data.error || data.message || 'Cascade revoke failed')
      }
    } catch (err) {
      console.error('cascade revoke failed:', err)
      setError('Cascade revoke failed')
    }
  }

  const cancelCascade = async () => {
    if (!cascadeQueue) return
    setError(null)
    try {
      const res = await fetch(
        `/api/settings/api-keys/${cascadeQueue.keyId}/revoke-cascade/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queue_id: cascadeQueue.queueId }),
        },
      )
      if (res.ok) {
        setCascadeQueue(null)
        fetchKeys()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Cancel failed — cascade may have already committed')
        setCascadeQueue(null)
      }
    } catch (err) {
      console.error('cancel cascade failed:', err)
      setError('Cancel failed')
    }
  }

  const handleRevoke = async (keyId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' })
      if (res.ok) {
        setShowRevokeConfirm(null)
        fetchKeys()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to revoke API key')
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err)
      setError('Failed to revoke API key')
    }
  }

  const acknowledgeMigration = async (keyId: string) => {
    try {
      const res = await fetch(`/api/settings/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge_migration: true }),
      })
      if (res.ok) {
        fetchKeys()
      }
    } catch (err) {
      console.error('Failed to acknowledge migration:', err)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
        <ShieldCheckIcon className="h-12 w-12 text-brand-400 mx-auto" />
        <h1 className="text-xl font-semibold text-slate-100">Admin access required</h1>
        <p className="text-slate-400">
          This page manages org-wide API keys (MTP polling, delegated-write
          integrations) and audits every key in the organization. Looking for
          your own personal keys?
        </p>
        <Link
          href="/portal/account/api-keys"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          Go to your API Keys
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/portal/settings"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">API Keys (org-wide)</h1>
            <p className="text-slate-400 mt-1">
              MTP polling + delegated-write integrations. Personal keys are
              listed here for audit; users create them themselves at{' '}
              <Link href="/portal/account/api-keys" className="text-brand-400 hover:underline">
                Account → API Keys
              </Link>.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          leftIcon={<PlusIcon />}
        >
          Create API Key
        </Button>
      </div>

      {/* Cascade countdown banner — visible while a queued cascade
          hasn't committed or been cancelled. This is the muscle-
          memory-safe pattern per design D7 (visible countdown beats a
          modal that gets auto-dismissed). */}
      {cascadeQueue && (
        <div className="border border-red-500/40 bg-red-500/10 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-300" />
            </div>
            <div>
              <div className="text-slate-100 font-medium">
                Cascade revocation of &ldquo;{cascadeQueue.keyName}&rdquo; in progress
              </div>
              <div className="text-sm text-slate-300 mt-0.5">
                Commits in {cascadeSecondsLeft}s. Cancel now to keep the pairing and all downstream credentials.
              </div>
            </div>
          </div>
          <button
            onClick={cancelCascade}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Org-wide migration banner */}
      {showOrgBanner && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-300">
              {pendingMigrations} key{pendingMigrations !== 1 ? 's were' : ' was'} auto-migrated from legacy permissions
            </h3>
            <p className="text-sm text-amber-300/80 mt-1">
              Review each key&apos;s scopes — the migration translated the old
              vocabulary best-effort. Click <strong>Verify scopes</strong> on a key
              to acknowledge and clear its banner.
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="text-sm text-amber-400 hover:text-amber-300 px-3 py-1 border border-amber-500/30 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheckIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-300">Secure & auditable by default</h3>
          <p className="text-sm text-blue-300/80 mt-1">
            Every API call is logged with scope, path, IP, and user-agent.
            Delegated-write keys additionally require an action-ticket and
            acting-user header on every write call.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as KeyType | 'all')}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
          >
            <option value="all">All types</option>
            <option value="personal">Personal</option>
            <option value="mtp-polling">MTP polling</option>
            <option value="delegated-write">Delegated write</option>
            <option value="aegis-mtp-pairing">Aegis MTP pairing</option>
            <option value="standard">Standard (legacy)</option>
          </select>
          {owners.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
            >
              <option value="all">All owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.email}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-slate-500">
            Showing {filteredKeys.length} of {apiKeys.length}
          </span>
        </div>

      {/* Active list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Active Keys</h2>
          <span className="text-sm text-slate-500">
            {activeKeys.length} key{activeKeys.length !== 1 ? 's' : ''}
          </span>
        </div>
        {activeKeys.length === 0 ? (
          <div className="p-8 text-center">
            <KeyIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No active API keys</h3>
            <p className="text-slate-500">
              Create one to allow external services to call /api/v1/*.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {activeKeys.map((key) => (
              <ApiKeyRow
                key={key.id}
                apiKey={key}
                isAdmin
                onEdit={() => { setEditingKey(key); setShowEditModal(true) }}
                onRevoke={() => openRevokeFlow(key)}
                onAcknowledge={() => acknowledgeMigration(key.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive / revoked */}
      {inactiveKeys.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-400">Revoked / Expired Keys</h2>
            <span className="text-sm text-slate-600">
              {inactiveKeys.length} key{inactiveKeys.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {inactiveKeys.map((key) => (
              <ApiKeyRow key={key.id} apiKey={key} isAdmin inactive />
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(fullKey, dropped) => {
            setShowCreateModal(false)
            setNewKey(fullKey)
            setNewKeyDropped(dropped)
            fetchKeys()
          }}
          onError={setError}
        />
      )}

      {/* New-key reveal modal */}
      {newKey && (
        <NewKeyRevealModal
          fullKey={newKey}
          dropped={newKeyDropped}
          copied={copied}
          onCopy={() => copyToClipboard(newKey)}
          onClose={() => {
            setNewKey(null)
            setNewKeyDropped([])
            setCopied(false)
          }}
        />
      )}

      {/* Edit modal (admin only — non-admins can revoke and recreate) */}
      {showEditModal && editingKey && (
        <EditKeyModal
          apiKey={editingKey}
          onClose={() => { setShowEditModal(false); setEditingKey(null) }}
          onSaved={() => { setShowEditModal(false); setEditingKey(null); fetchKeys() }}
          onError={setError}
        />
      )}

      {/* Cascade revoke confirm — the modal for MSP pairing keys */}
      {cascadeModal && (
        <CascadeConfirmModal
          keyName={cascadeModal.keyName}
          preview={cascadeModal.preview}
          onCancel={() => setCascadeModal(null)}
          onConfirm={submitCascade}
        />
      )}

      {/* Revoke confirm */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Revoke API Key?</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Any integration using this key will immediately start
                  failing with 401.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRevokeConfirm(null)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(showRevokeConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Revoke Key
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

function ApiKeyRow({
  apiKey,
  isAdmin,
  inactive,
  onEdit,
  onRevoke,
  onAcknowledge,
}: {
  apiKey: ApiKey
  isAdmin: boolean
  inactive?: boolean
  onEdit?: () => void
  onRevoke?: () => void
  onAcknowledge?: () => void
}) {
  const expired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date()
  const TypeIcon = TYPE_ICON[apiKey.key_type] || KeyIcon
  // The migration backfilled scopes from permissions; new writes set
  // both. Show the canonical column when present.
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
            <TypeIcon
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
              <span
                className={`px-2 py-0.5 text-xs rounded border ${
                  TYPE_COLOR[apiKey.key_type] || TYPE_COLOR.standard
                }`}
              >
                {TYPE_LABEL[apiKey.key_type] || apiKey.key_type}
              </span>
              {!apiKey.is_active && (
                <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Revoked</span>
              )}
              {expired && apiKey.is_active && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">Expired</span>
              )}
              {apiKey.migrated_at && isAdmin && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded">
                  Migrated — verify
                </span>
              )}
            </div>

            {/* Owner (admin view, personal keys only) */}
            {isAdmin && apiKey.key_owner_user_id && (
              <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" />
                Owner: {apiKey.key_owner_name || apiKey.key_owner_email}
              </div>
            )}

            {/* Scopes (canonical) */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {scopes.length === 0 ? (
                <span className="text-xs text-amber-400 italic">No scopes — key has no v1 access</span>
              ) : (
                scopes.map((s) => (
                  <code
                    key={s}
                    className="px-1.5 py-0.5 text-[11px] bg-slate-800 text-slate-300 rounded font-mono"
                  >
                    {s}
                  </code>
                ))
              )}
            </div>
          </div>
        </div>

        {!inactive && (
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-slate-400">
                {apiKey.rate_limit > 0 ? `${apiKey.rate_limit}/hr` : 'Unlimited'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {apiKey.migrated_at && onAcknowledge && (
                <button
                  onClick={onAcknowledge}
                  className="px-2 py-1 text-xs text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/10"
                  title="Mark this key's scopes as verified"
                >
                  Verify scopes
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Edit key"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                </button>
              )}
              {onRevoke && (
                <button
                  onClick={onRevoke}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Revoke key"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 ml-14">
        <span className="flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          Last used:{' '}
          {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleString() : 'Never'}
        </span>
        {apiKey.expires_at && (
          <span>Expires: {new Date(apiKey.expires_at).toLocaleDateString()}</span>
        )}
        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create modal — type-aware
// ---------------------------------------------------------------------------

function CreateKeyModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void
  onCreated: (fullKey: string, dropped: ApiScope[]) => void
  onError: (msg: string) => void
}) {
  // Admin issues org-owned types ONLY. Personal keys live at
  // /portal/account/api-keys (self-service). Personal isn't an option
  // here — even for admins issuing on-behalf — because the owner is
  // the only authoritative gatekeeper for their own automation creds.
  const [keyType, setKeyType] = useState<
    'mtp-polling' | 'delegated-write' | 'aegis-mtp-pairing'
  >('mtp-polling')
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiScope[]>([])
  const [partnerLabel, setPartnerLabel] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(90)
  const [rateLimit, setRateLimit] = useState(500)
  const [submitting, setSubmitting] = useState(false)

  // All admin-issued types require an explicit scope selection. For
  // pairing keys the customer chooses the ceiling the MTP firm can
  // exercise; the pairing-window + single-use binding are key
  // security mechanics that don't constrain authorization.
  const ready = name.length > 0 && scopes.length > 0

  // Default scope set per type — applied once when the tab changes
  // so the picker isn't empty when the user opens a fresh tab.
  useEffect(() => {
    if (keyType === 'aegis-mtp-pairing' && scopes.length === 0) {
      setScopes(['tickets:read'])
    }
    // Intentionally only fires when keyType changes; preserves the
    // user's existing picks if they edit and revisit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyType])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setSubmitting(true)

    try {
      // Pairing keys carry name + customer-chosen scopes (window
      // set server-side); other types also carry rate limit + expiry.
      const body: Record<string, unknown> =
        keyType === 'aegis-mtp-pairing'
          ? { key_type: keyType, name, scopes }
          : {
              key_type: keyType,
              name,
              scopes,
              rate_limit: rateLimit,
              expires_in_days: expiresInDays,
            }
      if (keyType === 'delegated-write' && partnerLabel) body.partner_label = partnerLabel

      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          <h2 className="text-xl font-semibold text-slate-100">Create API Key</h2>
          <p className="text-sm text-slate-400 mt-1">
            Org-owned integrations only. Personal keys are self-service at{' '}
            <Link href="/portal/account/api-keys" className="text-brand-400 hover:underline">
              Account → API Keys
            </Link>.
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Type picker — three org-owned types */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Key type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['mtp-polling', 'delegated-write', 'aegis-mtp-pairing'] as const).map((t) => {
                const Icon = TYPE_ICON[t]
                const selected = keyType === t
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setKeyType(t)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? 'bg-brand-500/10 border-brand-500/50'
                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-slate-300" />
                      <span className="text-sm font-medium text-slate-200">{TYPE_LABEL[t]}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {t === 'mtp-polling' && 'Org-owned, read-oriented (e.g., MSP polling).'}
                      {t === 'delegated-write' && 'Org-owned; per-call action headers required on writes.'}
                      {t === 'aegis-mtp-pairing' && 'Org-owned; 15-min pairing window + single-use binding for Aegis MTP.'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Key name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                keyType === 'mtp-polling'
                  ? 'e.g. "Acme MSP polling"'
                  : keyType === 'delegated-write'
                  ? 'e.g. "ConnectWise integration"'
                  : 'e.g. "Local MTP"'
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              required
            />
          </div>

          {/* Pairing contract note (aegis-mtp-pairing only) */}
          {keyType === 'aegis-mtp-pairing' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300/90 space-y-1">
              <p><strong>What you get on submit:</strong></p>
              <p>
                An <code>aegis_*</code> bearer key shown ONCE plus a 15-minute pairing
                window. Hand the key to your MTP and complete the handshake before the
                window closes. After the first handshake, the binding is permanent —
                an attacker who later obtains the key can&apos;t pair with it.
              </p>
              <p>
                Scopes below are the <strong>ceiling</strong> for what this MTP can do.
                Default is read-only ticket access; tick more boxes to grant the MTP
                write or other capabilities. Revoke the key at any time to cut off access.
              </p>
            </div>
          )}

          {/* Partner label (delegated-write only) */}
          {keyType === 'delegated-write' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Partner label
              </label>
              <input
                type="text"
                value={partnerLabel}
                onChange={(e) => setPartnerLabel(e.target.value)}
                placeholder="e.g. ConnectWise, Datto, Halo PSA"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Free text, recorded in audit context for forensic queries.
              </p>
            </div>
          )}

          {/* Delegated-write contract note */}
          {keyType === 'delegated-write' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300/90">
              <strong>Required headers on every write/delete:</strong>
              <code className="block mt-1 text-amber-300">X-Aegis-Action-Ticket: ACME-1234</code>
              <code className="block text-amber-300">X-Aegis-Acting-User-Email: alice@msp.example</code>
              <p className="mt-1">
                Reads (e.g. <code>GET /api/v1/tickets</code>) don&apos;t require them. Missing
                headers on a write call return 412 missing-action-context.
              </p>
            </div>
          )}

          {/* Scope picker — every admin type uses it; pairing keys
              get a customer-chosen ceiling, default tickets:read. */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Scopes <span className="text-red-400">*</span>
            </label>
            <ScopePicker
              value={scopes}
              onChange={setScopes}
              typeHint={keyType}
              disabled={submitting}
            />
          </div>

          {/* Rate limit + expiry — not for pairing keys (pairing
              keys don't expire by clock, only by revocation). */}
          {keyType !== 'aegis-mtp-pairing' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Rate limit (req/hr) — 0 = unlimited
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value) || 0)}
                  min={0}
                  max={100000}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
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
            </>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
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

// ---------------------------------------------------------------------------
// Edit modal — admin only
// ---------------------------------------------------------------------------

function EditKeyModal({
  apiKey,
  onClose,
  onSaved,
  onError,
}: {
  apiKey: ApiKey
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const initialScopes = (
    apiKey.scopes && apiKey.scopes.length > 0
      ? apiKey.scopes
      : (Array.isArray(apiKey.permissions) ? apiKey.permissions : [])
  ) as ApiScope[]

  const [name, setName] = useState(apiKey.name)
  const [scopes, setScopes] = useState<ApiScope[]>(initialScopes)
  const [rateLimit, setRateLimit] = useState(apiKey.rate_limit)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/settings/api-keys/${apiKey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          scopes,
          rate_limit: rateLimit,
          // Editing implies the admin has reviewed scopes; clear the
          // migrated flag too so the per-row banner goes away.
          acknowledge_migration: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError(data.message || data.error || 'Failed to update API key')
        return
      }
      onSaved()
    } catch (err) {
      console.error('Edit failed:', err)
      onError('Failed to update API key')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 my-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">Edit API Key</h2>
          <p className="text-sm text-slate-400 mt-1">
            <code className="text-slate-500">{apiKey.key_prefix}...</code> ·{' '}
            {TYPE_LABEL[apiKey.key_type]}
          </p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Key name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Scopes</label>
            {/* No ceiling on edit — admin can grant anything the key
                's owner could have at issuance time. */}
            <ScopePicker value={scopes} onChange={setScopes} disabled={submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Rate limit (req/hr) — 0 = unlimited
            </label>
            <input
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value) || 0)}
              min={0}
              max={100000}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
            />
          </div>
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={scopes.length === 0 || !name}
              isLoading={submitting}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New-key reveal modal — shown exactly once
// ---------------------------------------------------------------------------

function NewKeyRevealModal({
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
              <strong>Note:</strong> {dropped.length} requested scope
              {dropped.length !== 1 ? 's were' : ' was'} not granted because
              {dropped.length !== 1 ? ' they' : ' it'} exceed your role
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

// ---------------------------------------------------------------------------
// CascadeConfirmModal — the specialty confirmation for MSP pairing revoke.
// ---------------------------------------------------------------------------
//
// Design D8: show the exact cascade scope (child_keys, msp_users,
// active_sessions) alongside what is NOT affected (customer_linked_users +
// the caller's own session, since the self-DoS guard already ran server-
// side). Two buttons: "Revoke with 60s undo" (default) and "Revoke
// immediately" (skip-undo path — requires typing REVOKE to confirm).

function CascadeConfirmModal({
  keyName,
  preview,
  onCancel,
  onConfirm,
}: {
  keyName: string
  preview: CascadePreview
  onCancel: () => void
  onConfirm: (reason: string, skipUndo: boolean) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [skipUndo, setSkipUndo] = useState(false)
  const [skipConfirmText, setSkipConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canConfirm = reason.trim().length >= 3 &&
    (!skipUndo || skipConfirmText === 'REVOKE')

  const submit = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    try {
      await onConfirm(reason.trim(), skipUndo)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-400 flex-shrink-0" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-100">
              Cascade-revoke &ldquo;{keyName}&rdquo;?
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              This offboards the MSP firm completely from this install.
            </p>
          </div>
        </div>

        <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4 space-y-2">
          <div className="text-sm font-medium text-red-300">This will revoke:</div>
          <ul className="text-sm text-slate-300 space-y-1 pl-5 list-disc">
            <li>The pairing key itself</li>
            <li>
              <strong className="text-slate-100">{preview.child_keys}</strong>{' '}
              child API {preview.child_keys === 1 ? 'key' : 'keys'} issued under this pairing
            </li>
            <li>
              <strong className="text-slate-100">{preview.msp_users}</strong>{' '}
              user {preview.msp_users === 1 ? 'account' : 'accounts'} provisioned for MSP staff
            </li>
            <li>
              <strong className="text-slate-100">{preview.active_sessions}</strong>{' '}
              active {preview.active_sessions === 1 ? 'session' : 'sessions'} for those users
            </li>
          </ul>
        </div>

        <div className="border border-slate-700 bg-slate-800/40 rounded-lg p-4 space-y-2">
          <div className="text-sm font-medium text-slate-300">Will NOT affect:</div>
          <ul className="text-sm text-slate-400 space-y-1 pl-5 list-disc">
            <li>
              <strong className="text-slate-200">{preview.customer_linked_users}</strong>{' '}
              customer {preview.customer_linked_users === 1 ? 'user' : 'users'} linked-to-MSP
              (their SSO breaks; user records stay)
            </li>
            <li>Your current session (you&apos;re not an MSP-provisioned user)</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Reason (recorded in audit log)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. MSP contract ended 2026-07-30"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
            maxLength={500}
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={skipUndo}
            onChange={(e) => setSkipUndo(e.target.checked)}
            className="mt-1"
          />
          <div className="text-sm">
            <div className="text-slate-200 font-medium">
              Revoke immediately (skip 60-second undo window)
            </div>
            <div className="text-slate-400 mt-0.5">
              Use only for mid-incident-response. Cannot be undone.
            </div>
          </div>
        </label>

        {skipUndo && (
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Type <code className="text-red-300 font-mono">REVOKE</code> to confirm
            </label>
            <input
              type="text"
              value={skipConfirmText}
              onChange={(e) => setSkipConfirmText(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-red-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Keep pairing
          </button>
          <button
            onClick={submit}
            disabled={!canConfirm || submitting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Submitting...'
              : skipUndo
              ? 'Revoke immediately'
              : 'Revoke with 60s undo'}
          </button>
        </div>
      </div>
    </div>
  )
}
