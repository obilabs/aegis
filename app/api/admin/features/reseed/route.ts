/**
 * POST /api/admin/features/reseed
 *
 * Rebuilds the feature_registry table from the FEATURES constant in
 * lib/features.ts. Idempotent — ON CONFLICT DO UPDATE means existing
 * rows get their metadata refreshed, new rows get inserted.
 *
 * Use case: after adding a new feature to features.ts, or after
 * discovering an install whose registry was never seeded on setup
 * (which was every install prior to the setup/complete fix that
 * shipped with this route).
 *
 * Admin-only. Writes an audit row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { seedFeatureRegistry } from '@/lib/seed-feature-registry'
import { logAudit, getClientIp } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { session, orgId, userId } = ctx
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const result = await seedFeatureRegistry()
    logAudit({
      orgId,
      userId,
      action: 'feature_registry_reseed',
      actionCategory: 'settings',
      entityType: 'features',
      entityName: 'feature_registry',
      newValues: result,
      actorIp: getClientIp(request.headers),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Reseed failed' },
      { status: 500 },
    )
  }
}
