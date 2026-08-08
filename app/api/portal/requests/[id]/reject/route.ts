import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx

    // Authorization (audit 2026-07-23): rejecting a service request is a
    // triage/workflow action.
    if (!(await hasCapabilityOrAdmin(userId, 'triage'))) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Verify request exists and is pending
    const reqResult = await pool.query(
      `SELECT id, status FROM service_requests
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    if (reqResult.rows.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (reqResult.rows[0].status !== 'pending_approval') {
      return NextResponse.json({ error: 'Request is not pending approval' }, { status: 400 })
    }

    await pool.query(
      `UPDATE service_requests
       SET status = 'rejected', rejected_by = $3, rejected_at = NOW(),
           rejection_reason = $4, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId, userId, reason.trim()]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error rejecting request:', error)
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 })
  }
}
