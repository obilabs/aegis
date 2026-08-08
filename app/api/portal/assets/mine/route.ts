import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/assets/mine
 * Return assets assigned to the current user's contact record.
 * Used for auto-populating asset links on ticket creation.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const userId = await getUserId(session.user.email)

    // Find the contact record linked to this user
    const contactResult = await pool.query(
      'SELECT id FROM contacts WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
      [orgId, userId]
    )

    if (contactResult.rows.length === 0) {
      // User has no contact record — return empty list
      return NextResponse.json({ assets: [] })
    }

    const contactId = contactResult.rows[0].id

    // Fetch assets assigned to this contact
    const assetsResult = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.asset_tag,
        a.serial_number,
        a.status,
        a.hostname,
        at.name as type_name,
        at.icon as type_icon
      FROM assets a
      LEFT JOIN asset_types at ON a.type_id = at.id
      WHERE a.organization_id = $1
        AND a.contact_id = $2
        AND a.status IN ('active', 'deployed')
      ORDER BY a.name ASC
    `, [orgId, contactId])

    return NextResponse.json({ assets: assetsResult.rows })
  } catch (error) {
    console.error('Error fetching user assets:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}
