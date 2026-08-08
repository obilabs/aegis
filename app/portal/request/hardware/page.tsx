'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  TvIcon,
  ServerIcon,
  PrinterIcon,
  CpuChipIcon,
  CheckIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ClockIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface AssetTier {
  id: string
  name: string
  description: string
  category: 'laptop' | 'desktop' | 'mobile' | 'monitor' | 'accessory'
  tierLevel: 'standard' | 'professional' | 'executive'
  specs?: {
    processor?: string
    memory?: string
    storage?: string
    display?: string
    other?: string[]
  }
  showSpecs: boolean
  availableCount: number
  showCount: boolean
  estimatedDelivery: string
  requiresApproval: boolean
  approvalLevel?: string
  eligibleRoles: string[]
  isEligible: boolean
  ineligibleReason?: string
  imageUrl?: string
}

interface RequestCategory {
  id: string
  name: string
  description: string
  icon: React.ElementType
  tiers: AssetTier[]
}

const mockCategories: RequestCategory[] = [
  {
    id: 'laptop',
    name: 'Laptops',
    description: 'Portable computers for work anywhere',
    icon: ComputerDesktopIcon,
    tiers: [
      {
        id: 'laptop-standard',
        name: 'Standard Laptop',
        description: 'For general office work, email, documents, and web browsing',
        category: 'laptop',
        tierLevel: 'standard',
        specs: {
          processor: 'Intel Core i5 or equivalent',
          memory: '16GB RAM',
          storage: '256GB SSD',
          display: '14" FHD',
        },
        showSpecs: true,
        availableCount: 15,
        showCount: true,
        estimatedDelivery: '3-5 business days',
        requiresApproval: false,
        eligibleRoles: ['All employees'],
        isEligible: true,
      },
      {
        id: 'laptop-professional',
        name: 'Professional Laptop',
        description: 'For developers, designers, and power users',
        category: 'laptop',
        tierLevel: 'professional',
        specs: {
          processor: 'Intel Core i7 or Apple M3',
          memory: '32GB RAM',
          storage: '512GB SSD',
          display: '15" QHD+',
          other: ['Dedicated GPU available'],
        },
        showSpecs: true,
        availableCount: 8,
        showCount: true,
        estimatedDelivery: '5-7 business days',
        requiresApproval: true,
        approvalLevel: 'Manager',
        eligibleRoles: ['Engineering', 'Design', 'Data Science'],
        isEligible: true,
      },
      {
        id: 'laptop-executive',
        name: 'Executive Laptop',
        description: 'Premium devices for leadership',
        category: 'laptop',
        tierLevel: 'executive',
        specs: {
          processor: 'Intel Core i9 or Apple M3 Pro/Max',
          memory: '64GB RAM',
          storage: '1TB SSD',
          display: '16" 4K',
        },
        showSpecs: false,
        availableCount: 3,
        showCount: false,
        estimatedDelivery: '7-10 business days',
        requiresApproval: true,
        approvalLevel: 'Director',
        eligibleRoles: ['Director', 'VP', 'C-Level'],
        isEligible: false,
        ineligibleReason: 'This tier requires Director level or above',
      },
    ],
  },
  {
    id: 'mobile',
    name: 'Mobile Devices',
    description: 'Smartphones and tablets for mobile productivity',
    icon: DevicePhoneMobileIcon,
    tiers: [
      {
        id: 'mobile-standard',
        name: 'Standard Phone',
        description: 'For business calls, email, and basic apps',
        category: 'mobile',
        tierLevel: 'standard',
        specs: {
          display: '6.1" OLED',
          storage: '128GB',
        },
        showSpecs: true,
        availableCount: 20,
        showCount: true,
        estimatedDelivery: '2-3 business days',
        requiresApproval: true,
        approvalLevel: 'Manager',
        eligibleRoles: ['Field roles', 'Sales', 'Support'],
        isEligible: true,
      },
      {
        id: 'mobile-professional',
        name: 'Professional Phone',
        description: 'Latest flagship devices for mobile-first roles',
        category: 'mobile',
        tierLevel: 'professional',
        specs: {
          display: '6.7" ProMotion OLED',
          storage: '256GB',
          other: ['5G enabled', 'Enhanced camera'],
        },
        showSpecs: true,
        availableCount: 10,
        showCount: true,
        estimatedDelivery: '3-5 business days',
        requiresApproval: true,
        approvalLevel: 'Director',
        eligibleRoles: ['Executive', 'Sales Leadership'],
        isEligible: false,
        ineligibleReason: 'Requires Sales Leadership or Executive role',
      },
    ],
  },
  {
    id: 'monitor',
    name: 'Monitors',
    description: 'External displays for enhanced productivity',
    icon: TvIcon,
    tiers: [
      {
        id: 'monitor-standard',
        name: 'Standard Monitor',
        description: 'Single 24" display for general use',
        category: 'monitor',
        tierLevel: 'standard',
        specs: {
          display: '24" FHD IPS',
          other: ['HDMI + DisplayPort'],
        },
        showSpecs: true,
        availableCount: 30,
        showCount: true,
        estimatedDelivery: '2-3 business days',
        requiresApproval: false,
        eligibleRoles: ['All employees'],
        isEligible: true,
      },
      {
        id: 'monitor-professional',
        name: 'Professional Monitor',
        description: 'Large 27" display or dual monitor setup',
        category: 'monitor',
        tierLevel: 'professional',
        specs: {
          display: '27" QHD IPS',
          other: ['USB-C hub', 'Color calibrated'],
        },
        showSpecs: true,
        availableCount: 12,
        showCount: true,
        estimatedDelivery: '3-5 business days',
        requiresApproval: true,
        approvalLevel: 'Manager',
        eligibleRoles: ['Engineering', 'Design', 'Finance'],
        isEligible: true,
      },
      {
        id: 'monitor-ultrawide',
        name: 'Ultrawide Monitor',
        description: '34" curved ultrawide for maximum productivity',
        category: 'monitor',
        tierLevel: 'executive',
        specs: {
          display: '34" UWQHD Curved',
          other: ['USB-C 90W PD', 'KVM switch'],
        },
        showSpecs: true,
        availableCount: 5,
        showCount: false,
        estimatedDelivery: '5-7 business days',
        requiresApproval: true,
        approvalLevel: 'Director',
        eligibleRoles: ['Engineering Lead', 'Design Lead'],
        isEligible: false,
        ineligibleReason: 'Requires team lead role or above',
      },
    ],
  },
]

function getTierColor(level: string) {
  switch (level) {
    case 'standard': return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    case 'professional': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'executive': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  }
}

function getTierStars(level: string) {
  switch (level) {
    case 'standard': return 1
    case 'professional': return 2
    case 'executive': return 3
    default: return 1
  }
}

export default function HardwareRequestPage() {
  const [categories, setCategories] = useState<RequestCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<AssetTier | null>(null)
  const [step, setStep] = useState<'category' | 'tier' | 'details' | 'confirm'>('category')
  const [justification, setJustification] = useState('')

  useEffect(() => {
    setTimeout(() => {
      setCategories(mockCategories)
      setLoading(false)
    }, 500)
  }, [])

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setStep('tier')
  }

  const handleTierSelect = (tier: AssetTier) => {
    if (!tier.isEligible) return
    setSelectedTier(tier)
    setStep('details')
  }

  const handleBack = () => {
    if (step === 'tier') {
      setSelectedCategory(null)
      setStep('category')
    } else if (step === 'details') {
      setSelectedTier(null)
      setStep('tier')
    } else if (step === 'confirm') {
      setStep('details')
    }
  }

  const currentCategory = categories.find(c => c.id === selectedCategory)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Request Hardware</h1>
        <p className="text-slate-400 mt-1">Select the equipment you need for your role</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['category', 'tier', 'details', 'confirm'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              step === s 
                ? 'bg-brand-500/20 text-brand-400' 
                : i < ['category', 'tier', 'details', 'confirm'].indexOf(step)
                  ? 'bg-brand-500/10 text-brand-400/60'
                  : 'bg-slate-800 text-slate-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i < ['category', 'tier', 'details', 'confirm'].indexOf(step)
                  ? 'bg-brand-500 text-white'
                  : step === s
                    ? 'bg-brand-500/30 text-brand-400'
                    : 'bg-slate-700 text-slate-500'
              }`}>
                {i < ['category', 'tier', 'details', 'confirm'].indexOf(step) ? (
                  <CheckIcon className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="capitalize">{s}</span>
            </div>
            {i < 3 && (
              <ChevronRightIcon className="h-4 w-4 text-slate-600 mx-2" />
            )}
          </div>
        ))}
      </div>

      {/* Step: Category Selection */}
      {step === 'category' && (
        <div className="grid grid-cols-3 gap-4">
          {categories.map((category) => {
            const Icon = category.icon
            const eligibleTiers = category.tiers.filter(t => t.isEligible).length
            
            return (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className="p-6 bg-slate-800 rounded-lg border border-slate-700 hover:border-brand-500/50 hover:bg-slate-800/80 transition-all text-left group"
              >
                <div className="p-3 bg-slate-900 rounded-lg w-fit mb-4 group-hover:bg-brand-500/10 transition-colors">
                  <Icon className="h-8 w-8 text-slate-400 group-hover:text-brand-400 transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-1">{category.name}</h3>
                <p className="text-sm text-slate-500 mb-3">{category.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {eligibleTiers} tier{eligibleTiers !== 1 ? 's' : ''} available
                  </span>
                  <ChevronRightIcon className="h-4 w-4 text-slate-500 group-hover:text-brand-400 transition-colors" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Step: Tier Selection */}
      {step === 'tier' && currentCategory && (
        <div className="space-y-4">
          <button
            onClick={handleBack}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            ← Back to categories
          </button>

          <div className="flex items-center gap-3 mb-6">
            <currentCategory.icon className="h-8 w-8 text-brand-400" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">{currentCategory.name}</h2>
              <p className="text-slate-400">Select your tier</p>
            </div>
          </div>

          <div className="space-y-4">
            {currentCategory.tiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => handleTierSelect(tier)}
                disabled={!tier.isEligible}
                className={`w-full p-6 rounded-lg border text-left transition-all ${
                  tier.isEligible
                    ? 'bg-slate-800 border-slate-700 hover:border-brand-500/50 hover:bg-slate-800/80'
                    : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-100">{tier.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${getTierColor(tier.tierLevel)}`}>
                        {tier.tierLevel}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(3)].map((_, i) => (
                          i < getTierStars(tier.tierLevel) ? (
                            <StarIconSolid key={i} className="h-3 w-3 text-yellow-400" />
                          ) : (
                            <StarIcon key={i} className="h-3 w-3 text-slate-600" />
                          )
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">{tier.description}</p>

                    {/* Specs */}
                    {tier.showSpecs && tier.specs && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {tier.specs.processor && (
                          <div className="text-xs">
                            <span className="text-slate-500">CPU:</span>{' '}
                            <span className="text-slate-300">{tier.specs.processor}</span>
                          </div>
                        )}
                        {tier.specs.memory && (
                          <div className="text-xs">
                            <span className="text-slate-500">RAM:</span>{' '}
                            <span className="text-slate-300">{tier.specs.memory}</span>
                          </div>
                        )}
                        {tier.specs.storage && (
                          <div className="text-xs">
                            <span className="text-slate-500">Storage:</span>{' '}
                            <span className="text-slate-300">{tier.specs.storage}</span>
                          </div>
                        )}
                        {tier.specs.display && (
                          <div className="text-xs">
                            <span className="text-slate-500">Display:</span>{' '}
                            <span className="text-slate-300">{tier.specs.display}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-xs">
                      {tier.showCount && (
                        <span className={`flex items-center gap-1 ${
                          tier.availableCount > 5 ? 'text-brand-400' : 'text-yellow-400'
                        }`}>
                          <CheckIcon className="h-3 w-3" />
                          {tier.availableCount} in stock
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-400">
                        <ClockIcon className="h-3 w-3" />
                        {tier.estimatedDelivery}
                      </span>
                      {tier.requiresApproval && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <ShieldCheckIcon className="h-3 w-3" />
                          {tier.approvalLevel} approval
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Eligibility */}
                  <div className="ml-4">
                    {tier.isEligible ? (
                      <div className="p-2 bg-brand-500/10 rounded-lg">
                        <CheckIcon className="h-5 w-5 text-brand-400" />
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="p-2 bg-slate-800 rounded-lg mb-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-slate-500" />
                        </div>
                        <p className="text-xs text-slate-500 max-w-[150px]">
                          {tier.ineligibleReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && selectedTier && (
        <div className="space-y-6">
          <button
            onClick={handleBack}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            ← Back to tiers
          </button>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${getTierColor(selectedTier.tierLevel).replace('text-', 'bg-').replace('-400', '-500/10')}`}>
                <ComputerDesktopIcon className="h-6 w-6 text-brand-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">{selectedTier.name}</h3>
                <p className="text-sm text-slate-400">{selectedTier.description}</p>
              </div>
            </div>

            {/* Justification */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Business Justification
                {selectedTier.requiresApproval && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why you need this equipment..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                {selectedTier.requiresApproval 
                  ? 'Required for approval - explain how this will help you do your job better'
                  : 'Optional but helps IT understand your needs'
                }
              </p>
            </div>

            {/* Delivery Location */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Delivery Location
              </label>
              <select className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option>San Francisco Office - Desk 42</option>
                <option>New York Office - Floor 3</option>
                <option>Remote - Ship to Home Address</option>
              </select>
            </div>

            {/* Approval Info */}
            {selectedTier.requiresApproval && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-400">Approval Required</p>
                    <p className="text-slate-400 mt-1">
                      This request will be sent to your {selectedTier.approvalLevel} for approval.
                      You'll be notified once a decision is made.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  Estimated delivery: {selectedTier.estimatedDelivery}
                </span>
              </div>
              <button
                onClick={() => setStep('confirm')}
                disabled={selectedTier.requiresApproval && !justification}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                  selectedTier.requiresApproval && !justification
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-brand-600 text-white hover:bg-brand-500'
                }`}
              >
                Review Request
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && selectedTier && (
        <div className="space-y-6">
          <button
            onClick={handleBack}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            ← Back to details
          </button>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Review Your Request</h2>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">Equipment</span>
                <span className="text-slate-200 font-medium">{selectedTier.name}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">Tier</span>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${getTierColor(selectedTier.tierLevel)}`}>
                  {selectedTier.tierLevel}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">Delivery</span>
                <span className="text-slate-200">San Francisco Office - Desk 42</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">Estimated Time</span>
                <span className="text-slate-200">{selectedTier.estimatedDelivery}</span>
              </div>
              {selectedTier.requiresApproval && (
                <div className="flex items-center justify-between py-3 border-b border-slate-700">
                  <span className="text-slate-400">Approval</span>
                  <span className="text-yellow-400">{selectedTier.approvalLevel} approval required</span>
                </div>
              )}
              {justification && (
                <div className="py-3">
                  <span className="text-slate-400 block mb-2">Justification</span>
                  <p className="text-slate-200 text-sm bg-slate-900 rounded-lg p-3">{justification}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  // Submit request
                  alert('Request submitted!')
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                <CheckIcon className="h-5 w-5" />
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <p className="font-medium text-slate-200">About Hardware Tiers</p>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li><strong>Standard</strong> - Available to all employees, no approval needed</li>
              <li><strong>Professional</strong> - For specialized roles, requires manager approval</li>
              <li><strong>Executive</strong> - Premium equipment for leadership, requires director approval</li>
            </ul>
            <p className="mt-2">
              Your eligible tiers are based on your role and department. Contact IT if you believe you need equipment outside your tier.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
