import { pool } from '@/lib/db'
import { requireUser, allows } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Staff, or the person who raised the request; anyone else reads not found.
    const ctx = await requireUser(request)
    if (ctx instanceof NextResponse) return ctx

    const { orgId } = ctx
    const isStaff = allows(ctx.perms, { level: 'staff' })
    const { id } = await params

    const result = await pool.query(`
      SELECT
        sr.id, sr.request_number, sr.status, sr.priority,
        sr.form_responses, sr.justification, sr.quantity,
        sr.submitted_at, sr.approved_at, sr.rejected_at, sr.fulfilled_at,
        sr.rejection_reason, sr.fulfillment_notes, sr.ticket_id,
        sr.cancelled_at, sr.total_cost,
        ci.name as item_name, ci.slug as item_slug, ci.description as item_description,
        ci.icon as item_icon, ci.requires_approval, ci.request_form,
        ci.estimated_fulfillment_days,
        CONCAT(req.first_name, ' ', req.last_name) as requester_name,
        req.email as requester_email, COALESCE((SELECT d.name FROM departments d WHERE d.id = req.department_id), req.department_legacy) as requester_department,
        req.title as requester_title,
        CONCAT(approver.name) as approved_by_name,
        CONCAT(rejector.name) as rejected_by_name
      FROM service_requests sr
      JOIN catalog_items ci ON sr.catalog_item_id = ci.id
      LEFT JOIN contacts req ON sr.requester_id = req.id
      LEFT JOIN "user" approver ON sr.approved_by::text = approver.id
      LEFT JOIN "user" rejector ON sr.rejected_by::text = rejector.id
      WHERE sr.id = $1 AND sr.organization_id = $2
        AND ($3::boolean OR sr.requester_id = (SELECT contact_id FROM users WHERE id = $4))
    `, [id, orgId, isStaff, ctx.userId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching request:', error)
    return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireUser(request)
    if (ctx instanceof NextResponse) return ctx

    const { userId, orgId } = ctx
    const isStaff = allows(ctx.perms, { level: 'staff' })
    const { id } = await params
    const body = await request.json()

    // Only allow cancellation of pending requests
    if (body.action === 'cancel') {
      const result = await pool.query(
        `UPDATE service_requests
         SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $3, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND status = 'pending_approval'
           AND ($4::boolean OR requester_id = (SELECT contact_id FROM users WHERE id = $3))
         RETURNING id`,
        [id, orgId, userId, isStaff]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Request not found or cannot be cancelled' }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating request:', error)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}
