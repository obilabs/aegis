/**
 * GET /api/settings/api-keys/[id]/cascade-preview
 *
 * Returns the read-only counts the confirmation modal shows before
 * the admin commits: how many child keys, msp_provisioned users,
 * live sessions, and (safe-to-keep) customer_linked_to_msp users
 * are on this pairing.
 *
 * Admin-only. Zero side effects.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/access'
import { auth } from '@/lib/auth'
import { getOrgId } from '@/lib/org'
import { queryOne } from '@/lib/db'
import { previewCascade } from '@/lib/cascade-revoke'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { id: pairingKeyId } = await params
  const orgId = await getOrgId()

  const target = await queryOne<{ key_type: string; name: string }>(
    `SELECT key_type, name FROM api_keys
      WHERE id = $1 AND organization_id = $2`,
    [pairingKeyId, orgId],
  )
  if (!target) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }
  if (target.key_type !== 'aegis-mtp-pairing') {
    return NextResponse.json(
      { error: 'Cascade preview only applies to aegis-mtp-pairing keys' },
      { status: 400 },
    )
  }

  const preview = await previewCascade({ pairingKeyId, orgId })
  return NextResponse.json({ ...preview, pairing_name: target.name })
}
