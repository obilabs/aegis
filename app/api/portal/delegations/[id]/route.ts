import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/portal/delegations/[id]
 *
 * Cancel a delegation early. Only the delegator or an admin can cancel.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    const itsmUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get delegation
    const delegation = await queryOne<{ delegator_id: string; is_active: boolean }>(
      `SELECT delegator_id, is_active FROM user_delegations
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (!delegation) {
      return NextResponse.json({ error: 'Delegation not found' }, { status: 404 })
    }

    if (!delegation.is_active) {
      return NextResponse.json({ error: 'Delegation already cancelled' }, { status: 400 })
    }

    // Only delegator or admin can cancel
    const userIsAdmin = await isAdmin(itsmUser.id)
    if (delegation.delegator_id !== itsmUser.id && !userIsAdmin) {
      return NextResponse.json({ error: 'Only the delegator or an admin can cancel' }, { status: 403 })
    }

    await queryOne(
      `UPDATE user_delegations
       SET is_active = false, cancelled_at = NOW(), cancelled_by = $1
       WHERE id = $2
       RETURNING id`,
      [itsmUser.id, id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling delegation:', error)
    return NextResponse.json({ error: 'Failed to cancel delegation' }, { status: 500 })
  }
}
