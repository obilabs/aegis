'use client'

import { useState, useEffect } from 'react'

interface TelemetryLogEntry {
  id: string
  tier: number
  event_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'sent' | 'failed'
  response_code: number | null
  error_message: string | null
  sent_at: string | null
  created_at: string
}

const TIER_LABELS: Record<number, { name: string; description: string }> = {
  0: { name: 'Install Ping Only', description: 'Anonymous install count — sent once' },
  1: { name: 'Setup Snapshot', description: 'One-time anonymous setup details (industry, team size, features)' },
  2: { name: 'Usage Heartbeat', description: 'Daily anonymous usage metrics (ticket ranges, module adoption)' },
}

const TIER_PAYLOADS: Record<number, string> = {
  0: '{ instance_id, version, license_key, installed_at }',
  1: '{ industry, team_size, use_case, features_enabled }',
  2: '{ user_count_range, ticket_volume_range, modules, uptime }',
}

export default function TelemetrySettingsPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState(0)
  const [log, setLog] = useState<TelemetryLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  // Master kill-switch state — consent.effective resolves env > db.
  // PRINCIPLES.md #2 (consent-first telemetry).
  const [consent, setConsent] = useState<{
    effective: 'on' | 'off'
    source: 'env' | 'db' | 'default'
    db_value: boolean
  } | null>(null)
  const [consentLog, setConsentLog] = useState<Array<{
    id: string
    action: string
    source: string
    prev_state: string
    new_state: string
    reason: string | null
    created_at: string
  }>>([])
  const [previewPayload, setPreviewPayload] = useState<Record<string, unknown> | null>(null)
  const [payloadModalOpen, setPayloadModalOpen] = useState(false)

  useEffect(() => {
    fetchTelemetry()
  }, [])

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/settings/telemetry')
      if (res.ok) {
        const data = await res.json()
        setInstanceId(data.instance_id)
        setLicenseKey(data.license_key)
        setCurrentTier(data.telemetry_tier)
        setLog(data.log || [])
        setConsent(data.consent ?? null)
        setConsentLog(data.consent_log ?? [])
        setPreviewPayload(data.preview_payload ?? null)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const updateTier = async (tier: number) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/telemetry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telemetry_tier: tier }),
      })
      if (res.ok) {
        setCurrentTier(tier)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const updateEnabled = async (enabled: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/telemetry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telemetry_enabled: enabled }),
      })
      if (res.ok) {
        // Refetch so consent log + effective state are fresh
        await fetchTelemetry()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const envOverrideActive = consent?.source === 'env'
  const effectiveOn = consent?.effective === 'on'

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-48" />
          <div className="h-32 bg-slate-800 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Telemetry</h1>
        <p className="text-slate-400 mt-1">
          Anonymous telemetry helps improve Aegis. No personal information is ever collected.
        </p>
      </div>

      {/* Instance Info */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-400">Instance ID</span>
            <p className="text-sm font-mono text-slate-300 mt-0.5">
              {instanceId || 'Not generated yet'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm text-slate-400">Current Tier</span>
            <p className="text-sm font-medium text-slate-300 mt-0.5">
              Tier {currentTier} — {TIER_LABELS[currentTier]?.name}
            </p>
          </div>
        </div>
        {licenseKey && (
          <div className="pt-3 border-t border-slate-700">
            <span className="text-sm text-slate-400">License Key</span>
            <p className="text-sm font-mono text-brand-400 mt-0.5 tracking-wider">
              {licenseKey}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Issued by the ObiLabs control plane. Community installs have no key — every feature works without one.
            </p>
          </div>
        )}
      </div>

      {/* Master kill-switch — PRINCIPLES.md #2 (consent-first telemetry) */}
      <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-slate-200">Send any telemetry</h2>
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                effectiveOn
                  ? 'bg-emerald-900/40 text-emerald-300'
                  : 'bg-amber-900/40 text-amber-300'
              }`}>
                {effectiveOn ? 'On' : 'Off'}
              </span>
              {envOverrideActive && (
                <span className="text-[10px] uppercase tracking-wider bg-sky-900/40 text-sky-300 px-1.5 py-0.5 rounded">
                  Env override
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              Master kill-switch. When off, no payload is sent — including the install ping
              and license re-validation. The tier toggles below only matter when this is on.
            </p>
            {envOverrideActive && (
              <p className="text-xs text-amber-300/80 mt-2">
                The <code className="text-amber-200">TELEMETRY_ENABLED=false</code> environment
                variable is overriding this setting. Remove it from your container env and
                restart to use the UI toggle.
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => updateEnabled(!consent?.db_value)}
              disabled={saving || envOverrideActive}
              role="switch"
              aria-checked={consent?.db_value ?? true}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                consent?.db_value ? 'bg-brand-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-slate-100 transition ${
                  consent?.db_value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        {previewPayload && (
          <div className="pt-3 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setPayloadModalOpen(true)}
              className="text-xs text-brand-400 hover:text-brand-300 underline"
            >
              View the literal next-send payload →
            </button>
          </div>
        )}
      </div>

      {/* Tier Selection — dimmed when master is off */}
      <div className={`space-y-3 ${effectiveOn ? '' : 'opacity-40 pointer-events-none'}`}>
        <h2 className="text-lg font-semibold text-slate-200">What We Collect</h2>
        <p className="text-sm text-slate-400">
          {effectiveOn
            ? 'Choose how much anonymous data to share. You can change this at any time.'
            : 'Telemetry is off; tier choices below are ignored until you re-enable above.'}
        </p>

        {/* Tier 0 — fires when master is on (NOT unconditionally) */}
        <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-200">
                Tier 0: {TIER_LABELS[0].name}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">{TIER_LABELS[0].description}</p>
            </div>
            <span className="text-xs text-slate-500 italic">
              {effectiveOn ? 'Sent when consented' : 'Suppressed'}
            </span>
          </div>
          <code className="block mt-2 text-xs text-slate-500 font-mono bg-slate-900/50 p-2 rounded">
            {TIER_PAYLOADS[0]}
          </code>
        </div>

        {/* Tier 1 */}
        <button
          type="button"
          onClick={() => updateTier(currentTier >= 1 ? 0 : 1)}
          disabled={saving}
          className={`w-full p-4 rounded-lg border text-left transition-all ${
            currentTier >= 1
              ? 'border-brand-500/50 bg-brand-500/5'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-200">
                Tier 1: {TIER_LABELS[1].name}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">{TIER_LABELS[1].description}</p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors ${
              currentTier >= 1 ? 'bg-brand-500' : 'bg-slate-700'
            }`}>
              <div className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${
                currentTier >= 1 ? 'ml-5' : 'ml-1'
              }`} />
            </div>
          </div>
          <code className="block mt-2 text-xs text-slate-500 font-mono bg-slate-900/50 p-2 rounded">
            {TIER_PAYLOADS[1]}
          </code>
        </button>

        {/* Tier 2 */}
        <button
          type="button"
          onClick={() => updateTier(currentTier >= 2 ? 1 : 2)}
          disabled={saving}
          className={`w-full p-4 rounded-lg border text-left transition-all ${
            currentTier >= 2
              ? 'border-brand-500/50 bg-brand-500/5'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-200">
                Tier 2: {TIER_LABELS[2].name}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">{TIER_LABELS[2].description}</p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors ${
              currentTier >= 2 ? 'bg-brand-500' : 'bg-slate-700'
            }`}>
              <div className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${
                currentTier >= 2 ? 'ml-5' : 'ml-1'
              }`} />
            </div>
          </div>
          <code className="block mt-2 text-xs text-slate-500 font-mono bg-slate-900/50 p-2 rounded">
            {TIER_PAYLOADS[2]}
          </code>
        </button>
      </div>

      {/* Consent log — append-only audit history per PRINCIPLES.md #6 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Consent Log</h2>
        <p className="text-sm text-slate-400">
          Every change to your telemetry consent state is recorded here.
          Append-only — entries are never edited or deleted.
        </p>
        {consentLog.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-500">No consent changes recorded yet.</p>
          </div>
        ) : (
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {consentLog.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-300 capitalize">
                      {row.action}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {row.source.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                      {row.prev_state} → {row.new_state}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Telemetry Log */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Telemetry Log</h2>
        <p className="text-sm text-slate-400">
          Every payload sent is logged here for full transparency. Click a row to view the exact data.
        </p>

        {log.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
            <p className="text-sm text-slate-500">No telemetry events yet.</p>
          </div>
        ) : (
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {log.map((entry) => (
                  <tr key={entry.id} className="group">
                    <td colSpan={4} className="p-0">
                      <button
                        type="button"
                        onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                        className="w-full text-left hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center px-4 py-2.5">
                          <span className="flex-1 text-xs text-slate-400">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                          <span className="flex-1 text-xs text-slate-300">
                            {entry.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="w-16 text-xs text-slate-400">
                            Tier {entry.tier}
                          </span>
                          <span className={`w-16 text-xs font-medium ${
                            entry.status === 'sent' ? 'text-brand-400'
                              : entry.status === 'failed' ? 'text-red-400'
                              : 'text-amber-400'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                      </button>
                      {expandedEntry === entry.id && (
                        <div className="px-4 pb-3 space-y-2">
                          <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                              {JSON.stringify(entry.payload, null, 2)}
                            </pre>
                          </div>
                          {entry.error_message && (
                            <p className="text-xs text-red-400">
                              Error: {entry.error_message}
                            </p>
                          )}
                          {entry.response_code && (
                            <p className="text-xs text-slate-500">
                              HTTP {entry.response_code}
                              {entry.sent_at && ` at ${new Date(entry.sent_at).toLocaleString()}`}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Privacy Note */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-200">Privacy Commitment</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          <li>No personal information is ever collected (no emails, names, IPs, or org names)</li>
          <li>Instance ID is randomly generated, not derived from any identifiable data</li>
          <li>Counts are sent as ranges (e.g. "6-20 users") to prevent re-identification</li>
          <li>All payloads are logged here before sending — nothing hidden</li>
          <li>Telemetry tier can be changed at any time — downgrading takes effect immediately</li>
          <li>Master kill-switch above suppresses every send including the install ping</li>
        </ul>
      </div>

      {/* Payload viewer modal — shows the literal next-send JSON with the
          license key redacted. Operator audits the install; sees exactly
          what the control plane would receive if a send fired now. */}
      {payloadModalOpen && previewPayload && (
        <div
          className="fixed inset-0 bg-slate-950/80 flex items-start justify-center z-50 p-4 pt-16"
          onClick={() => setPayloadModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Next-send payload (preview)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  What the install ping would post if it fired right now. License
                  key redacted to the first 8 characters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayloadModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <pre className="bg-slate-950 rounded-lg p-4 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(previewPayload, null, 2)}
            </pre>
            <p className="text-xs text-slate-500">
              See <code className="text-slate-400">apps/aegis/lib/telemetry.ts</code>{' '}
              for the full payload builders (Tier 0/1/2).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
