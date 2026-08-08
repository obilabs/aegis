import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

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
        CONCAT(c.first_name, ' ', c.last_name) as assigned_to,
        c.is_deleted as contact_is_deleted,
        COALESCE(l.name, a.physical_location) as location,
        a.primary_ip,
        a.os,
        a.warranty_expire,
        a.updated_at
      FROM assets a
      LEFT JOIN asset_types at ON a.type_id = at.id
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.organization_id = $1
        AND a.is_deleted = false
      ORDER BY a.updated_at DESC
    `, [orgId])

    return NextResponse.json({ assets: result.rows })
  } catch (error) {
    console.error('Error fetching assets:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}
