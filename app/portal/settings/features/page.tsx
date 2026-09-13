'use client';

import { useState, useEffect } from 'react';
import { 
  Ticket, Users, Lock, BookOpen, Monitor, Key, Building, LayoutDashboard,
  Clock, Tag, GitBranch, Briefcase, ShoppingCart, UserPlus, Network, FileText,
  Layers, CheckSquare, Shield, History, Mail, Code, Webhook, Bot, Sparkles,
  Lightbulb, Wand2, Link, Share2, Globe, Activity, AlertTriangle, Check, X,
  Info, ChevronDown, ChevronRight
} from 'lucide-react';
import { FEATURES, FEATURE_CATEGORIES, Feature, FeatureCategory, getBadgeColorClass, isListedFeature, SHOW_UPCOMING_FEATURES } from '@/lib/features';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Ticket, Users, Lock, BookOpen, Monitor, Key, Building, LayoutDashboard,
  Clock, Tag, GitBranch, Briefcase, ShoppingCart, UserPlus, Network, FileText,
  Layers, CheckSquare, Shield, History, Mail, Code, Webhook, Bot, Sparkles,
  Lightbulb, Wand2, Link, Share2, Globe, Activity,
};

interface OrganizationFeature {
  feature_key: string;
  feature_name: string;
  description: string;
  category: string;
  status: string;
  icon: string;
  badge_text?: string;
  badge_color?: string;
  is_enabled: boolean;
  can_enable: boolean;
  can_disable: boolean;
  requires_beta_ack: boolean;
  beta_acknowledged: boolean;
  stable_version?: string;
  docs_url?: string;
}

export default function FeaturesSettingsPage() {
  const [features, setFeatures] = useState<OrganizationFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'standard', 'advanced']));
  const [confirmDialog, setConfirmDialog] = useState<{
    feature: OrganizationFeature;
    action: 'enable' | 'disable';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, []);

  async function fetchFeatures() {
    try {
      const response = await fetch('/api/features');
      const data = await response.json();
      setFeatures((data.features || []).filter(isListedFeature));
    } catch (error) {
      console.error('Failed to fetch features:', error);
      // Use client-side defaults
      const defaultFeatures = Object.values(FEATURES).filter(isListedFeature).map(f => ({
        feature_key: f.key,
        feature_name: f.name,
        description: f.description,
        category: f.category,
        status: f.status,
        icon: f.icon,
        badge_text: f.badgeText,
        badge_color: f.badgeColor,
        is_enabled: f.defaultEnabled && f.status !== 'coming_soon',
        can_enable: f.status !== 'coming_soon' && f.status !== 'deprecated',
        can_disable: f.canDisable,
        requires_beta_ack: f.status === 'beta' || f.status === 'alpha',
        beta_acknowledged: false,
        stable_version: f.stableVersion,
        docs_url: f.docsUrl,
      }));
      setFeatures(defaultFeatures);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(feature: OrganizationFeature) {
    if (feature.is_enabled) {
      // Disabling
      if (!feature.can_disable) return;
      setConfirmDialog({ feature, action: 'disable' });
    } else {
      // Enabling
      if (!feature.can_enable) return;
      if (feature.requires_beta_ack && !feature.beta_acknowledged) {
        setConfirmDialog({ feature, action: 'enable' });
      } else {
        await enableFeature(feature.feature_key, false);
      }
    }
  }

  async function enableFeature(featureKey: string, acknowledgeBeta: boolean) {
    setActionLoading(featureKey);
    try {
      const response = await fetch('/api/features/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, acknowledgeBeta }),
      });
      const data = await response.json();
      
      if (data.success) {
        setFeatures(prev => prev.map(f => 
          f.feature_key === featureKey 
            ? { ...f, is_enabled: true, beta_acknowledged: acknowledgeBeta || f.beta_acknowledged }
            : f
        ));
        setConfirmDialog(null);
      } else if (data.requiresAcknowledgment) {
        // Show confirmation dialog
        const feature = features.find(f => f.feature_key === featureKey);
        if (feature) {
          setConfirmDialog({ feature, action: 'enable' });
        }
      } else {
        alert(data.error || 'Failed to enable feature');
      }
    } catch (error) {
      console.error('Failed to enable feature:', error);
      alert('Failed to enable feature');
    } finally {
      setActionLoading(null);
    }
  }

  async function disableFeature(featureKey: string) {
    setActionLoading(featureKey);
    try {
      const response = await fetch('/api/features/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey }),
      });
      const data = await response.json();
      
      if (data.success) {
        setFeatures(prev => prev.map(f => 
          f.feature_key === featureKey ? { ...f, is_enabled: false } : f
        ));
        setConfirmDialog(null);
      } else {
        alert(data.error || 'Failed to disable feature');
      }
    } catch (error) {
      console.error('Failed to disable feature:', error);
      alert('Failed to disable feature');
    } finally {
      setActionLoading(null);
    }
  }

  function toggleCategory(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  // Group features by category
  const featuresByCategory = features.reduce((acc, feature) => {
    const category = feature.category as FeatureCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<FeatureCategory, OrganizationFeature[]>);

  const categoryOrder: FeatureCategory[] = ['core', 'standard', 'advanced', 'enterprise', 'experimental'];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Features</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enable or disable features for your organization. Beta features may have bugs and will become stable in future versions.
        </p>
      </div>

      {/* Legend */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Feature Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              STABLE
            </span>
            <span className="text-gray-600 dark:text-gray-400">Production ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              BETA
            </span>
            <span className="text-gray-600 dark:text-gray-400">May have bugs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              ALPHA
            </span>
            <span className="text-gray-600 dark:text-gray-400">Experimental</span>
          </div>
          {SHOW_UPCOMING_FEATURES && (
            <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              COMING SOON
            </span>
            <span className="text-gray-600 dark:text-gray-400">Not yet available</span>
          </div>
          )}
        </div>
      </div>

      {/* Feature Categories */}
      <div className="space-y-4">
        {categoryOrder.map(category => {
          const categoryFeatures = featuresByCategory[category] || [];
          if (categoryFeatures.length === 0) return null;
          
          const categoryInfo = FEATURE_CATEGORIES[category];
          const isExpanded = expandedCategories.has(category);
          const enabledCount = categoryFeatures.filter(f => f.is_enabled).length;

          return (
            <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {categoryInfo.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {categoryInfo.description}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {enabledCount} / {categoryFeatures.length} enabled
                </div>
              </button>

              {/* Feature List */}
              {isExpanded && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {categoryFeatures.map(feature => {
                    const IconComponent = iconMap[feature.icon] || Info;
                    const isLoading = actionLoading === feature.feature_key;
                    
                    return (
                      <div
                        key={feature.feature_key}
                        className={`p-4 flex items-center justify-between ${
                          feature.status === 'coming_soon' ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            feature.is_enabled 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                          }`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {feature.feature_name}
                              </h3>
                              {feature.badge_text && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBadgeColorClass(feature.badge_color)}`}>
                                  {feature.badge_text}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {feature.description}
                            </p>
                            {feature.stable_version && feature.status !== 'stable' && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                Stable in v{feature.stable_version}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center gap-3">
                          {!feature.can_disable && feature.is_enabled && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Required
                            </span>
                          )}
                          {feature.status === 'coming_soon' ? (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Coming Soon
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggle(feature)}
                              disabled={isLoading || (!feature.can_enable && !feature.is_enabled) || (!feature.can_disable && feature.is_enabled)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                feature.is_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  feature.is_enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              >
                                {isLoading && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></span>
                                  </span>
                                )}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setConfirmDialog(null)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                  confirmDialog.action === 'enable' 
                    ? confirmDialog.feature.status === 'alpha'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-yellow-100 dark:bg-yellow-900/30'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {confirmDialog.action === 'enable' ? (
                    <AlertTriangle className={`h-6 w-6 ${
                      confirmDialog.feature.status === 'alpha'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`} />
                  ) : (
                    <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                    {confirmDialog.action === 'enable' ? 'Enable' : 'Disable'} {confirmDialog.feature.feature_name}?
                  </h3>
                  <div className="mt-2">
                    {confirmDialog.action === 'enable' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          This feature is in <strong>{confirmDialog.feature.status.toUpperCase()}</strong>.
                        </p>
                        {confirmDialog.feature.status === 'alpha' ? (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-300">
                              <strong>Warning:</strong> Alpha features are experimental and may have significant bugs, 
                              change dramatically, or be removed entirely. Use with caution.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                              Beta features are working but may have bugs. They will become stable in 
                              version {confirmDialog.feature.stable_version || 'a future release'}.
                            </p>
                          </div>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Do you want to enable this feature anyway?
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to disable {confirmDialog.feature.feature_name}? 
                        Any data associated with this feature will be preserved but the feature will no longer be accessible.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDialog.action === 'enable') {
                      enableFeature(confirmDialog.feature.feature_key, true);
                    } else {
                      disableFeature(confirmDialog.feature.feature_key);
                    }
                  }}
                  disabled={actionLoading === confirmDialog.feature.feature_key}
                  className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto disabled:opacity-50 ${
                    confirmDialog.action === 'enable'
                      ? confirmDialog.feature.status === 'alpha'
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-yellow-600 hover:bg-yellow-500'
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                >
                  {actionLoading === confirmDialog.feature.feature_key ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Processing...
                    </span>
                  ) : (
                    <>
                      {confirmDialog.action === 'enable' ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Enable {confirmDialog.feature.status === 'alpha' ? 'Alpha' : 'Beta'} Feature
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-1" />
                          Disable Feature
                        </>
                      )}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
