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
        u.id,
        u.first_name,
        u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email,
        u.role,
        u.is_active,
        u.contact_id,
        c.contact_type,
        c.phone as contact_phone,
        c.mobile as contact_mobile,
        c.company_id,
        co.name as company_name,
        c.department_id,
        d.name as department_name,
        c.job_title_id,
        jt.name as job_title_name,
        c.location_id,
        l.name as location_name
      FROM users u
      LEFT JOIN contacts c ON u.contact_id = c.id
      LEFT JOIN companies co ON c.company_id = co.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN job_titles jt ON c.job_title_id = jt.id
      LEFT JOIN locations l ON c.location_id = l.id
      WHERE u.organization_id = $1 AND u.is_active = true
      ORDER BY u.first_name ASC, u.last_name ASC
    `, [orgId])

    return NextResponse.json({ users: result.rows })
  } catch (error) {
    console.error('Error fetching people:', error)
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 })
  }
}
