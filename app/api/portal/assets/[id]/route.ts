import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { id } = await params

    const result = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.asset_tag,
        COALESCE(at.name, a.type_id::text) as type,
        a.make,
        a.model,
        a.serial_number,
        a.status,
        a.primary_ip,
        a.primary_mac AS mac_address,
        a.os,
        a.purchase_date,
        a.warranty_expire,
        a.install_date,
        a.notes,
        a.contact_id,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.is_deleted as contact_is_deleted,
        c.email as contact_email,
        c.phone as contact_phone,
        a.company_id,
        co.name as company_name,
        a.location_id,
        COALESCE(l.name, a.physical_location) as location_name,
        l.address as location_address,
        a.created_at,
        a.updated_at
      FROM assets a
      LEFT JOIN asset_types at ON a.type_id = at.id
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN companies co ON a.company_id = co.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = $1
        AND a.organization_id = $2
        AND a.is_deleted = false
    `, [id, orgId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Get related tickets
    const tickets = await pool.query(`
      SELECT t.id, t.ticket_number, t.prefix, t.subject, ts.name as status, ts.color as status_color, t.created_at
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      WHERE t.asset_id = $1 AND t.organization_id = $2
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [id, orgId])

    return NextResponse.json({
      ...result.rows[0],
      tickets: tickets.rows,
    })
  } catch (error) {
    console.error('Error fetching asset:', error)
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
}
