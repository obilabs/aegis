/**
 * GET /api/portal/telemetry-consent-banner
 *
 * Should the portal layout show the retroactive consent banner?
 *
 * Returns true when ALL of the following are true:
 *   - The user is authenticated
 *   - The org has NO non-retroactive consent log row (i.e., no real
 *     operator has confirmed or changed since the consent feature
 *     shipped — only the backfill row exists, if any)
 *   - The TELEMETRY_ENABLED env var is NOT explicitly false (if it is,
 *     the operator already made the choice at deploy time; banner adds
 *     no value)
 *
 * Admin gating is done client-side in the layout (banner only rendered
 * when permissions.adminAccess). The endpoint itself is session-only
 * because non-admins still need a 200 response so the layout doesn't
 * throw.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'
import { hasExplicitConsentChoice } from '@/lib/telemetry-consent'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ show: false })
  }

  // Env var overriding → no banner; the operator's already on the record
  // via the deploy-time env, banner would be noise.
  if (process.env.TELEMETRY_ENABLED === 'false') {
    return NextResponse.json({ show: false })
  }

  const hasChoice = await hasExplicitConsentChoice(ctx.orgId)
  return NextResponse.json({ show: !hasChoice })
}
