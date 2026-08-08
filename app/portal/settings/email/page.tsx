'use client'

/**
 * Settings → Email
 *
 * Card-based provider picker + dynamic per-provider form + test-send.
 * Spec: openspec/changes/email-first-class/design.md (D5)
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Types — kept in sync with @obilabs/email + /api/settings/email response
// ---------------------------------------------------------------------------

type ProviderId =
  | 'gmail-relay'
  | 'gmail-smtp'
  | 'resend'
  | 'ses'
  | 'sendgrid'
  | 'smtp'

interface EmailSettingsResponse {
  provider: ProviderId
  configured: boolean
  configFields?: Record<string, 'set' | 'unset'>
  from_address: string
  from_name: string | null
  reply_to: string | null
  last_test_at: string | null
  last_test_status: 'success' | 'failed' | null
  last_test_error_message: string | null
  last_send_at: string | null
  last_send_status: 'success' | 'failed' | null
  last_send_error_message: string | null
}

interface ProviderMeta {
  id: ProviderId
  label: string
  description: string
  recommended?: boolean
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'gmail-relay', label: 'Gmail Relay', description: 'Google Workspace SMTP relay. Uses your own domain.', recommended: true },
  { id: 'gmail-smtp', label: 'Gmail SMTP', description: 'Standard Gmail with app password.' },
  { id: 'resend', label: 'Resend', description: 'Modern transactional email. Free tier covers small installs.' },
  { id: 'ses', label: 'Amazon SES', description: 'AWS Simple Email Service. Cheapest at scale.' },
  { id: 'sendgrid', label: 'SendGrid', description: 'Twilio SendGrid. Enterprise deliverability.' },
  { id: 'smtp', label: 'Custom SMTP', description: 'Connect to any SMTP server.' },
]

// ---------------------------------------------------------------------------
// Per-provider config shapes the UI collects (mirrors the Zod schemas in
// @obilabs/email but typed for form state, not transport).
// ---------------------------------------------------------------------------

interface GmailRelayConfig {
  mode: 'username-password' | 'ip-whitelist'
  username?: string
  appPassword?: string
}
interface GmailSmtpConfig { username: string; appPassword: string }
interface ResendConfig { apiKey: string; domain: string }
interface SesConfig { accessKeyId: string; secretAccessKey: string; region: string }
interface SendgridConfig { apiKey: string }
interface SmtpConfig { host: string; port: number; secure: boolean; username?: string; password?: string }

type ProviderConfig =
  | GmailRelayConfig
  | GmailSmtpConfig
  | ResendConfig
  | SesConfig
  | SendgridConfig
  | SmtpConfig

const EMPTY_CONFIG: Record<ProviderId, ProviderConfig> = {
  'gmail-relay': { mode: 'username-password', username: '', appPassword: '' },
  'gmail-smtp': { username: '', appPassword: '' },
  'resend': { apiKey: '', domain: '' },
  'ses': { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' },
  'sendgrid': { apiKey: '' },
  'smtp': { host: '', port: 587, secure: false, username: '', password: '' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Form state — initialized from settings on load
  const [activeProvider, setActiveProvider] = useState<ProviderId>('gmail-relay')
  const [config, setConfig] = useState<ProviderConfig>(EMPTY_CONFIG['gmail-relay'])
  const [fromAddress, setFromAddress] = useState('')
  const [fromName, setFromName] = useState('')
  const [replyTo, setReplyTo] = useState('')

  useEffect(() => {
    void fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/email')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: EmailSettingsResponse = await res.json()
      setSettings(data)
      setActiveProvider(data.provider)
      setConfig(EMPTY_CONFIG[data.provider])
      setFromAddress(data.from_address)
      setFromName(data.from_name ?? '')
      setReplyTo(data.reply_to ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load email settings')
    } finally {
      setLoading(false)
    }
  }

  function switchProvider(id: ProviderId) {
    setActiveProvider(id)
    setConfig(EMPTY_CONFIG[id])
    setTestResult(null)
    setSaveSuccess(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          config,
          from_address: fromAddress,
          from_name: fromName || null,
          reply_to: replyTo || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setSaveSuccess(true)
      await fetchSettings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/email/test', { method: 'POST' })
      const body = await res.json()
      if (res.status === 429) {
        setTestResult({
          success: false,
          message: `Rate limited. Try again in ${body.retry_after_seconds}s.`,
        })
      } else if (body.success) {
        setTestResult({ success: true, message: 'Test email sent. Check your inbox.' })
      } else {
        setTestResult({
          success: false,
          message: body.error?.message ?? body.error ?? 'Test send failed.',
        })
      }
      await fetchSettings()
    } catch (e) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : 'Test send failed',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse text-slate-400">Loading email settings…</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div>
        <Link href="/portal/settings" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-2">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <EnvelopeIcon className="w-6 h-6 text-brand-400" /> Email
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure how Aegis sends notifications, password resets, and verification emails.
        </p>
      </div>

      {/* Status indicator */}
      <StatusCard settings={settings} onTest={handleTest} testing={testing} />

      {testResult && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            testResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : (
            <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
          )}
          <div className="text-sm">{testResult.message}</div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider picker */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-100 mb-1">Provider</h2>
          <p className="text-sm text-slate-400 mb-4">Choose where Aegis sends mail through.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchProvider(p.id)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  activeProvider === p.id
                    ? 'bg-brand-500/10 border-brand-500/40'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-100">{p.label}</span>
                  {p.recommended && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Per-provider config */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-100 mb-4">
            Configure {PROVIDERS.find(p => p.id === activeProvider)?.label}
          </h2>
          <ProviderForm provider={activeProvider} value={config} onChange={setConfig} />
        </div>

        {/* Sender identity */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-100">Sender identity</h2>
          <Field
            label="From address"
            required
            type="email"
            value={fromAddress}
            onChange={setFromAddress}
            placeholder="no-reply@yourdomain.com"
            hint="The visible 'From' address on outbound emails. Must be authorized by your sending domain."
          />
          <Field
            label="From name"
            value={fromName}
            onChange={setFromName}
            placeholder="Acme IT"
            hint="Optional display name shown next to the from address."
          />
          <Field
            label="Reply-To"
            type="email"
            value={replyTo}
            onChange={setReplyTo}
            placeholder="support@yourdomain.com"
            hint="Optional. Where replies go if different from the from address."
          />
        </div>

        {error && (
          <div className="rounded-lg border bg-red-500/10 border-red-500/30 text-red-300 p-4 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 p-4 flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">Saved. Try a test send to verify.</div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => void fetchSettings()}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !fromAddress}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function StatusCard({
  settings,
  onTest,
  testing,
}: {
  settings: EmailSettingsResponse | null
  onTest: () => void
  testing: boolean
}) {
  if (!settings) return null
  const configured = settings.configured
  const lastStatus = settings.last_send_status ?? settings.last_test_status
  const dotColor =
    !configured ? 'bg-slate-500'
    : lastStatus === 'failed' ? 'bg-red-500'
    : lastStatus === 'success' ? 'bg-emerald-500'
    : 'bg-amber-500'

  const lastEvent = settings.last_send_at ?? settings.last_test_at
  const lastError = settings.last_send_error_message ?? settings.last_test_error_message

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm font-semibold text-slate-100">
            {!configured
              ? 'Email not yet configured'
              : `Email configured (${settings.provider})`}
          </span>
        </div>
        <div className="text-xs text-slate-400">
          {lastEvent
            ? `Last activity ${formatRelative(lastEvent)}${lastStatus ? ` · ${lastStatus}` : ''}`
            : 'No sends yet.'}
        </div>
        {lastError && lastStatus === 'failed' && (
          <div className="text-xs text-red-400 mt-1 truncate" title={lastError}>
            {lastError}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onTest}
        disabled={testing || !configured}
        className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-md font-medium border border-slate-700 inline-flex items-center gap-1.5"
      >
        {testing ? (
          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <PaperAirplaneIcon className="w-3.5 h-3.5" />
        )}
        {testing ? 'Sending…' : 'Test send'}
      </button>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ---------------------------------------------------------------------------
// Per-provider form renderer — switches on provider id
// ---------------------------------------------------------------------------

function ProviderForm({
  provider,
  value,
  onChange,
}: {
  provider: ProviderId
  value: ProviderConfig
  onChange: (cfg: ProviderConfig) => void
}) {
  if (provider === 'gmail-relay') {
    const v = value as GmailRelayConfig
    return (
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Auth mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ mode: 'username-password', username: '', appPassword: '' })}
              className={`p-3 rounded-lg border text-left text-sm ${
                v.mode === 'username-password'
                  ? 'bg-brand-500/10 border-brand-500/40 text-slate-100'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="font-medium">Username + app password</div>
              <div className="text-xs text-slate-400 mt-0.5">Portable across container restarts.</div>
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: 'ip-whitelist' })}
              className={`p-3 rounded-lg border text-left text-sm ${
                v.mode === 'ip-whitelist'
                  ? 'bg-brand-500/10 border-brand-500/40 text-slate-100'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="font-medium">IP whitelist</div>
              <div className="text-xs text-slate-400 mt-0.5">No credentials; allowlist this install's IP.</div>
            </button>
          </div>
        </div>
        {v.mode === 'username-password' && (
          <>
            <Field
              label="Username (Workspace email)"
              required
              type="email"
              value={v.username ?? ''}
              onChange={s => onChange({ ...v, username: s })}
              placeholder="sender@yourdomain.com"
            />
            <Field
              label="App password"
              required
              type="password"
              value={v.appPassword ?? ''}
              onChange={s => onChange({ ...v, appPassword: s })}
              hint="16-character app password from your Google Account → Security → App passwords."
            />
          </>
        )}
        {v.mode === 'ip-whitelist' && <EgressIpPanel />}
      </div>
    )
  }

  if (provider === 'gmail-smtp') {
    const v = value as GmailSmtpConfig
    return (
      <div className="space-y-4">
        <Field label="Username" required type="email" value={v.username} onChange={s => onChange({ ...v, username: s })} placeholder="you@gmail.com" />
        <Field label="App password" required type="password" value={v.appPassword} onChange={s => onChange({ ...v, appPassword: s })} hint="16-char app password from your Google Account security page." />
      </div>
    )
  }

  if (provider === 'resend') {
    const v = value as ResendConfig
    return (
      <div className="space-y-4">
        <Field label="API key" required type="password" value={v.apiKey} onChange={s => onChange({ ...v, apiKey: s })} placeholder="re_..." />
        <Field label="Sending domain" required value={v.domain} onChange={s => onChange({ ...v, domain: s })} placeholder="yourdomain.com" hint="Must be verified in your Resend dashboard." />
      </div>
    )
  }

  if (provider === 'ses') {
    const v = value as SesConfig
    return (
      <div className="space-y-4">
        <Field label="Access key ID" required value={v.accessKeyId} onChange={s => onChange({ ...v, accessKeyId: s })} />
        <Field label="Secret access key" required type="password" value={v.secretAccessKey} onChange={s => onChange({ ...v, secretAccessKey: s })} />
        <Field label="Region" required value={v.region} onChange={s => onChange({ ...v, region: s })} placeholder="us-east-1" />
      </div>
    )
  }

  if (provider === 'sendgrid') {
    const v = value as SendgridConfig
    return (
      <Field label="API key" required type="password" value={v.apiKey} onChange={s => onChange({ ...v, apiKey: s })} placeholder="SG..." />
    )
  }

  // smtp
  const v = value as SmtpConfig
  return (
    <div className="space-y-4">
      <Field label="Host" required value={v.host} onChange={s => onChange({ ...v, host: s })} placeholder="mail.yourdomain.com" />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Port"
          required
          type="number"
          value={String(v.port)}
          onChange={s => onChange({ ...v, port: parseInt(s, 10) || 587 })}
        />
        <label className="flex items-center gap-2 pt-7 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={v.secure}
            onChange={e => onChange({ ...v, secure: e.target.checked })}
            className="rounded border-slate-600 bg-slate-800"
          />
          Use TLS (port 465)
        </label>
      </div>
      <Field label="Username (optional)" value={v.username ?? ''} onChange={s => onChange({ ...v, username: s })} />
      <Field label="Password (optional)" type="password" value={v.password ?? ''} onChange={s => onChange({ ...v, password: s })} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Egress IP panel — detects + displays the install's public IP so the
// operator can paste it into Google Workspace's SMTP relay allowlist
// without first running `curl ifconfig.me` from a shell.
// ---------------------------------------------------------------------------

function EgressIpPanel() {
  const [ip, setIp] = useState<string | null>(null)
  const [detectedAt, setDetectedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const detect = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/email/egress-ip', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setIp(body.ip)
      setDetectedAt(body.detected_at)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { detect() }, [])

  const onCopy = async () => {
    if (!ip) return
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore — clipboard API can fail in some browsers/contexts
    }
  }

  return (
    <div className="text-sm text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg p-3 space-y-3">
      <div>
        Allowlist this install&apos;s egress IP in your Google Workspace admin at{' '}
        <span className="text-slate-200">Apps → Google Workspace → Gmail → Routing → SMTP relay</span>.
      </div>
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-700 rounded-lg p-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Egress IP</div>
          {loading && <div className="text-slate-300 font-mono text-base">Detecting…</div>}
          {!loading && ip && (
            <div className="text-emerald-300 font-mono text-base truncate" title={ip}>
              {ip}
            </div>
          )}
          {!loading && error && (
            <div className="text-red-300 text-xs">{error}</div>
          )}
          {detectedAt && !error && (
            <div className="text-[10px] text-slate-500 mt-1">
              Detected {new Date(detectedAt).toLocaleString()} via api.ipify.org
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-2">
          {ip && (
            <button
              type="button"
              onClick={onCopy}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-medium border border-slate-700"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          )}
          <button
            type="button"
            onClick={detect}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-md font-medium border border-slate-700"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Aegis asks <code className="text-slate-400">api.ipify.org</code> to echo back the public IP
        it sees this install from. If your container goes through a NAT, proxy, or VPN, the IP
        shown here is the one Google will also see — it&apos;s the correct value to paste.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
