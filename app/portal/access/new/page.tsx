'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  CubeIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  UserIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'

interface Service {
  id: string
  name: string
  category: string
  description: string
  requiresApproval: boolean
  approvalType?: string
  availableLevels: string[]
}

interface AssetTier {
  id: string
  name: string
  category: string
  description: string
  availableCount: number
  requiresApproval: boolean
}

const mockServices: Service[] = [
  { id: 's1', name: 'Slack', category: 'Communication', description: 'Team messaging and collaboration', requiresApproval: false, availableLevels: ['Member', 'Admin'] },
  { id: 's2', name: 'GitHub Enterprise', category: 'Development', description: 'Source code management', requiresApproval: true, approvalType: 'Manager', availableLevels: ['Developer', 'Maintainer', 'Admin'] },
  { id: 's3', name: 'Salesforce', category: 'CRM', description: 'Customer relationship management', requiresApproval: true, approvalType: 'Department Head', availableLevels: ['Standard User', 'Power User', 'Admin'] },
  { id: 's4', name: 'Jira', category: 'Project Management', description: 'Issue and project tracking', requiresApproval: false, availableLevels: ['User', 'Project Admin'] },
  { id: 's5', name: 'AWS Console', category: 'Infrastructure', description: 'Cloud infrastructure management', requiresApproval: true, approvalType: 'IT Director', availableLevels: ['Read Only', 'Developer', 'Admin'] },
  { id: 's6', name: 'Power BI', category: 'Analytics', description: 'Business intelligence and reporting', requiresApproval: true, approvalType: 'Manager', availableLevels: ['Viewer', 'Contributor', 'Admin'] },
]

const mockAssetTiers: AssetTier[] = [
  { id: 'a1', name: 'Standard Laptop', category: 'Laptop', description: 'Dell Latitude or equivalent for general business use', availableCount: 12, requiresApproval: false },
  { id: 'a2', name: 'Developer Laptop', category: 'Laptop', description: 'MacBook Pro or Dell XPS for development work', availableCount: 5, requiresApproval: true },
  { id: 'a3', name: 'Executive Laptop', category: 'Laptop', description: 'Premium laptop for executives', availableCount: 2, requiresApproval: true },
  { id: 'a4', name: 'Standard Monitor', category: 'Monitor', description: '24" Full HD monitor', availableCount: 20, requiresApproval: false },
  { id: 'a5', name: 'Developer Monitor', category: 'Monitor', description: '27" 4K monitor for development', availableCount: 8, requiresApproval: false },
]

type RequestType = 'service' | 'asset'

export default function NewAccessRequestPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [requestType, setRequestType] = useState<RequestType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<Service | AssetTier | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string>('')
  const [justification, setJustification] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [submitting, setSubmitting] = useState(false)

  // Filter items based on search
  const filteredServices = mockServices.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const filteredAssets = mockAssetTiers.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = async () => {
    setSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push('/portal/access')
  }

  const canProceedToStep2 = requestType !== null
  const canProceedToStep3 = selectedItem !== null && (requestType === 'asset' || selectedLevel !== '')
  const canSubmit = justification.trim().length >= 10

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">New Access Request</h1>
          <p className="text-slate-400 mt-1">Request access to services or assets</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors ${
              step >= s 
                ? 'bg-brand-500 text-white' 
                : 'bg-slate-700 text-slate-400'
            }`}>
              {step > s ? <CheckIcon className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`w-16 h-1 mx-2 rounded ${
                step > s ? 'bg-brand-500' : 'bg-slate-700'
              }`} />
            )}
          </div>
        ))}
        <span className="ml-4 text-sm text-slate-400">
          {step === 1 && 'Select type'}
          {step === 2 && 'Choose item'}
          {step === 3 && 'Provide details'}
        </span>
      </div>

      {/* Step 1: Select Type */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">What do you need access to?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setRequestType('service')}
              className={`p-6 rounded-lg border-2 text-left transition-all ${
                requestType === 'service'
                  ? 'bg-blue-500/20 border-blue-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  requestType === 'service' ? 'bg-blue-500/30' : 'bg-slate-700'
                }`}>
                  <CubeIcon className={`h-8 w-8 ${
                    requestType === 'service' ? 'text-blue-400' : 'text-slate-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">Service / Application</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Request access to software, apps, or cloud services
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setRequestType('asset')}
              className={`p-6 rounded-lg border-2 text-left transition-all ${
                requestType === 'asset'
                  ? 'bg-purple-500/20 border-purple-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  requestType === 'asset' ? 'bg-purple-500/30' : 'bg-slate-700'
                }`}>
                  <ComputerDesktopIcon className={`h-8 w-8 ${
                    requestType === 'asset' ? 'text-purple-400' : 'text-slate-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">Hardware / Asset</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Request laptops, monitors, or other equipment
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Item */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              {requestType === 'service' ? 'Select a service' : 'Select an asset type'}
            </h2>
            <button
              onClick={() => { setStep(1); setSelectedItem(null); setSelectedLevel(''); }}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              ← Back
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${requestType === 'service' ? 'services' : 'assets'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Items List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {requestType === 'service' ? (
              filteredServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => { setSelectedItem(service); setSelectedLevel(service.availableLevels[0]); }}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedItem?.id === service.id
                      ? 'bg-brand-500/20 border-brand-500'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-100">{service.name}</h3>
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                          {service.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{service.description}</p>
                    </div>
                    {service.requiresApproval && (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                        <ShieldCheckIcon className="h-3 w-3" />
                        Requires approval
                      </span>
                    )}
                  </div>
                  
                  {/* Access Level Selection */}
                  {selectedItem?.id === service.id && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-sm text-slate-400 mb-2">Select access level:</p>
                      <div className="flex flex-wrap gap-2">
                        {service.availableLevels.map((level) => (
                          <button
                            key={level}
                            onClick={(e) => { e.stopPropagation(); setSelectedLevel(level); }}
                            className={`px-3 py-1.5 text-sm rounded transition-colors ${
                              selectedLevel === level
                                ? 'bg-brand-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              ))
            ) : (
              filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedItem(asset)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedItem?.id === asset.id
                      ? 'bg-brand-500/20 border-brand-500'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-100">{asset.name}</h3>
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                          {asset.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{asset.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {asset.availableCount} available
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {asset.requiresApproval && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                          <ShieldCheckIcon className="h-3 w-3" />
                          Requires approval
                        </span>
                      )}
                      {asset.availableCount === 0 && (
                        <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                          Out of stock
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => { setStep(1); setSelectedItem(null); setSelectedLevel(''); }}
              className="px-6 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && selectedItem && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Request Details</h2>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              ← Back
            </button>
          </div>

          {/* Selected Item Summary */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                requestType === 'service' ? 'bg-blue-500/20' : 'bg-purple-500/20'
              }`}>
                {requestType === 'service' ? (
                  <CubeIcon className="h-5 w-5 text-blue-400" />
                ) : (
                  <ComputerDesktopIcon className="h-5 w-5 text-purple-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-100">{selectedItem.name}</p>
                {selectedLevel && (
                  <p className="text-sm text-slate-400">Access level: {selectedLevel}</p>
                )}
              </div>
            </div>
          </div>

          {/* Approval Warning */}
          {(selectedItem as Service | AssetTier).requiresApproval && (
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-400">Approval Required</p>
                <p className="text-sm text-slate-400 mt-1">
                  This request requires approval from your manager before it can be provisioned.
                </p>
              </div>
            </div>
          )}

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Justification <span className="text-red-400">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why you need this access..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {justification.length < 10 
                ? `Minimum 10 characters (${10 - justification.length} more needed)`
                : `${justification.length} characters`
              }
            </p>
          </div>

          {/* Needed By */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Needed By (optional)
            </label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                    priority === p
                      ? p === 'low' ? 'bg-slate-600 text-white' :
                        p === 'normal' ? 'bg-blue-500 text-white' :
                        p === 'high' ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <InformationCircleIcon className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-400">
              <p>Your request will be submitted for review. You'll receive a notification when it's approved or if more information is needed.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
