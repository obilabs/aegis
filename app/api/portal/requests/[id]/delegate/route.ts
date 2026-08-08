import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { id } = await params
    const body = await request.json()
    const { delegate_to } = body

    if (!delegate_to) {
      return NextResponse.json({ error: 'Delegate user is required' }, { status: 400 })
    }

    // Verify request exists and is pending
    const reqResult = await pool.query(
      `SELECT id, status FROM service_requests
       WHERE id = $1 AND organization_id = $2 AND status = 'pending_approval'`,
      [id, orgId]
    )

    if (reqResult.rows.length === 0) {
      return NextResponse.json({ error: 'Request not found or not pending' }, { status: 404 })
    }

    // Verify delegate user exists in the same org
    const userResult = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
      [delegate_to, orgId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Delegate user not found' }, { status: 404 })
    }

    // Update the request notes to track delegation
    await pool.query(
      `UPDATE service_requests
       SET notes = COALESCE(notes, '') || E'\nDelegated by ' || $3 || ' to user ' || $4 || ' at ' || NOW()::text,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId, session.user.email, delegate_to]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error delegating request:', error)
    return NextResponse.json({ error: 'Failed to delegate request' }, { status: 500 })
  }
}
