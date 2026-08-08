import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthContext } from '@/lib/org';
import { isAdmin } from '@/lib/permissions';
import { FEATURES, isFeatureAvailable } from '@/lib/features';
import { logAudit, getClientIp } from '@/lib/audit';

// POST /api/features/enable - Enable a feature for the organization
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { session, userId, orgId: organizationId } = ctx;

    // Authorization (audit M1): toggling org feature flags is admin-only.
    if (!(await isAdmin(userId))) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { featureKey, acknowledgeBeta = false } = body;

    if (!featureKey) {
      return NextResponse.json(
        { success: false, error: 'Feature key is required' },
        { status: 400 }
      );
    }

    // Check if feature exists
    const feature = FEATURES[featureKey];
    if (!feature) {
      return NextResponse.json(
        { success: false, error: 'Feature not found' },
        { status: 404 }
      );
    }

    // Check if feature is available
    if (!isFeatureAvailable(featureKey)) {
      if (feature.status === 'coming_soon') {
        return NextResponse.json({
          success: false,
          error: 'This feature is coming soon and cannot be enabled yet',
          stable_version: feature.stableVersion,
        });
      }
      if (feature.status === 'deprecated') {
        return NextResponse.json({
          success: false,
          error: 'This feature has been deprecated',
        });
      }
    }

    // Check if beta acknowledgment is required
    if ((feature.status === 'beta' || feature.status === 'alpha') && !acknowledgeBeta) {
      return NextResponse.json({
        success: false,
        error: 'Beta acknowledgment required',
        requiresAcknowledgment: true,
        status: feature.status,
        stable_version: feature.stableVersion,
        message: `This feature is in ${feature.status.toUpperCase()}. It may have bugs or change significantly. ` +
          `It will become stable in version ${feature.stableVersion || 'a future release'}. ` +
          `Do you want to enable it anyway?`,
      });
    }

    // Try to enable via database function
    try {
      const result = await pool.query(
        `SELECT enable_feature($1, $2, $3, $4) as result`,
        [organizationId, featureKey, userId, acknowledgeBeta]
      );

      const dbResult = result.rows[0]?.result;
      if (dbResult?.success) {
        logAudit({
          orgId: organizationId, userId, action: 'feature_enabled', actionCategory: 'settings',
          entityType: 'features', entityName: feature.name,
          newValues: { featureKey, status: feature.status, acknowledgeBeta },
          actorIp: getClientIp(request.headers),
        })
        return NextResponse.json(dbResult);
      }
    } catch {
      // Database function might not exist, use direct insert
    }

    // Fallback: direct insert/update.
    //
    // The prior code silently swallowed FK constraint violations here
    // and STILL returned success — meaning "feature_registry table not
    // seeded yet" produced a fake-success API response. Caught
    // 2026-07-05 while enabling ai_chat. Now: if the write fails, the
    // API returns 500 with the real error so the caller knows to run
    // POST /api/admin/features/reseed to backfill the registry.
    try {
      await pool.query(
        `INSERT INTO organization_feature_flags (
          organization_id, feature_key, enabled, enabled_at, enabled_by,
          beta_acknowledged, beta_acknowledged_at, beta_acknowledged_by
        ) VALUES ($1, $2, true, NOW(), $3, $4, $5, $6)
        ON CONFLICT (organization_id, feature_key) DO UPDATE SET
          enabled = true,
          enabled_at = NOW(),
          enabled_by = $3,
          beta_acknowledged = COALESCE(organization_feature_flags.beta_acknowledged, $4),
          beta_acknowledged_at = COALESCE(organization_feature_flags.beta_acknowledged_at, $5),
          beta_acknowledged_by = COALESCE(organization_feature_flags.beta_acknowledged_by, $6),
          updated_at = NOW()`,
        [
          organizationId,
          featureKey,
          userId,
          feature.status === 'beta' || feature.status === 'alpha',
          (feature.status === 'beta' || feature.status === 'alpha') ? new Date() : null,
          (feature.status === 'beta' || feature.status === 'alpha') ? userId : null,
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown DB error'
      // FK violation on feature_registry is the common case — surface a
      // helpful hint pointing at the reseed endpoint.
      const hint = message.includes('feature_registry')
        ? ' — run POST /api/admin/features/reseed to backfill the registry'
        : ''
      return NextResponse.json(
        { success: false, error: `Failed to persist feature flag: ${message}${hint}` },
        { status: 500 }
      )
    }

    logAudit({
      orgId: organizationId, userId, action: 'feature_enabled', actionCategory: 'settings',
      entityType: 'features', entityName: feature.name,
      newValues: { featureKey, status: feature.status, acknowledgeBeta },
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({
      success: true,
      feature: featureKey,
      status: feature.status,
      message: feature.status === 'beta'
        ? 'Feature enabled (Beta)'
        : feature.status === 'alpha'
        ? 'Feature enabled (Alpha - use with caution)'
        : 'Feature enabled',
    });
  } catch (error) {
    console.error('Error enabling feature:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to enable feature' },
      { status: 500 }
    );
  }
}
