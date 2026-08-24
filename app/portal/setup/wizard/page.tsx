'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth-client'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  TicketIcon,
  BookOpenIcon,
  ComputerDesktopIcon,
  KeyIcon,
  GlobeAltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
  ServerStackIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { getPresetsForProfile } from '@/lib/features'

interface SetupTemplate {
  id: string
  name: string
  description: string
  industry: string
  team_size: string
  recommended_ui_mode: string
  features_to_enable: string[]
}

const STEPS = [
  { id: 1, name: 'About You', icon: BuildingOfficeIcon },
  { id: 2, name: 'Team Size', icon: UserGroupIcon },
  { id: 3, name: 'Use Case', icon: TicketIcon },
  { id: 4, name: 'Features', icon: SparklesIcon },
  { id: 5, name: 'Finish', icon: CheckCircleIcon },
]

const INDUSTRIES = [
  { value: 'msp', label: 'MSP / Managed Services', description: 'Managing IT for multiple clients' },
  { value: 'internal_it', label: 'Internal IT Department', description: 'Supporting employees at one company' },
  { value: 'small_business', label: 'Small Business', description: 'General business, no dedicated IT' },
  { value: 'healthcare', label: 'Healthcare', description: 'Medical facilities, HIPAA compliance' },
  { value: 'finance', label: 'Finance / Legal', description: 'Banks, law firms, compliance-heavy' },
  { value: 'education', label: 'Education', description: 'Schools, universities' },
  { value: 'other', label: 'Other', description: 'Something else' },
]

const TEAM_SIZES = [
  { value: '1-5', label: '1-5 people', description: 'Small team, simple needs' },
  { value: '6-20', label: '6-20 people', description: 'Growing team' },
  { value: '21-50', label: '21-50 people', description: 'Medium organization' },
  { value: '51-200', label: '51-200 people', description: 'Large organization' },
  { value: '200+', label: '200+ people', description: 'Enterprise' },
]

const USE_CASES = [
  { value: 'helpdesk', label: 'Help Desk / Ticketing', icon: TicketIcon, description: 'Track and resolve support requests' },
  { value: 'documentation', label: 'Documentation / KB', icon: BookOpenIcon, description: 'Build a knowledge base' },
  { value: 'asset_management', label: 'Asset Management', icon: ComputerDesktopIcon, description: 'Track hardware and software' },
  { value: 'credentials', label: 'Password / Credential Vault', icon: KeyIcon, description: 'Securely store passwords' },
  { value: 'all', label: 'All of the Above', icon: ServerStackIcon, description: 'Full ITSM platform' },
]

const FEATURES = [
  { key: 'tickets_enabled', label: 'Tickets & Help Desk', description: 'Track support requests', icon: TicketIcon, default: true },
  { key: 'kb_enabled', label: 'Knowledge Base', description: 'Self-service documentation', icon: BookOpenIcon, default: true },
  { key: 'assets_enabled', label: 'Asset Management', description: 'Track hardware & software', icon: ComputerDesktopIcon, default: true },
  { key: 'credentials_enabled', label: 'Credential Vault', description: 'Secure password storage', icon: KeyIcon, default: false },
  { key: 'contacts_enabled', label: 'Contacts & Companies', description: 'People directory', icon: UserGroupIcon, default: true },
  { key: 'network_docs_enabled', label: 'Network Documentation', description: 'Diagrams, IPs, configs', icon: GlobeAltIcon, default: false },
  { key: 'sla_enabled', label: 'SLA Tracking', description: 'Response & resolution targets', icon: ChartBarIcon, default: false },
  { key: 'audit_log_enabled', label: 'Audit Logging', description: 'Compliance & security', icon: ShieldCheckIcon, default: true },
]

export default function SetupWizardPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [templates, setTemplates] = useState<SetupTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [recommendedSources, setRecommendedSources] = useState<Record<string, string[]>>({})

  // Form data
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    team_size: '',
    primary_use_case: '',
    features: {} as Record<string, boolean>,
    selected_template: null as SetupTemplate | null,
    telemetry_tier: 0 as number,
    // Master kill-switch for outbound telemetry. When true, the consent
    // gate in lib/telemetry-consent.ts suppresses every send including
    // the Tier-0 install ping that used to fire unconditionally.
    // Captured at setup time per PRINCIPLES.md #2 (consent-first).
    telemetry_disabled: false,
  })

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!sessionLoading && !session) {
      window.location.href = '/?callbackUrl=/portal/setup/wizard'
    }
  }, [session, sessionLoading])

  useEffect(() => {
    // Check setup status — if already complete, redirect to dashboard
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (!data.wizardRequired && !data.setupRequired) {
          window.location.href = '/portal/dashboard'
        }
      })
      .catch(() => {})

    fetchTemplates()
    // Initialize default features
    const defaultFeatures: Record<string, boolean> = {}
    FEATURES.forEach(f => { defaultFeatures[f.key] = f.default })
    setFormData(prev => ({ ...prev, features: defaultFeatures }))
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/setup/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      // Auto-select template based on industry
      if (currentStep === 1 && formData.industry) {
        const matchingTemplate = templates.find(t => t.industry === formData.industry)
        if (matchingTemplate) {
          setFormData(prev => ({ ...prev, selected_template: matchingTemplate }))
        }
      }
      // Apply feature presets when entering step 4 (Features)
      if (currentStep === 3) {
        const { defaults, sources } = getPresetsForProfile(
          formData.industry,
          formData.team_size,
          formData.primary_use_case,
        )
        setRecommendedSources(sources)
        // Map preset defaults to wizard feature keys
        const presetFeatures: Record<string, boolean> = { ...formData.features }
        const keyMap: Record<string, string> = {
          tickets: 'tickets_enabled',
          knowledge_base: 'kb_enabled',
          assets: 'assets_enabled',
          credentials: 'credentials_enabled',
          contacts: 'contacts_enabled',
          sla_management: 'sla_enabled',
          audit_log: 'audit_log_enabled',
        }
        for (const [featureKey, enabled] of Object.entries(defaults)) {
          const wizardKey = keyMap[featureKey]
          if (wizardKey && enabled) {
            presetFeatures[wizardKey] = true
          }
        }
        setFormData(prev => ({ ...prev, features: presetFeatures }))
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const [error, setError] = useState('')

  const handleFinish = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok || res.status === 409) {
        // Success or org already exists — hard navigate to dashboard
        window.location.href = '/portal/dashboard'
        return
      }

      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        setError('Your session has expired. Please log in again.')
        return
      }

      setError(data.error || `Setup failed (${res.status}). Please try again.`)
    } catch (err) {
      console.error('Setup failed:', err)
      setError('Network error — please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const applyTemplate = (template: SetupTemplate) => {
    const newFeatures = { ...formData.features }
    template.features_to_enable.forEach(f => { newFeatures[f] = true })
    setFormData(prev => ({
      ...prev,
      selected_template: template,
      features: newFeatures,
    }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.company_name && formData.industry
      case 2: return formData.team_size
      case 3: return formData.primary_use_case
      case 4: return true
      default: return true
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Progress Bar */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = step.id === currentStep
              const isComplete = step.id < currentStep

              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center gap-2 ${
                    isActive ? 'text-brand-400' : isComplete ? 'text-brand-600' : 'text-slate-600'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-brand-500/20 ring-2 ring-brand-500' : 
                      isComplete ? 'bg-brand-500/10' : 'bg-slate-800'
                    }`}>
                      {isComplete ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-medium">{step.name}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`w-12 sm:w-24 h-0.5 mx-2 ${
                      isComplete ? 'bg-brand-600' : 'bg-slate-800'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Step 1: About You */}
        {currentStep === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100">Welcome to Aegis</h1>
              <p className="text-slate-400 mt-2">Let's set up your workspace in a few quick steps</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  What best describes your organization?
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {INDUSTRIES.map((industry) => (
                    <button
                      key={industry.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, industry: industry.value })}
                      className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all ${
                        formData.industry === industry.value
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-200">{industry.label}</div>
                        <div className="text-sm text-slate-500">{industry.description}</div>
                      </div>
                      {formData.industry === industry.value && (
                        <CheckCircleIcon className="h-5 w-5 text-brand-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Team Size */}
        {currentStep === 2 && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100">How big is your team?</h1>
              <p className="text-slate-400 mt-2">This customizes your default feature configuration</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, team_size: size.value })}
                  className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all ${
                    formData.team_size === size.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <UserGroupIcon className={`h-6 w-6 ${
                    formData.team_size === size.value ? 'text-brand-400' : 'text-slate-500'
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium text-slate-200">{size.label}</div>
                    <div className="text-sm text-slate-500">{size.description}</div>
                  </div>
                  {formData.team_size === size.value && (
                    <CheckCircleIcon className="h-5 w-5 text-brand-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Template suggestion */}
            {formData.selected_template && (
              <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <SparklesIcon className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-brand-300">Recommended Setup</h3>
                    <p className="text-sm text-brand-300/80 mt-1">
                      Based on your selections, we recommend the <strong>{formData.selected_template.name}</strong> template.
                      We'll pre-configure categories, folders, and features for you.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Use Case */}
        {currentStep === 3 && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100">We're curious — what brings you to Aegis?</h1>
              <p className="text-slate-400 mt-2">This is just for our understanding — it won't change any settings.
                You'll choose exactly which features to enable on the next step.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {USE_CASES.map((useCase) => {
                const Icon = useCase.icon
                return (
                  <button
                    key={useCase.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, primary_use_case: useCase.value })}
                    className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all ${
                      formData.primary_use_case === useCase.value
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${
                      formData.primary_use_case === useCase.value ? 'text-brand-400' : 'text-slate-500'
                    }`} />
                    <div className="flex-1">
                      <div className="font-medium text-slate-200">{useCase.label}</div>
                      <div className="text-sm text-slate-500">{useCase.description}</div>
                    </div>
                    {formData.primary_use_case === useCase.value && (
                      <CheckCircleIcon className="h-5 w-5 text-brand-400" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4: Features */}
        {currentStep === 4 && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-100">Enable Features</h1>
              <p className="text-slate-400 mt-2">
                You can always change these later in Settings
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon
                const isEnabled = formData.features[feature.key]
                // Reverse map wizard keys to feature keys for recommendation sources
                const reverseKeyMap: Record<string, string> = {
                  tickets_enabled: 'tickets',
                  kb_enabled: 'knowledge_base',
                  assets_enabled: 'assets',
                  credentials_enabled: 'credentials',
                  contacts_enabled: 'contacts',
                  sla_enabled: 'sla_management',
                  audit_log_enabled: 'audit_log',
                }
                const featureKey = reverseKeyMap[feature.key]
                const sources = featureKey ? recommendedSources[featureKey] : undefined

                return (
                  <button
                    key={feature.key}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      features: { ...formData.features, [feature.key]: !isEnabled }
                    })}
                    className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all ${
                      isEnabled
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isEnabled ? 'text-brand-400' : 'text-slate-500'}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{feature.label}</span>
                        {sources && sources.length > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">{feature.description}</div>
                      {sources && sources.length > 0 && (
                        <div className="text-xs text-brand-500/70 mt-0.5">
                          Recommended for {sources.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors ${
                      isEnabled ? 'bg-brand-500' : 'bg-slate-700'
                    }`}>
                      <div className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${
                        isEnabled ? 'ml-5' : 'ml-1'
                      }`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 5: Finish */}
        {currentStep === 5 && (
          <div className="space-y-8 text-center">
            <div className="w-20 h-20 bg-brand-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="h-10 w-10 text-brand-400" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-100">You're all set!</h1>
              <p className="text-slate-400 mt-2">
                We'll create your workspace with the following:
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 text-left">
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Organization</dt>
                  <dd className="text-slate-200 font-medium">{formData.company_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Industry</dt>
                  <dd className="text-slate-200 font-medium">
                    {INDUSTRIES.find(i => i.value === formData.industry)?.label}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Team Size</dt>
                  <dd className="text-slate-200 font-medium">
                    {TEAM_SIZES.find(s => s.value === formData.team_size)?.label}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Primary Use</dt>
                  <dd className="text-slate-200 font-medium">
                    {USE_CASES.find(u => u.value === formData.primary_use_case)?.label}
                  </dd>
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <dt className="text-slate-400 mb-2">Enabled Features</dt>
                  <dd className="flex flex-wrap gap-2">
                    {Object.entries(formData.features)
                      .filter(([_, enabled]) => enabled)
                      .map(([key]) => {
                        const feature = FEATURES.find(f => f.key === key)
                        return feature ? (
                          <span key={key} className="px-2 py-1 bg-brand-500/10 text-brand-400 text-sm rounded">
                            {feature.label}
                          </span>
                        ) : null
                      })}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="text-sm text-slate-500">
              You can change any of these settings later in Settings.
            </p>

            {/* Telemetry & Privacy — consent-first per PRINCIPLES.md #2 */}
            <div className="bg-slate-800 rounded-lg p-6 text-left space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Telemetry &amp; Privacy</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Aegis can send anonymized usage data to help us improve the
                  platform and validate your license. You decide what gets
                  sent — including nothing at all. Change anytime in Settings &gt;
                  Telemetry &amp; Privacy, or set <code className="text-slate-300">TELEMETRY_ENABLED=false</code> in
                  your container env (env beats UI).
                </p>
              </div>

              {/* Master kill-switch — top of the section so it's the first
                  choice an operator sees. Captures the consent decision via
                  setTelemetryEnabled() server-side. */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  telemetry_disabled: !prev.telemetry_disabled,
                }))}
                className={`w-full p-3 rounded border text-left transition-all ${
                  formData.telemetry_disabled
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-200">
                      Disable all telemetry
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      (no liveness ping, no install ping, no license re-validation — nothing)
                    </span>
                  </div>
                  <div className={`w-8 h-5 rounded-full transition-colors ${
                    formData.telemetry_disabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}>
                    <div className={`w-3 h-3 mt-1 rounded-full bg-white transition-transform ${
                      formData.telemetry_disabled ? 'ml-4' : 'ml-1'
                    }`} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Your license continues to work locally. It just isn&apos;t
                  re-validated with our control plane until you re-enable.
                </p>
              </button>

              {/* Tier toggles — disabled visually when master is off */}
              <div className={formData.telemetry_disabled ? 'opacity-40 pointer-events-none' : ''}>

              {/* Tier 0 — anonymous liveness: install ping (once) + alive ping (daily) */}
              <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-300">Anonymous liveness ping</span>
                    <span className="ml-2 text-xs text-slate-500">(once at install, then daily)</span>
                  </div>
                  <span className="text-xs text-slate-500 italic">
                    {formData.telemetry_disabled ? 'Suppressed' : 'Default on'}
                  </span>
                </div>
                <code className="block mt-1 text-xs text-slate-500 font-mono">
                  {'install: { instance_id, version, license_key, installed_at }'}
                </code>
                <code className="block mt-0.5 text-xs text-slate-500 font-mono">
                  {'daily:   { instance_id, version }'}
                </code>
                <p className="mt-1 text-xs text-slate-500">
                  A random ID and the version — no usage, no PII. The daily ping is
                  how a self-hosted install stays counted as active; without it,
                  community installs drop off after 30 days. A license key, if you
                  have one, lets you claim this instance for support later.
                </p>
              </div>

              <div className="pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Usage telemetry — optional, off unless you turn it on
                </span>
              </div>

              {/* Tier 1 */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  telemetry_tier: prev.telemetry_tier >= 1
                    ? (prev.telemetry_tier >= 2 ? 1 : 0)
                    : 1,
                }))}
                className={`w-full p-3 rounded border text-left transition-all ${
                  formData.telemetry_tier >= 1
                    ? 'border-brand-500/50 bg-brand-500/5'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-300">Setup Snapshot</span>
                    <span className="ml-2 text-xs text-slate-500">(sent once after setup)</span>
                  </div>
                  <div className={`w-8 h-5 rounded-full transition-colors ${
                    formData.telemetry_tier >= 1 ? 'bg-brand-500' : 'bg-slate-700'
                  }`}>
                    <div className={`w-3 h-3 mt-1 rounded-full bg-white transition-transform ${
                      formData.telemetry_tier >= 1 ? 'ml-4' : 'ml-1'
                    }`} />
                  </div>
                </div>
                <code className="block mt-1 text-xs text-slate-500 font-mono">
                  {'{ industry, team_size, use_case, features_enabled }'}
                </code>
              </button>

              {/* Tier 2 */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  telemetry_tier: prev.telemetry_tier >= 2 ? 1 : 2,
                }))}
                className={`w-full p-3 rounded border text-left transition-all ${
                  formData.telemetry_tier >= 2
                    ? 'border-brand-500/50 bg-brand-500/5'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-300">Usage Heartbeat</span>
                    <span className="ml-2 text-xs text-slate-500">(daily, anonymous)</span>
                  </div>
                  <div className={`w-8 h-5 rounded-full transition-colors ${
                    formData.telemetry_tier >= 2 ? 'bg-brand-500' : 'bg-slate-700'
                  }`}>
                    <div className={`w-3 h-3 mt-1 rounded-full bg-white transition-transform ${
                      formData.telemetry_tier >= 2 ? 'ml-4' : 'ml-1'
                    }`} />
                  </div>
                </div>
                <code className="block mt-1 text-xs text-slate-500 font-mono">
                  {'{ user_count_range, ticket_volume_range, modules, uptime }'}
                </code>
              </button>
              </div> {/* close tier-toggles dimmer wrapper */}
            </div>

            {!sessionLoading && !session && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-left">
                <p className="text-sm text-amber-400">
                  You need to be logged in to complete setup.{' '}
                  <a href={'/?callbackUrl=/portal/setup/wizard'} className="underline font-medium">
                    Log in now
                  </a>
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-left">
                <p className="text-sm text-red-400">
                  {error}
                  {error.includes('session') && (
                    <>
                      {' '}
                      <a href={'/?callbackUrl=/portal/setup/wizard'} className="underline font-medium">
                        Log in now
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 1
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back
          </button>

          {currentStep < STEPS.length ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                canProceed()
                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Continue
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading || (!sessionLoading && !session)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                !sessionLoading && !session
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Setting up...
                </>
              ) : (
                <>
                  Launch Aegis
                  <ArrowRightIcon className="h-5 w-5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
