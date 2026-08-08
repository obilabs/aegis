import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthContext } from '@/lib/org';
import { isAdmin } from '@/lib/permissions';
import { FEATURES } from '@/lib/features';
import { logAudit, getClientIp } from '@/lib/audit';

// POST /api/features/disable - Disable a feature for the organization
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId, orgId: organizationId } = ctx;

    // Authorization (audit M1): toggling org feature flags is admin-only.
    if (!(await isAdmin(userId))) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { featureKey } = body;

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

    // Check if feature can be disabled
    if (!feature.canDisable) {
      return NextResponse.json({
        success: false,
        error: 'This feature cannot be disabled',
      });
    }

    // Try to disable via database function
    try {
      const result = await pool.query(
        `SELECT disable_feature($1, $2, $3) as result`,
        [organizationId, featureKey, userId]
      );
      
      const dbResult = result.rows[0]?.result;
      if (dbResult?.success) {
        logAudit({
          orgId: organizationId, userId, action: 'feature_disabled', actionCategory: 'settings',
          entityType: 'features', entityName: feature.name,
          newValues: { featureKey, enabled: false },
          actorIp: getClientIp(request.headers),
        })
        return NextResponse.json(dbResult);
      }
    } catch {
      // Database function might not exist, use direct insert
    }

    // Fallback: Direct insert/update
    try {
      await pool.query(
        `INSERT INTO organization_feature_flags (
          organization_id, feature_key, enabled
        ) VALUES ($1, $2, false)
        ON CONFLICT (organization_id, feature_key) DO UPDATE SET
          enabled = false,
          updated_at = NOW()`,
        [organizationId, featureKey]
      );
    } catch {
      // Table might not exist yet, that's okay
    }

    logAudit({
      orgId: organizationId, userId, action: 'feature_disabled', actionCategory: 'settings',
      entityType: 'features', entityName: feature.name,
      newValues: { featureKey, enabled: false },
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({
      success: true,
      feature: featureKey,
      message: 'Feature disabled',
    });
  } catch (error) {
    console.error('Error disabling feature:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disable feature' },
      { status: 500 }
    );
  }
}
