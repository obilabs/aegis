'use client'

import Link from 'next/link'
import {
  Cog6ToothIcon,
  TagIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  BellIcon,
  PaintBrushIcon,
  ServerStackIcon,
  SparklesIcon,
  DocumentTextIcon,
  ClockIcon,
  BuildingOfficeIcon,
  KeyIcon,
  GlobeAltIcon,
  BookOpenIcon,
  CubeIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  ListBulletIcon,
  CheckBadgeIcon,
  ArrowsRightLeftIcon,
  SignalIcon,
  TicketIcon,
  RectangleGroupIcon,
  Square3Stack3DIcon,
  ArchiveBoxIcon,
  LockClosedIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'

interface SettingsSection {
  title: string
  description: string
  items: SettingsItem[]
}

interface SettingsItem {
  name: string
  description: string
  href: string
  icon: React.ReactNode
  badge?: string
}

const settingsSections: SettingsSection[] = [
  {
    title: 'Tickets & Workflow',
    description: 'Configure ticket statuses, categories, and automation',
    items: [
      {
        name: 'Ticket Types',
        description: 'Configure types, templates, and SLA targets',
        href: '/portal/settings/ticket-types',
        icon: <TicketIcon className="h-6 w-6" />,
      },
      {
        name: 'Ticket Statuses',
        description: 'Customize statuses and SLA behavior',
        href: '/portal/settings/statuses',
        icon: <TagIcon className="h-6 w-6" />,
      },
      {
        name: 'Categories',
        description: 'Manage ticket categories and subcategories',
        href: '/portal/settings/categories',
        icon: <DocumentTextIcon className="h-6 w-6" />,
      },
    ],
  },
  {
    title: 'Catalog & Requests',
    description: 'Configure the service catalog and application registry',
    items: [
      {
        name: 'Service Catalog',
        description: 'Manage catalog items, forms, and approval rules',
        href: '/portal/settings/catalog',
        icon: <RectangleGroupIcon className="h-6 w-6" />,
      },
      {
        name: 'Applications',
        description: 'Application registry for access request forms',
        href: '/portal/settings/applications',
        icon: <Square3Stack3DIcon className="h-6 w-6" />,
      },
    ],
  },
  {
    title: 'Organization',
    description: 'Manage your organization settings',
    items: [
      {
        name: 'Users',
        description: 'Manage team members and account state',
        href: '/portal/settings/users',
        icon: <UserGroupIcon className="h-6 w-6" />,
      },
      {
        name: 'Roles & Permissions',
        description: 'Define role capabilities and access ceilings',
        href: '/portal/settings/roles',
        icon: <ShieldCheckIcon className="h-6 w-6" />,
      },
      {
        name: 'Company Email',
        description: 'Set your company email domain (@yourcompany.com)',
        href: '/portal/settings/company-email',
        icon: <GlobeAltIcon className="h-6 w-6" />,
      },
      {
        name: 'Domains',
        description: 'Trusted, internal, and customer domains for auth and contact routing',
        href: '/portal/settings/domains',
        icon: <BuildingOfficeIcon className="h-6 w-6" />,
      },
      {
        name: 'Knowledge Base',
        description: 'Folders, publishing settings, and permissions',
        href: '/portal/settings/knowledge-base',
        icon: <BookOpenIcon className="h-6 w-6" />,
      },
      {
        name: 'KB Gaps',
        description: 'Topics users ask about that lack KB articles',
        href: '/portal/settings/knowledge-base/gaps',
        icon: <LightBulbIcon className="h-6 w-6" />,
      },
      {
        name: 'KB Contributors',
        description: 'People authorized to write or review knowledge articles',
        href: '/portal/settings/kb-contributors',
        icon: <UserGroupIcon className="h-6 w-6" />,
      },
      {
        name: 'Features',
        description: 'Enable/disable features and beta modules',
        href: '/portal/settings/features',
        icon: <CubeIcon className="h-6 w-6" />,
      },
      {
        name: 'Telemetry',
        description: 'Anonymous usage data, transparency log',
        href: '/portal/settings/telemetry',
        icon: <SignalIcon className="h-6 w-6" />,
      },
    ],
  },
  {
    title: 'Data Management',
    description: 'Controlled vocabularies, asset catalog, and lookup tables',
    items: [
      {
        name: 'Master Data',
        description: 'Control which fields use predefined values vs freetext',
        href: '/portal/settings/master-data',
        icon: <CircleStackIcon className="h-6 w-6" />,
      },
      {
        name: 'Asset Catalog',
        description: 'Manage asset types, subtypes, vendors, and models',
        href: '/portal/settings/asset-catalog',
        icon: <ComputerDesktopIcon className="h-6 w-6" />,
      },
      {
        name: 'Operating Systems',
        description: 'Predefined OS list for asset assignment',
        href: '/portal/settings/operating-systems',
        icon: <CpuChipIcon className="h-6 w-6" />,
      },
      {
        name: 'Job Titles',
        description: 'Manage job titles and onboarding entitlements',
        href: '/portal/settings/job-titles',
        icon: <ListBulletIcon className="h-6 w-6" />,
      },
      {
        name: 'Approval Workflows',
        description: 'Multi-step approval chains for requests',
        href: '/portal/settings/approval-workflows',
        icon: <CheckBadgeIcon className="h-6 w-6" />,
      },
      {
        name: 'Delegation',
        description: 'Delegation rules and out-of-office transfers',
        href: '/portal/settings/delegation',
        icon: <ArrowsRightLeftIcon className="h-6 w-6" />,
      },
      {
        name: 'Data Retention',
        description: 'Configure retention policies and auto-purge for deleted records',
        href: '/portal/settings/data-retention',
        icon: <ArchiveBoxIcon className="h-6 w-6" />,
      },
    ],
  },
  {
    title: 'Integrations',
    description: 'Connect external services and configure AI',
    items: [
      {
        name: 'AI Configuration',
        description: 'Configure AI providers (Ollama, OpenAI, etc.)',
        href: '/portal/settings/ai',
        icon: <SparklesIcon className="h-6 w-6" />,
      },
      {
        name: 'AI Prompts',
        description: 'Tune support, triage, and assistant prompt templates',
        href: '/portal/settings/ai/prompts',
        icon: <DocumentTextIcon className="h-6 w-6" />,
      },
      {
        name: 'Email',
        description: 'SMTP provider, sender identity, and test send',
        href: '/portal/settings/email',
        icon: <BellIcon className="h-6 w-6" />,
      },
      // Provider Access is intentionally hidden from the settings nav
      // (2026-05-16): the page exists but its entire backend is missing
      // — there are no /api/settings/provider-access/* routes, so scopes
      // never load and the Create button stays disabled forever. Restore
      // this entry when the backend is built.
      {
        name: 'MTP Pairing',
        description: 'Pair an Aegis MTP instance (15-min window + single-use binding)',
        href: '/portal/settings/api-keys?type=aegis-mtp-pairing',
        icon: <ArrowsRightLeftIcon className="h-6 w-6" />,
      },
      {
        name: 'API Keys',
        description: 'Manage API keys for integrations and external AI chat access',
        href: '/portal/settings/api-keys',
        icon: <LockClosedIcon className="h-6 w-6" />,
      },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <Cog6ToothIcon className="h-7 w-7" />
          Settings
        </h1>
        <p className="text-slate-400 mt-1">
          Configure your Aegis instance and customize your workflow
        </p>
      </div>

      {/* Settings Sections */}
      {settingsSections.map((section) => (
        <div key={section.title}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-200">{section.title}</h2>
            <p className="text-sm text-slate-500">{section.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`group p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-brand-500/50 hover:bg-slate-800/80 transition-all ${
                  item.badge ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-900 rounded-lg text-slate-400 group-hover:text-brand-400 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors">
                        {item.name}
                      </h3>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* System Info */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">System Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Version</p>
            <p className="text-slate-200">{process.env.NEXT_PUBLIC_APP_VERSION}</p>
          </div>
          <div>
            <p className="text-slate-500">Source</p>
            <p className="text-brand-400">Open source (AGPL-3.0)</p>
          </div>
          <div>
            <p className="text-slate-500">Database</p>
            <p className="text-slate-200">PostgreSQL 16</p>
          </div>
        </div>
      </div>
    </div>
  )
}
