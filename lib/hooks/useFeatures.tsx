'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { FEATURES, Feature, FeatureStatus, isFeatureAvailable } from '@/lib/features';

interface EnabledFeatures {
  [key: string]: boolean;
}

interface FeatureContextType {
  // Check if a feature is enabled
  isEnabled: (featureKey: string) => boolean;
  
  // Get feature info
  getFeature: (featureKey: string) => Feature | undefined;
  
  // Get all enabled features
  enabledFeatures: EnabledFeatures;
  
  // Enable/disable features (requires API call)
  enableFeature: (featureKey: string, acknowledgeBeta?: boolean) => Promise<{ success: boolean; error?: string; requiresAcknowledgment?: boolean; message?: string }>;
  disableFeature: (featureKey: string) => Promise<{ success: boolean; error?: string }>;
  
  // Loading state
  isLoading: boolean;
  
  // Refresh features from server
  refresh: () => Promise<void>;
}

const FeatureContext = createContext<FeatureContextType | null>(null);

interface FeatureProviderProps {
  children: ReactNode;
  initialFeatures?: EnabledFeatures;
}

export function FeatureProvider({ children, initialFeatures }: FeatureProviderProps) {
  const [enabledFeatures, setEnabledFeatures] = useState<EnabledFeatures>(
    initialFeatures || getDefaultFeatures()
  );
  const [isLoading, setIsLoading] = useState(!initialFeatures);

  // Get default features based on FEATURES registry
  function getDefaultFeatures(): EnabledFeatures {
    const defaults: EnabledFeatures = {};
    Object.values(FEATURES).forEach(feature => {
      defaults[feature.key] = feature.defaultEnabled && isFeatureAvailable(feature.key);
    });
    return defaults;
  }

  // Fetch features from server
  const fetchFeatures = useCallback(async () => {
    try {
      const response = await fetch('/api/features');
      if (response.ok) {
        const data = await response.json();
        if (data.features) {
          const features: EnabledFeatures = {};
          data.features.forEach((f: { feature_key: string; is_enabled: boolean }) => {
            features[f.feature_key] = f.is_enabled;
          });
          setEnabledFeatures(features);
        }
      }
    } catch (error) {
      console.error('Failed to fetch features:', error);
      // Fall back to defaults
      setEnabledFeatures(getDefaultFeatures());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!initialFeatures) {
      fetchFeatures();
    }
  }, [initialFeatures, fetchFeatures]);

  // Check if feature is enabled
  const isEnabled = useCallback((featureKey: string): boolean => {
    // First check if feature exists and is available
    const feature = FEATURES[featureKey];
    if (!feature) return false;
    if (!isFeatureAvailable(featureKey)) return false;
    
    // Check enabled state
    return enabledFeatures[featureKey] ?? feature.defaultEnabled;
  }, [enabledFeatures]);

  // Get feature info
  const getFeature = useCallback((featureKey: string): Feature | undefined => {
    return FEATURES[featureKey];
  }, []);

  // Enable a feature
  const enableFeature = useCallback(async (
    featureKey: string, 
    acknowledgeBeta = false
  ): Promise<{ success: boolean; error?: string; requiresAcknowledgment?: boolean; message?: string }> => {
    try {
      const response = await fetch('/api/features/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, acknowledgeBeta }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEnabledFeatures(prev => ({ ...prev, [featureKey]: true }));
      }
      
      return data;
    } catch (error) {
      return { success: false, error: 'Failed to enable feature' };
    }
  }, []);

  // Disable a feature
  const disableFeature = useCallback(async (
    featureKey: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/features/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEnabledFeatures(prev => ({ ...prev, [featureKey]: false }));
      }
      
      return data;
    } catch (error) {
      return { success: false, error: 'Failed to disable feature' };
    }
  }, []);

  const value: FeatureContextType = {
    isEnabled,
    getFeature,
    enabledFeatures,
    enableFeature,
    disableFeature,
    isLoading,
    refresh: fetchFeatures,
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

// Hook to use features
export function useFeatures() {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
}

// Simple hook to check if a single feature is enabled
export function useFeature(featureKey: string): { isEnabled: boolean; feature: Feature | undefined; isLoading: boolean } {
  const { isEnabled, getFeature, isLoading } = useFeatures();
  return {
    isEnabled: isEnabled(featureKey),
    feature: getFeature(featureKey),
    isLoading,
  };
}

// HOC to conditionally render based on feature flag
export function withFeature<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureKey: string,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureGatedComponent(props: P) {
    const { isEnabled, isLoading } = useFeature(featureKey);
    
    if (isLoading) {
      return null; // Or a loading spinner
    }
    
    if (!isEnabled) {
      return FallbackComponent ? <FallbackComponent {...props} /> : null;
    }
    
    return <WrappedComponent {...props} />;
  };
}
