'use client'

/**
 * ScopePicker — grouped multi-select for canonical API scopes.
 *
 * Source of truth: `@obilabs/api-scopes`. Scopes are grouped by
 * resource (Tickets / Assets / Contacts / KB / Users / Groups / AI /
 * Sync / Audit / Admin) and color-coded by risk:
 *
 *   - :delete       → red    (destructive)
 *   - :write        → amber  (mutating)
 *   - admin:full    → red    (wildcard)
 *   - everything else (read, ai:chat) → blue (safe)
 *
 * Optional `ceiling` prop caps what the user can pick — anything
 * outside the ceiling is shown disabled with a tooltip ("Outside your
 * role permissions"). When the ceiling contains `admin:full`, the
 * picker treats it as "no cap" since the wildcard grants everything.
 *
 * Optional `typeHint` prop tints the picker for the create-modal type
 * tabs: mtp-polling recommends read scopes only (no enforcement —
 * admin can still pick write if they want).
 */

import { useMemo } from 'react'
import {
  API_SCOPES,
  type ApiScope,
} from '@obilabs/api-scopes'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Grouping + risk classification
// ---------------------------------------------------------------------------

// Display order. Admin sits at the bottom because picking it nullifies
// every other pick — keeping it last reduces the chance of an admin
// accidentally clicking it before realizing what it does.
const GROUPS: Array<{ id: string; label: string; scopes: ApiScope[] }> = [
  { id: 'tickets', label: 'Tickets', scopes: ['tickets:read', 'tickets:write', 'tickets:delete'] },
  { id: 'assets', label: 'Assets', scopes: ['assets:read', 'assets:write'] },
  { id: 'contacts', label: 'Contacts', scopes: ['contacts:read', 'contacts:write'] },
  { id: 'kb', label: 'Knowledge Base', scopes: ['kb:read', 'kb:write', 'kb:delete'] },
  { id: 'users', label: 'Users', scopes: ['users:read', 'users:write', 'users:delete'] },
  { id: 'groups', label: 'Groups', scopes: ['groups:read', 'groups:write', 'groups:delete'] },
  { id: 'ai', label: 'AI', scopes: ['ai:chat'] },
  { id: 'sync', label: 'Sync', scopes: ['sync:read', 'sync:write'] },
  { id: 'audit', label: 'Audit', scopes: ['audit:read'] },
  { id: 'admin', label: 'Administrative', scopes: ['admin:full'] },
]

function riskClasses(scope: ApiScope, selected: boolean): string {
  const base = selected
    ? 'border-2'
    : 'border'
  if (scope === 'admin:full' || scope.endsWith(':delete')) {
    return selected
      ? `${base} bg-red-500/15 border-red-500/60 text-red-300`
      : `${base} bg-slate-800/30 border-slate-700 hover:border-red-500/40 text-slate-300`
  }
  if (scope.endsWith(':write')) {
    return selected
      ? `${base} bg-amber-500/15 border-amber-500/60 text-amber-200`
      : `${base} bg-slate-800/30 border-slate-700 hover:border-amber-500/40 text-slate-300`
  }
  return selected
    ? `${base} bg-blue-500/15 border-blue-500/60 text-blue-200`
    : `${base} bg-slate-800/30 border-slate-700 hover:border-blue-500/40 text-slate-300`
}

function riskBadge(scope: ApiScope): { label: string; tone: string } {
  if (scope === 'admin:full') return { label: 'WILDCARD', tone: 'bg-red-500/20 text-red-300' }
  if (scope.endsWith(':delete')) return { label: 'DESTRUCTIVE', tone: 'bg-red-500/20 text-red-300' }
  if (scope.endsWith(':write')) return { label: 'WRITE', tone: 'bg-amber-500/20 text-amber-300' }
  return { label: 'READ', tone: 'bg-blue-500/20 text-blue-300' }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ScopePickerProps {
  /** Currently-selected scopes. */
  value: ApiScope[]
  /** Called whenever the selection changes. */
  onChange: (next: ApiScope[]) => void
  /**
   * Scopes the user / owner is allowed to grant. Anything outside this
   * set is rendered disabled. If undefined, no ceiling is enforced
   * (admin-issued mtp-polling / delegated-write).
   *
   * If the ceiling contains `admin:full`, the wildcard short-circuits
   * the cap — every scope becomes selectable.
   */
  ceiling?: ApiScope[]
  /**
   * Hint for which scopes are typical for this key type. Renders a
   * soft "recommended" pill — not enforced, purely advisory.
   */
  typeHint?: 'personal' | 'mtp-polling' | 'delegated-write' | 'aegis-mtp-pairing'
  /** Disable interaction (e.g. while submitting). */
  disabled?: boolean
}

const RECOMMENDED_BY_TYPE: Record<NonNullable<ScopePickerProps['typeHint']>, ApiScope[]> = {
  personal: [],
  // MTP polling — read-only ticket + audit pulls for non-Aegis tools.
  'mtp-polling': ['tickets:read', 'audit:read'],
  'delegated-write': [],
  // Aegis MTP pairing — read access is the safe default; the customer
  // can grant write scopes if they want their MSP to act on tickets.
  'aegis-mtp-pairing': ['tickets:read', 'kb:read'],
}

export function ScopePicker({
  value,
  onChange,
  ceiling,
  typeHint,
  disabled,
}: ScopePickerProps) {
  const selectedSet = useMemo(() => new Set(value), [value])
  const ceilingSet = useMemo(() => (ceiling ? new Set(ceiling) : null), [ceiling])
  const wildcardCeiling = ceilingSet?.has('admin:full') ?? false
  const recommended = typeHint ? new Set(RECOMMENDED_BY_TYPE[typeHint]) : null

  const hasAdmin = selectedSet.has('admin:full')

  const isAllowed = (scope: ApiScope): boolean => {
    if (!ceilingSet) return true
    if (wildcardCeiling) return true
    return ceilingSet.has(scope)
  }

  const toggle = (scope: ApiScope) => {
    if (disabled) return
    if (!isAllowed(scope)) return
    const next = new Set(selectedSet)
    if (next.has(scope)) {
      next.delete(scope)
    } else {
      next.add(scope)
    }
    onChange(Array.from(next) as ApiScope[])
  }

  return (
    <div className="space-y-3">
      {hasAdmin && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-red-300 font-medium">
              admin:full is the wildcard.
            </p>
            <p className="text-red-300/80 mt-1">
              This key will grant every scope in every resource. Only use
              for tightly-controlled org-owned integrations.
            </p>
          </div>
        </div>
      )}

      {GROUPS.map((group) => {
        const scopesInGroup = group.scopes
        const anyAllowed = scopesInGroup.some(isAllowed)
        if (!anyAllowed) return null

        return (
          <div key={group.id}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {group.label}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {scopesInGroup.map((scope) => {
                const allowed = isAllowed(scope)
                const selected = selectedSet.has(scope)
                const isRecommended = recommended?.has(scope) ?? false
                const badge = riskBadge(scope)

                return (
                  <button
                    type="button"
                    key={scope}
                    onClick={() => toggle(scope)}
                    disabled={disabled || !allowed}
                    title={
                      !allowed
                        ? 'Outside your role permissions — ask an admin to widen your role to grant this scope.'
                        : API_SCOPES[scope]
                    }
                    className={`text-left px-3 py-2.5 rounded-lg transition-colors ${
                      allowed
                        ? riskClasses(scope, selected)
                        : 'border border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed'
                    } ${disabled ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono">{scope}</code>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          allowed ? badge.tone : 'bg-slate-800 text-slate-600'
                        }`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[11px] mt-1 leading-tight opacity-80">
                      {API_SCOPES[scope]}
                    </p>
                    {isRecommended && allowed && (
                      <span className="inline-block mt-1.5 text-[10px] text-emerald-400">
                        ★ recommended for this type
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {value.length === 0 && (
        <p className="text-xs text-amber-400 flex items-start gap-1.5">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-px" />
          Select at least one scope. A key with no scopes has no v1 API access.
        </p>
      )}
    </div>
  )
}
