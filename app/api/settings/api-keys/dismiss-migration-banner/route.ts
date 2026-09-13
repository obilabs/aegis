/**
 * POST /api/settings/api-keys/dismiss-migration-banner
 *
 * Admin acknowledges the org-wide "verify your migrated scopes"
 * banner. Stamps `organizations.migration_banner_dismissed_at` so the
 * banner stops rendering for everyone in the org. Per-key `migrated_at`
 * flags are untouched — admins still verify scopes per key via the
 * PATCH route with `acknowledge_migration: true`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/access'
import { queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { session, orgId } = ctx
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const row = await queryOne<{ migration_banner_dismissed_at: string }>(
      `UPDATE organizations
          SET migration_banner_dismissed_at = NOW()
        WHERE id = $1
        RETURNING migration_banner_dismissed_at`,
      [orgId],
    )

    return NextResponse.json({
      dismissedAt: row?.migration_banner_dismissed_at ?? null,
    })
  } catch (error) {
    console.error('Failed to dismiss migration banner:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss banner' },
      { status: 500 },
    )
  }
}
