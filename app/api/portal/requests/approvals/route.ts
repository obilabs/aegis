import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET pending approvals for the current user.
 * Returns requests where the current user is an approver (manager, admin, or service owner).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const url = new URL(request.url)
    const countOnly = url.searchParams.get('count_only') === 'true'

    if (countOnly) {
      // For dashboard widget — just return the count
      const countResult = await pool.query(
        `SELECT COUNT(*)::int as count
         FROM service_requests
         WHERE organization_id = $1 AND status = 'pending_approval'`,
        [orgId]
      )
      return NextResponse.json({ count: countResult.rows[0].count })
    }

    // Get all pending approvals for this org
    // In v1, any admin/manager can approve. Future: approval workflow routing.
    const result = await pool.query(`
      SELECT
        sr.id, sr.request_number, sr.status, sr.priority,
        sr.form_responses, sr.justification, sr.submitted_at,
        sr.total_cost,
        ci.name as item_name, ci.slug as item_slug, ci.icon as item_icon,
        ci.requires_approval,
        CONCAT(req.first_name, ' ', req.last_name) as requester_name,
        req.email as requester_email,
        req.department as requester_department,
        req.title as requester_title
      FROM service_requests sr
      JOIN catalog_items ci ON sr.catalog_item_id = ci.id
      LEFT JOIN contacts req ON sr.requester_id = req.id
      WHERE sr.organization_id = $1
        AND sr.status = 'pending_approval'
      ORDER BY sr.submitted_at ASC
    `, [orgId])

    return NextResponse.json({ approvals: result.rows })
  } catch (error) {
    console.error('Error fetching approvals:', error)
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 })
  }
}
