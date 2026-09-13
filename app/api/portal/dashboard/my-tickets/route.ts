import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'

/**
 * GET /api/portal/dashboard/my-tickets
 * Returns the user's open tickets (created by or assigned to), limited to 5 most recent.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  // App users.id (UUID) resolved from the session email; session.user.id is the
  // Better Auth id (not a UUID) and made every My Hub widget fail.
  const userId = await getUserId(session.user.email).catch(() => null)
  if (!userId) {
    return NextResponse.json({ error: 'No application user for this session' }, { status: 403 })
  }
  const userEmail = session.user.email

  try {
    // Get open tickets for the current user
    // "Open" = not in a closed base_status
    const result = await pool.query(`
      SELECT
        t.id,
        t.ticket_number,
        t.prefix,
        t.subject,
        t.priority,
        t.created_at,
        t.updated_at,
        ts.name as status_name,
        ts.color as status_color,
        ts.base_status
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE t.organization_id = $1
        AND (
          t.created_by = $2
          OR t.assigned_to = $2
          OR t.contact_id IN (
            SELECT id FROM contacts WHERE email = $3 AND organization_id = $1
          )
        )
        AND (ts.base_status IS NULL OR ts.base_status != 'closed')
      ORDER BY t.updated_at DESC
      LIMIT 5
    `, [orgId, userId, userEmail])

    // Also get total open count
    const countResult = await pool.query(`
      SELECT COUNT(*)::int as total
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE t.organization_id = $1
        AND (
          t.created_by = $2
          OR t.assigned_to = $2
          OR t.contact_id IN (
            SELECT id FROM contacts WHERE email = $3 AND organization_id = $1
          )
        )
        AND (ts.base_status IS NULL OR ts.base_status != 'closed')
    `, [orgId, userId, userEmail])

    return NextResponse.json({
      tickets: result.rows.map((t: any) => ({
        id: t.id,
        ticket_number: `${t.prefix}-${t.ticket_number}`,
        subject: t.subject,
        priority: t.priority,
        status: t.status_name,
        status_color: t.status_color,
        base_status: t.base_status,
        created_at: t.created_at,
        updated_at: t.updated_at,
      })),
      total: countResult.rows[0]?.total || 0,
    })
  } catch (error) {
    console.error('My tickets fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}
