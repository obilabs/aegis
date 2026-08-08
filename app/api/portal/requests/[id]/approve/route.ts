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

    // Authorization (audit 2026-07-23): approving a service request is a
    // triage/workflow action. Without this any authenticated user could
    // approve any pending request — including their own.
    if (!(await hasCapabilityOrAdmin(userId, 'triage'))) {
      return NextResponse.json({ error: 'Requires triage capability' }, { status: 403 })
    }

    const { id } = await params

    // Verify request exists and is pending approval
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

    // Approve the request
    await pool.query(
      `UPDATE service_requests
       SET status = 'approved', approved_by = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId, userId]
    )

    // Create fulfillment ticket
    try {
      const { createFulfillmentTicket } = await import('@/lib/fulfillment')
      await createFulfillmentTicket(id, orgId)
    } catch (err) {
      console.error('Error creating fulfillment ticket:', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error approving request:', error)
    return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 })
  }
}
