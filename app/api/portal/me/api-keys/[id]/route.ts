/**
 * Self-service revoke for personal API keys.
 *
 * DELETE /api/portal/me/api-keys/[id] — revoke (is_active=false) a
 * personal key owned by THIS user.
 *
 * Ownership is enforced by the WHERE clause: key_type='personal' AND
 * key_owner_user_id = currentUser. A user trying to revoke someone
 * else's key (or an org-owned admin-issued key) gets 404 — we don't
 * disclose the existence of keys outside their scope.
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

function isNoOrgError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('No organization found')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId, orgId } = ctx
    const { id } = await params

    const row = await queryOne(
      `UPDATE api_keys
          SET is_active = false
        WHERE id = $1
          AND organization_id = $2
          AND key_type = 'personal'
          AND key_owner_user_id = $3
        RETURNING id, name, is_active`,
      [id, orgId, userId],
    )

    if (!row) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'API key revoked', ...row })
  } catch (error) {
    if (isNoOrgError(error)) {
      return NextResponse.json({ error: 'Setup not completed' }, { status: 412 })
    }
    console.error('Failed to revoke personal API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
}
