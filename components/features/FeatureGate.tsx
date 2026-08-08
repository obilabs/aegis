'use client';

import { ReactNode } from 'react';
import { useFeature } from '@/lib/hooks/useFeatures';
import { FEATURES, getBadgeColorClass } from '@/lib/features';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showComingSoon?: boolean; // Show a "coming soon" message instead of hiding
}

/**
 * Conditionally render children based on feature flag
 * 
 * Usage:
 * <FeatureGate feature="sla_management">
 *   <SLASettings />
 * </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback = null,
  showComingSoon = false 
}: FeatureGateProps) {
  const { isEnabled, feature: featureInfo, isLoading } = useFeature(feature);

  if (isLoading) {
    return null;
  }

  if (!isEnabled) {
    if (showComingSoon && featureInfo?.status === 'coming_soon') {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <span className="text-2xl">🚀</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {featureInfo.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {featureInfo.description}
          </p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColorClass(featureInfo.badgeColor)}`}>
            {featureInfo.badgeText || 'COMING SOON'}
          </span>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface FeatureBadgeProps {
  feature: string;
  className?: string;
}

/**
 * Display a badge for beta/alpha features
 * 
 * Usage:
 * <h1>SLA Management <FeatureBadge feature="sla_management" /></h1>
 */
export function FeatureBadge({ feature, className = '' }: FeatureBadgeProps) {
  const featureInfo = FEATURES[feature];
  
  if (!featureInfo?.badgeText) {
    return null;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBadgeColorClass(featureInfo.badgeColor)} ${className}`}>
      {featureInfo.badgeText}
    </span>
  );
}

interface FeatureNoticeProps {
  feature: string;
  className?: string;
}

/**
 * Display a notice banner for beta/alpha features
 * 
 * Usage:
 * <FeatureNotice feature="sla_management" />
 */
export function FeatureNotice({ feature, className = '' }: FeatureNoticeProps) {
  const featureInfo = FEATURES[feature];
  
  if (!featureInfo || featureInfo.status === 'stable') {
    return null;
  }

  const notices: Record<string, { bg: string; border: string; text: string; icon: string; message: string }> = {
    beta: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: '⚠️',
      message: `This feature is in beta. It may have bugs or change in future versions. It will become stable in version ${featureInfo.stableVersion || 'a future release'}.`,
    },
    alpha: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: '🧪',
      message: `This feature is in alpha. Use with caution - it may have significant bugs or change dramatically. Target stable version: ${featureInfo.stableVersion || 'TBD'}.`,
    },
    coming_soon: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-600 dark:text-gray-300',
      icon: '🚀',
      message: 'This feature is coming soon and is not yet available.',
    },
    deprecated: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-600 dark:text-gray-300',
      icon: '📦',
      message: 'This feature is deprecated and will be removed in a future version.',
    },
  };

  const notice = notices[featureInfo.status];
  if (!notice) return null;

  return (
    <div className={`rounded-lg border ${notice.bg} ${notice.border} p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0 text-lg">{notice.icon}</div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium ${notice.text}`}>
            {featureInfo.name} - {featureInfo.badgeText || featureInfo.status.toUpperCase()}
          </h3>
          <p className={`mt-1 text-sm ${notice.text} opacity-80`}>
            {notice.message}
          </p>
        </div>
      </div>
    </div>
  );
}

interface NavItemWithFeatureProps {
  feature: string;
  children: ReactNode;
  showBadge?: boolean;
}

/**
 * Wrap navigation items to hide them if feature is disabled
 * and show badges for beta/alpha features
 * 
 * Usage:
 * <NavItemWithFeature feature="sla_management" showBadge>
 *   <Link href="/settings/sla">SLA Settings</Link>
 * </NavItemWithFeature>
 */
export function NavItemWithFeature({ feature, children, showBadge = true }: NavItemWithFeatureProps) {
  const { isEnabled, feature: featureInfo } = useFeature(feature);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {children}
      {showBadge && featureInfo?.badgeText && (
        <FeatureBadge feature={feature} />
      )}
    </div>
  );
}
