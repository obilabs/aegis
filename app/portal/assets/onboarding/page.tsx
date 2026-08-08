'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ComputerDesktopIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  SparklesIcon,
  TableCellsIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  ChevronRightIcon,
  TagIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

interface NamingTemplate {
  id: string
  name: string
  pattern: string
  description: string
  assetTypes: string[]
  example: string
  isDefault: boolean
}

interface ImportJob {
  id: string
  fileName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRows: number
  processedRows: number
  successCount: number
  errorCount: number
  warningCount: number
  createdAt: string
  completedAt?: string
  errors?: { row: number; field: string; message: string }[]
}

interface StagedAsset {
  id: string
  name: string
  generatedName?: string
  assetTag?: string
  type: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  status: 'valid' | 'warning' | 'error'
  validationMessages: string[]
}

const mockTemplates: NamingTemplate[] = [
  {
    id: '1',
    name: 'Laptop - Location Based',
    pattern: 'LPT-{LOCATION}-{SEQUENCE:4}',
    description: 'Laptop naming with location prefix and 4-digit sequence',
    assetTypes: ['Laptop'],
    example: 'LPT-NYC-0042',
    isDefault: true,
  },
  {
    id: '2',
    name: 'Desktop - Department Based',
    pattern: 'DKT-{DEPARTMENT:3}-{SEQUENCE:4}',
    description: 'Desktop naming with department code and sequence',
    assetTypes: ['Desktop'],
    example: 'DKT-ENG-0128',
    isDefault: false,
  },
  {
    id: '3',
    name: 'Monitor - Simple',
    pattern: 'MON-{LOCATION}-{SEQUENCE:4}',
    description: 'Monitor naming with location and sequence',
    assetTypes: ['Monitor'],
    example: 'MON-SF-0256',
    isDefault: true,
  },
  {
    id: '4',
    name: 'Server - Datacenter',
    pattern: 'SRV-{DATACENTER}-{TYPE:3}-{SEQUENCE:3}',
    description: 'Server naming with datacenter, type code, and sequence',
    assetTypes: ['Server'],
    example: 'SRV-DC1-WEB-001',
    isDefault: true,
  },
  {
    id: '5',
    name: 'Mobile Device',
    pattern: 'MOB-{CARRIER:3}-{SEQUENCE:4}',
    description: 'Mobile device with carrier code',
    assetTypes: ['Mobile', 'Tablet'],
    example: 'MOB-VZN-0089',
    isDefault: true,
  },
]

const mockJobs: ImportJob[] = [
  {
    id: '1',
    fileName: 'q1-laptop-inventory.csv',
    status: 'completed',
    totalRows: 150,
    processedRows: 150,
    successCount: 145,
    errorCount: 3,
    warningCount: 2,
    createdAt: '2026-02-03T14:30:00Z',
    completedAt: '2026-02-03T14:32:00Z',
  },
  {
    id: '2',
    fileName: 'new-monitors-feb.xlsx',
    status: 'processing',
    totalRows: 50,
    processedRows: 32,
    successCount: 30,
    errorCount: 2,
    warningCount: 0,
    createdAt: '2026-02-04T09:15:00Z',
  },
  {
    id: '3',
    fileName: 'server-inventory-update.csv',
    status: 'failed',
    totalRows: 25,
    processedRows: 5,
    successCount: 0,
    errorCount: 5,
    warningCount: 0,
    createdAt: '2026-02-04T08:00:00Z',
    errors: [
      { row: 1, field: 'serial_number', message: 'Duplicate serial number found' },
      { row: 2, field: 'type', message: 'Invalid asset type' },
    ],
  },
]

const mockStagedAssets: StagedAsset[] = [
  {
    id: 's1',
    name: 'Dell Latitude 5540',
    generatedName: 'LPT-NYC-0043',
    assetTag: 'LPT-NYC-0043',
    type: 'Laptop',
    manufacturer: 'Dell',
    model: 'Latitude 5540',
    serialNumber: 'DELL123456789',
    status: 'valid',
    validationMessages: [],
  },
  {
    id: 's2',
    name: 'MacBook Pro 14"',
    generatedName: 'LPT-SF-0128',
    assetTag: 'LPT-SF-0128',
    type: 'Laptop',
    manufacturer: 'Apple',
    model: 'MacBook Pro 14-inch',
    serialNumber: 'C02XL123456',
    status: 'valid',
    validationMessages: [],
  },
  {
    id: 's3',
    name: 'Dell Optiplex 7090',
    generatedName: 'DKT-ENG-0129',
    type: 'Desktop',
    manufacturer: 'Dell',
    model: 'Optiplex 7090',
    serialNumber: '',
    status: 'warning',
    validationMessages: ['Serial number is missing'],
  },
  {
    id: 's4',
    name: 'Unknown Device',
    type: 'Laptop',
    manufacturer: '',
    model: '',
    serialNumber: 'UNKNOWN123',
    status: 'error',
    validationMessages: ['Manufacturer is required', 'Model is required', 'Duplicate serial number exists'],
  },
]

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircleIcon className="h-5 w-5 text-brand-400" />
    case 'processing': return <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin" />
    case 'failed': return <XCircleIcon className="h-5 w-5 text-red-400" />
    default: return <ClockIcon className="h-5 w-5 text-slate-400" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-brand-500/20 text-brand-400'
    case 'processing': return 'bg-blue-500/20 text-blue-400'
    case 'failed': return 'bg-red-500/20 text-red-400'
    default: return 'bg-slate-500/20 text-slate-400'
  }
}

function getValidationStatusColor(status: string) {
  switch (status) {
    case 'valid': return 'bg-brand-500/20 text-brand-400 border-brand-500/30'
    case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export default function AssetOnboardingPage() {
  const [templates, setTemplates] = useState<NamingTemplate[]>([])
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'import' | 'staging' | 'templates'>('import')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setTemplates(mockTemplates)
      setJobs(mockJobs)
      setStagedAssets(mockStagedAssets)
      setLoading(false)
    }, 500)
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    // Handle file upload
    const files = e.dataTransfer.files
    if (files && files[0]) {
      console.log('File dropped:', files[0].name)
    }
  }

  const validCount = stagedAssets.filter(a => a.status === 'valid').length
  const warningCount = stagedAssets.filter(a => a.status === 'warning').length
  const errorCount = stagedAssets.filter(a => a.status === 'error').length

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
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <ArrowUpTrayIcon className="h-7 w-7" />
            Asset Onboarding
          </h1>
          <p className="text-slate-400 mt-1">Bulk import and single asset creation with automatic naming</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/assets/new"
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Single Asset
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
            <DocumentArrowUpIcon className="h-4 w-4" />
            Import CSV/Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit">
        {[
          { id: 'import', label: 'Import', count: jobs.filter(j => j.status === 'processing').length },
          { id: 'staging', label: 'Staging Area', count: stagedAssets.length },
          { id: 'templates', label: 'Naming Templates', count: templates.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-slate-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <DocumentArrowUpIcon className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-200 font-medium mb-2">
              Drop your CSV or Excel file here
            </p>
            <p className="text-slate-500 text-sm mb-4">
              or click to browse your files
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Choose File
            </label>
            <p className="text-xs text-slate-600 mt-4">
              Supported formats: CSV, XLSX, XLS • Max file size: 10MB
            </p>
          </div>

          {/* Download Template */}
          <div className="flex items-center justify-between bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TableCellsIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Download Import Template</p>
                <p className="text-sm text-slate-500">Pre-formatted spreadsheet with all required columns</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors text-sm">
              Download Template
            </button>
          </div>

          {/* Recent Imports */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-slate-100">Recent Imports</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {jobs.map((job) => (
                <div key={job.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium text-slate-200">{job.fileName}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Progress */}
                      {job.status === 'processing' && (
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span>Progress</span>
                            <span>{Math.round((job.processedRows / job.totalRows) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${(job.processedRows / job.totalRows) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-brand-400">
                          <CheckCircleIcon className="h-4 w-4" />
                          {job.successCount}
                        </span>
                        {job.errorCount > 0 && (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircleIcon className="h-4 w-4" />
                            {job.errorCount}
                          </span>
                        )}
                        {job.warningCount > 0 && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            {job.warningCount}
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>

                      {/* Actions */}
                      <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Errors */}
                  {job.errors && job.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
                      <p className="text-sm font-medium text-red-400 mb-2">Errors:</p>
                      <div className="space-y-1">
                        {job.errors.slice(0, 3).map((error, i) => (
                          <p key={i} className="text-xs text-slate-400">
                            Row {error.row}: {error.field} - {error.message}
                          </p>
                        ))}
                        {job.errors.length > 3 && (
                          <p className="text-xs text-slate-500">
                            +{job.errors.length - 3} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Staging Tab */}
      {activeTab === 'staging' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <ComputerDesktopIcon className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-100">{stagedAssets.length}</p>
                  <p className="text-xs text-slate-500">Total Staged</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-brand-500/30 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">{validCount}</p>
                  <p className="text-xs text-slate-500">Valid</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-yellow-500/30 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
                  <p className="text-xs text-slate-500">Warnings</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-red-500/30 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <XCircleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm">
                <option>All Status</option>
                <option>Valid Only</option>
                <option>With Warnings</option>
                <option>With Errors</option>
              </select>
              <select className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm">
                <option>All Types</option>
                <option>Laptop</option>
                <option>Desktop</option>
                <option>Monitor</option>
                <option>Server</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors text-sm">
                <ArrowPathIcon className="h-4 w-4" />
                Re-validate All
              </button>
              <button 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                  validCount > 0
                    ? 'bg-brand-600 text-white hover:bg-brand-500'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
                disabled={validCount === 0}
              >
                <CheckCircleIcon className="h-4 w-4" />
                Commit {validCount} Valid Assets
              </button>
            </div>
          </div>

          {/* Staged Assets List */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Generated Name</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Type</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Manufacturer</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Model</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Serial Number</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {stagedAssets.map((asset) => (
                  <tr key={asset.id} className={`hover:bg-slate-700/50 transition-colors ${
                    asset.status === 'error' ? 'bg-red-500/5' : ''
                  }`}>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${getValidationStatusColor(asset.status)}`}>
                        {asset.status === 'valid' && <CheckCircleIcon className="h-3 w-3" />}
                        {asset.status === 'warning' && <ExclamationTriangleIcon className="h-3 w-3" />}
                        {asset.status === 'error' && <XCircleIcon className="h-3 w-3" />}
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <code className="text-sm text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                        {asset.generatedName || asset.assetTag || '-'}
                      </code>
                    </td>
                    <td className="p-4 text-sm text-slate-300">{asset.type}</td>
                    <td className="p-4 text-sm text-slate-300">{asset.manufacturer || '-'}</td>
                    <td className="p-4 text-sm text-slate-300">{asset.model || '-'}</td>
                    <td className="p-4">
                      <code className="text-sm text-slate-400">{asset.serialNumber || '-'}</code>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
                          <PlusIcon className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation Messages */}
          {stagedAssets.some(a => a.validationMessages.length > 0) && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="font-semibold text-slate-100 mb-3">Validation Issues</h3>
              <div className="space-y-2">
                {stagedAssets
                  .filter(a => a.validationMessages.length > 0)
                  .map((asset) => (
                    <div key={asset.id} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                      <div className={`p-1 rounded ${
                        asset.status === 'error' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                      }`}>
                        {asset.status === 'error' ? (
                          <XCircleIcon className="h-4 w-4 text-red-400" />
                        ) : (
                          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{asset.name}</p>
                        <ul className="mt-1 space-y-0.5">
                          {asset.validationMessages.map((msg, i) => (
                            <li key={i} className="text-xs text-slate-400">• {msg}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Info */}
          <div className="bg-gradient-to-r from-brand-500/10 to-blue-500/10 rounded-lg border border-brand-500/30 p-4">
            <div className="flex items-start gap-3">
              <SparklesIcon className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-slate-200">Naming Convention Variables</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-slate-400">
                  <span><code className="text-brand-400">{'{LOCATION}'}</code> - Office location code</span>
                  <span><code className="text-brand-400">{'{DEPARTMENT}'}</code> - Department code</span>
                  <span><code className="text-brand-400">{'{SEQUENCE:N}'}</code> - N-digit sequence</span>
                  <span><code className="text-brand-400">{'{TYPE}'}</code> - Asset type code</span>
                  <span><code className="text-brand-400">{'{DATACENTER}'}</code> - Datacenter code</span>
                  <span><code className="text-brand-400">{'{CARRIER}'}</code> - Mobile carrier code</span>
                </div>
              </div>
            </div>
          </div>

          {/* Add Template Button */}
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors">
              <PlusIcon className="h-4 w-4" />
              Create Template
            </button>
          </div>

          {/* Templates List */}
          <div className="grid grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{template.name}</h3>
                      {template.isDefault && (
                        <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                  </div>
                  <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
                    <Cog6ToothIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Pattern */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Pattern</p>
                    <code className="text-sm text-brand-400 bg-brand-500/10 px-2 py-1 rounded block">
                      {template.pattern}
                    </code>
                  </div>

                  {/* Example */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Example</p>
                    <code className="text-sm text-slate-300 bg-slate-900 px-2 py-1 rounded block">
                      {template.example}
                    </code>
                  </div>

                  {/* Asset Types */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Applies to</p>
                    <div className="flex items-center gap-1">
                      {template.assetTypes.map((type) => (
                        <span
                          key={type}
                          className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
