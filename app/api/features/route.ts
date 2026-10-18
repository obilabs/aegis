import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { pool } from '@/lib/db';
import { getOrgId } from '@/lib/org';
import { FEATURES, isListedFeature } from '@/lib/features';

// Normalize feature data — includes both naming conventions
// (feature_key/is_enabled for features settings page, key/enabled for AI settings page)
function normalizeFeature(f: Record<string, unknown>) {
  const featureKey = (f.feature_key || f.key) as string
  const featureName = (f.feature_name || f.name) as string
  const isEnabled = (f.is_enabled ?? f.enabled ?? false) as boolean
  return {
    // New naming (AI settings, TriageSettings component)
    key: featureKey,
    name: featureName,
    enabled: isEnabled,
    // Legacy naming (features settings page)
    feature_key: featureKey,
    feature_name: featureName,
    is_enabled: isEnabled,
    // Common fields
    description: f.description,
    category: f.category,
    status: f.status,
    icon: f.icon,
    badge_text: f.badge_text,
    badge_color: f.badge_color,
    can_enable: f.can_enable ?? true,
    can_disable: f.can_disable ?? true,
    requires_beta_ack: f.requires_beta_ack ?? false,
    beta_acknowledged: f.beta_acknowledged ?? false,
    stable_version: f.stable_version,
    docs_url: f.docs_url,
  }
}

function getDefaultFeatures() {
  return Object.values(FEATURES).filter(isListedFeature).map(f => normalizeFeature({
    feature_key: f.key,
    feature_name: f.name,
    description: f.description,
    category: f.category,
    status: f.status,
    icon: f.icon,
    badge_text: f.badgeText,
    badge_color: f.badgeColor,
    is_enabled: f.defaultEnabled && f.status !== 'coming_soon' && f.status !== 'deprecated',
    can_enable: f.status !== 'coming_soon' && f.status !== 'deprecated',
    can_disable: f.canDisable,
    requires_beta_ack: f.status === 'beta' || f.status === 'alpha',
    beta_acknowledged: false,
    stable_version: f.stableVersion,
    docs_url: f.docsUrl,
  }));
}

// GET /api/features - Get all features for the current organization
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ features: getDefaultFeatures() });
    }

    // Use single-tenant org lookup (not session.user.organizationId which doesn't exist on Better Auth)
    let organizationId: string | null = null
    try {
      organizationId = await getOrgId()
    } catch {
      // Org not set up yet
    }

    if (!organizationId) {
      return NextResponse.json({ features: getDefaultFeatures() });
    }

    // Try to get features from database
    try {
      const result = await pool.query(
        `SELECT * FROM get_organization_features($1)`,
        [organizationId]
      );

      if (result.rows.length > 0) {
        return NextResponse.json({
          features: result.rows.filter(isListedFeature).map((r: Record<string, unknown>) => normalizeFeature(r)),
        });
      }
    } catch {
      // Database function might not exist yet, fall back to defaults
    }

    return NextResponse.json({ features: getDefaultFeatures() });
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}
