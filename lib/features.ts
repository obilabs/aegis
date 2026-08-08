/**
 * Feature Flag System
 * 
 * Features can be in different states:
 * - stable: Production ready, enabled by default
 * - beta: Working but may have bugs, requires acknowledgment
 * - alpha: Experimental, use with caution
 * - coming_soon: Not yet available
 * - deprecated: Being phased out
 */

export type FeatureStatus = 'stable' | 'beta' | 'alpha' | 'coming_soon' | 'deprecated';

export type FeatureCategory = 'core' | 'standard' | 'advanced' | 'enterprise' | 'experimental';

export interface Feature {
  key: string;
  name: string;
  description: string;
  category: FeatureCategory;
  status: FeatureStatus;
  icon: string;
  badgeText?: string;
  badgeColor?: 'gray' | 'blue' | 'yellow' | 'green' | 'red';
  defaultEnabled: boolean;
  canDisable: boolean;
  stableVersion?: string;
  docsUrl?: string;
}

export interface OrganizationFeature extends Feature {
  isEnabled: boolean;
  canEnable: boolean;
  requiresBetaAck: boolean;
  betaAcknowledged: boolean;
}

// Client-side feature registry (mirrors database)
export const FEATURES: Record<string, Feature> = {
  // Core (always enabled)
  tickets: {
    key: 'tickets',
    name: 'Ticket Management',
    description: 'Create, track, and resolve support tickets',
    category: 'core',
    status: 'stable',
    icon: 'Ticket',
    defaultEnabled: true,
    canDisable: false,
  },
  contacts: {
    key: 'contacts',
    name: 'Contact Management',
    description: 'Manage employees, customers, vendors, and partners',
    category: 'core',
    status: 'stable',
    icon: 'Users',
    defaultEnabled: true,
    canDisable: false,
  },
  auth: {
    key: 'auth',
    name: 'Authentication',
    description: 'User login and session management',
    category: 'core',
    status: 'stable',
    icon: 'Lock',
    defaultEnabled: true,
    canDisable: false,
  },

  // Standard (enabled by default)
  knowledge_base: {
    key: 'knowledge_base',
    name: 'Knowledge Base',
    description: 'Create and share documentation and help articles',
    category: 'standard',
    status: 'stable',
    icon: 'BookOpen',
    defaultEnabled: true,
    canDisable: true,
  },
  assets: {
    key: 'assets',
    name: 'Asset Management',
    description: 'Track hardware, software, and other IT assets',
    category: 'standard',
    status: 'stable',
    icon: 'Monitor',
    defaultEnabled: true,
    canDisable: true,
  },
  credentials: {
    key: 'credentials',
    name: 'Credential Vault',
    description: 'Securely store and share passwords and API keys',
    category: 'standard',
    status: 'stable',
    icon: 'Key',
    defaultEnabled: true,
    canDisable: true,
  },
  companies: {
    key: 'companies',
    name: 'Company Management',
    description: 'Manage client companies and their contacts',
    category: 'standard',
    status: 'stable',
    icon: 'Building',
    defaultEnabled: true,
    canDisable: true,
  },
  dashboard: {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Overview of tickets, assets, and activity',
    category: 'standard',
    status: 'stable',
    icon: 'LayoutDashboard',
    defaultEnabled: true,
    canDisable: false,
  },

  // Advanced (disabled by default, opt-in)
  sla_management: {
    key: 'sla_management',
    name: 'SLA Management',
    description: 'Track response and resolution time targets',
    category: 'advanced',
    status: 'beta',
    icon: 'Clock',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.2.0',
  },
  custom_statuses: {
    key: 'custom_statuses',
    name: 'Custom Ticket Statuses',
    description: 'Create custom statuses that map to open/pending/closed',
    category: 'advanced',
    status: 'beta',
    icon: 'Tag',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.2.0',
  },
  workflows: {
    key: 'workflows',
    name: 'Workflow Automation',
    description: 'Automate ticket routing, assignments, and notifications',
    category: 'advanced',
    status: 'beta',
    icon: 'GitBranch',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
  vendors: {
    key: 'vendors',
    name: 'Vendor Management',
    description: 'Track vendors, contracts, and support contacts',
    category: 'advanced',
    status: 'beta',
    icon: 'Briefcase',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.2.0',
  },
  service_catalog: {
    key: 'service_catalog',
    name: 'Service Catalog',
    description: 'Define services, costs, and access request workflows',
    category: 'advanced',
    status: 'beta',
    icon: 'ShoppingCart',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
  onboarding_offboarding: {
    key: 'onboarding_offboarding',
    name: 'Onboarding & Offboarding',
    description: 'Structured workflows for employee lifecycle',
    category: 'advanced',
    status: 'beta',
    icon: 'UserPlus',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
  org_hierarchy: {
    key: 'org_hierarchy',
    name: 'Organization Hierarchy',
    description: 'Org charts, reporting structure, and location hierarchy',
    category: 'advanced',
    status: 'beta',
    icon: 'Network',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
  policies: {
    key: 'policies',
    name: 'Policies & Procedures',
    description: 'Company policies with acknowledgment tracking',
    category: 'advanced',
    status: 'beta',
    icon: 'FileText',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },

  // Enterprise (disabled by default)
  workspaces: {
    key: 'workspaces',
    name: 'Workspaces',
    description: 'Separate helpdesks for IT, HR, Facilities, etc.',
    category: 'enterprise',
    status: 'alpha',
    icon: 'Layers',
    badgeText: 'ALPHA',
    badgeColor: 'red',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '2.0.0',
  },
  teams: {
    key: 'teams',
    name: 'Teams & Routing',
    description: 'Team-based ticket assignment and load balancing',
    category: 'enterprise',
    status: 'alpha',
    icon: 'Users',
    badgeText: 'ALPHA',
    badgeColor: 'red',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '2.0.0',
  },
  approval_chains: {
    key: 'approval_chains',
    name: 'Approval Workflows',
    description: 'Multi-level approval for access requests and changes',
    category: 'enterprise',
    status: 'alpha',
    icon: 'CheckSquare',
    badgeText: 'ALPHA',
    badgeColor: 'red',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '2.0.0',
  },
  rbac_advanced: {
    key: 'rbac_advanced',
    name: 'Advanced RBAC',
    description: 'Granular role-based access control with custom permissions',
    category: 'enterprise',
    status: 'beta',
    icon: 'Shield',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.5.0',
  },
  audit_log: {
    key: 'audit_log',
    name: 'Audit Logging',
    description: 'Complete audit trail of all system actions',
    category: 'enterprise',
    status: 'stable',
    icon: 'History',
    defaultEnabled: true,
    canDisable: false,
  },

  // Integrations
  email_integration: {
    key: 'email_integration',
    name: 'Email Integration',
    description: 'Create tickets from email, send notifications',
    category: 'standard',
    status: 'beta',
    icon: 'Mail',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.2.0',
  },
  api_access: {
    key: 'api_access',
    name: 'API Access',
    description: 'REST API for integrations and automation',
    category: 'standard',
    status: 'stable',
    icon: 'Code',
    defaultEnabled: true,
    canDisable: true,
  },
  webhooks: {
    key: 'webhooks',
    name: 'Webhooks',
    description: 'Send events to external systems',
    category: 'advanced',
    status: 'coming_soon',
    icon: 'Webhook',
    badgeText: 'COMING SOON',
    badgeColor: 'gray',
    defaultEnabled: false,
    canDisable: true,
  },
  sso: {
    key: 'sso',
    // Explicit "Enterprise" prefix so operators don't confuse this with
    // the Google OAuth social login that Better Auth already ships
    // (that's under Login, not a feature flag). This slot is for SAML +
    // OIDC federation against an organisation's own IdP (Okta, Azure
    // AD, Auth0, etc.) — genuinely not built.
    name: 'Enterprise SSO (SAML / OIDC)',
    description: 'Federate authentication with your identity provider',
    category: 'enterprise',
    status: 'coming_soon',
    icon: 'Key',
    badgeText: 'COMING SOON',
    badgeColor: 'gray',
    defaultEnabled: false,
    canDisable: true,
  },

  // AI Features
  ai_chat: {
    key: 'ai_chat',
    name: 'AI Support Chat',
    description: 'AI-powered support assistant for users',
    category: 'advanced',
    status: 'beta',
    icon: 'Bot',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
  ai_triage: {
    key: 'ai_triage',
    name: 'AI Ticket Triage',
    description: 'AI-powered ticket categorization, priority scoring, and smart routing',
    category: 'enterprise',
    status: 'alpha',
    icon: 'Sparkles',
    badgeText: 'ALPHA',
    badgeColor: 'red',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '2.0.0',
  },
  ai_auto_status: {
    key: 'ai_auto_status',
    name: 'AI Auto Status',
    description: 'Automatically transition ticket statuses based on activity',
    category: 'enterprise',
    status: 'alpha',
    icon: 'Zap',
    badgeText: 'ALPHA',
    badgeColor: 'red',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '2.0.0',
  },
  smart_queue: {
    key: 'smart_queue',
    name: 'Smart Queue',
    description: 'Priority-scored ticket queue with SLA urgency and impact factors',
    category: 'advanced',
    status: 'beta',
    icon: 'ListOrdered',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.5.0',
  },
  ai_suggestions: {
    key: 'ai_suggestions',
    name: 'AI Suggestions',
    description: 'Smart suggestions for ticket responses and KB articles',
    category: 'advanced',
    status: 'beta',
    icon: 'Lightbulb',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
  ai_editor: {
    key: 'ai_editor',
    name: 'AI Text Editor',
    description: 'AI-powered rich text editing with generation and rephrasing',
    category: 'advanced',
    status: 'beta',
    icon: 'Wand2',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.2.0',
  },

  // Provider/MSP Features
  provider_access: {
    key: 'provider_access',
    name: 'Provider Access',
    description: 'Allow MSPs to access your data with granular permissions',
    category: 'enterprise',
    status: 'beta',
    icon: 'Link',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.5.0',
  },
  credential_sharing: {
    key: 'credential_sharing',
    name: 'Credential Sharing',
    description: 'Secure on-demand credential access for providers',
    category: 'enterprise',
    status: 'beta',
    icon: 'Share2',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.5.0',
  },

  // Monitoring
  ssl_monitoring: {
    key: 'ssl_monitoring',
    name: 'SSL Certificate Monitoring',
    description: 'Track SSL certificate expiration',
    category: 'advanced',
    status: 'beta',
    icon: 'Shield',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: true,
    canDisable: true,
  },
  dns_monitoring: {
    key: 'dns_monitoring',
    name: 'DNS Monitoring',
    description: 'Monitor DNS records and changes',
    category: 'advanced',
    status: 'beta',
    icon: 'Globe',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: true,
    canDisable: true,
  },
  uptime_monitoring: {
    key: 'uptime_monitoring',
    name: 'Uptime Monitoring',
    description: 'Monitor service availability',
    category: 'advanced',
    status: 'coming_soon',
    icon: 'Activity',
    badgeText: 'COMING SOON',
    badgeColor: 'gray',
    defaultEnabled: false,
    canDisable: true,
  },
};

// ============================================================================
// Feature Presets — map industry/team_size/use_case to recommended features
// ============================================================================

export interface PresetProfile {
  label: string
  features: string[] // feature keys to enable
}

/**
 * Industry-based preset profiles.
 * Each maps an industry to the feature keys that are most relevant.
 */
export const INDUSTRY_PRESETS: Record<string, PresetProfile> = {
  healthcare: {
    label: 'Healthcare',
    features: ['policies', 'assets', 'credentials', 'audit_log', 'rbac_advanced', 'onboarding_offboarding'],
  },
  finance: {
    label: 'Finance & Banking',
    features: ['policies', 'credentials', 'audit_log', 'rbac_advanced', 'approval_chains', 'vendors'],
  },
  technology: {
    label: 'Technology',
    features: ['assets', 'credentials', 'service_catalog', 'ai_chat', 'ai_suggestions', 'vendors', 'sla_management'],
  },
  education: {
    label: 'Education',
    features: ['policies', 'assets', 'knowledge_base', 'onboarding_offboarding'],
  },
  government: {
    label: 'Government',
    features: ['policies', 'audit_log', 'rbac_advanced', 'credentials', 'approval_chains'],
  },
  msp: {
    label: 'MSP / IT Services',
    features: ['sla_management', 'service_catalog', 'vendors', 'provider_access', 'credential_sharing', 'ai_triage', 'smart_queue', 'companies'],
  },
  legal: {
    label: 'Legal',
    features: ['policies', 'credentials', 'audit_log', 'vendors'],
  },
  retail: {
    label: 'Retail & Hospitality',
    features: ['assets', 'sla_management', 'onboarding_offboarding'],
  },
  manufacturing: {
    label: 'Manufacturing',
    features: ['assets', 'sla_management', 'vendors', 'onboarding_offboarding'],
  },
  nonprofit: {
    label: 'Nonprofit',
    features: ['knowledge_base', 'assets', 'policies'],
  },
}

/**
 * Team size presets — larger teams benefit from more structure.
 */
export const TEAM_SIZE_PRESETS: Record<string, PresetProfile> = {
  '1-5': {
    label: '1-5 people',
    features: [], // Keep it simple — use defaults
  },
  '6-25': {
    label: '6-25 people',
    features: ['sla_management'],
  },
  '26-100': {
    label: '26-100 people',
    features: ['sla_management', 'onboarding_offboarding', 'policies', 'org_hierarchy'],
  },
  '101-500': {
    label: '101-500 people',
    features: ['sla_management', 'onboarding_offboarding', 'policies', 'org_hierarchy', 'rbac_advanced', 'teams', 'approval_chains'],
  },
  '500+': {
    label: '500+ people',
    features: ['sla_management', 'onboarding_offboarding', 'policies', 'org_hierarchy', 'rbac_advanced', 'teams', 'approval_chains', 'workspaces'],
  },
}

/**
 * Use-case presets — what the admin primarily uses Aegis for.
 */
export const USE_CASE_PRESETS: Record<string, PresetProfile> = {
  helpdesk: {
    label: 'Internal IT Helpdesk',
    features: ['sla_management', 'ai_chat', 'ai_suggestions'],
  },
  all: {
    label: 'Full ITSM',
    features: ['sla_management', 'service_catalog', 'assets', 'vendors', 'ai_chat', 'ai_suggestions', 'smart_queue'],
  },
  asset_management: {
    label: 'Asset Management',
    features: ['assets', 'vendors', 'service_catalog'],
  },
  knowledge_management: {
    label: 'Knowledge Management',
    features: ['knowledge_base', 'policies', 'ai_chat'],
  },
}

/**
 * Merge applicable presets into a feature defaults map.
 * Returns features that should be enabled based on the profile.
 * Core features are always enabled and not included in the output.
 */
export function getPresetsForProfile(
  industry?: string,
  teamSize?: string,
  useCase?: string,
): { defaults: Record<string, boolean>; sources: Record<string, string[]> } {
  const defaults: Record<string, boolean> = {}
  const sources: Record<string, string[]> = {} // feature key → which preset recommended it

  // Start with all features at their defaultEnabled value
  for (const feature of Object.values(FEATURES)) {
    defaults[feature.key] = feature.defaultEnabled
  }

  // Layer in presets (each one can only turn features ON, never OFF)
  const applyPreset = (preset: PresetProfile | undefined, sourceName: string) => {
    if (!preset) return
    for (const key of preset.features) {
      if (FEATURES[key] && isFeatureAvailable(key)) {
        defaults[key] = true
        if (!sources[key]) sources[key] = []
        sources[key].push(sourceName)
      }
    }
  }

  if (industry) applyPreset(INDUSTRY_PRESETS[industry], `${INDUSTRY_PRESETS[industry]?.label || industry}`)
  if (teamSize) applyPreset(TEAM_SIZE_PRESETS[teamSize], `${TEAM_SIZE_PRESETS[teamSize]?.label || teamSize} team`)
  if (useCase) applyPreset(USE_CASE_PRESETS[useCase], `${USE_CASE_PRESETS[useCase]?.label || useCase}`)

  return { defaults, sources }
}

// Get features by category
export function getFeaturesByCategory(category: FeatureCategory): Feature[] {
  return Object.values(FEATURES).filter(f => f.category === category);
}

// Get features by status
export function getFeaturesByStatus(status: FeatureStatus): Feature[] {
  return Object.values(FEATURES).filter(f => f.status === status);
}

// Check if feature is available (not coming_soon or deprecated)
export function isFeatureAvailable(featureKey: string): boolean {
  const feature = FEATURES[featureKey];
  if (!feature) return false;
  return feature.status !== 'coming_soon' && feature.status !== 'deprecated';
}

// Get badge color class
export function getBadgeColorClass(color?: string): string {
  switch (color) {
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'green':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'blue':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

// Feature categories with display info
export const FEATURE_CATEGORIES: Record<FeatureCategory, { name: string; description: string }> = {
  core: {
    name: 'Core',
    description: 'Essential features that are always enabled',
  },
  standard: {
    name: 'Standard',
    description: 'Common features enabled by default',
  },
  advanced: {
    name: 'Advanced',
    description: 'Power user features for complex workflows',
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Features for large organizations and MSPs',
  },
  experimental: {
    name: 'Experimental',
    description: 'Cutting-edge features in early development',
  },
};

// Feature status with display info
export const FEATURE_STATUSES: Record<FeatureStatus, { name: string; description: string; color: string }> = {
  stable: {
    name: 'Stable',
    description: 'Production ready and fully supported',
    color: 'green',
  },
  beta: {
    name: 'Beta',
    description: 'Working but may have bugs. Will be stable in a future version.',
    color: 'yellow',
  },
  alpha: {
    name: 'Alpha',
    description: 'Experimental. Use with caution. May change significantly.',
    color: 'red',
  },
  coming_soon: {
    name: 'Coming Soon',
    description: 'Not yet available. Stay tuned!',
    color: 'gray',
  },
  deprecated: {
    name: 'Deprecated',
    description: 'Being phased out. Will be removed in a future version.',
    color: 'gray',
  },
};
