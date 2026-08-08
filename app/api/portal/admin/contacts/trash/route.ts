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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const offset = (page - 1) * limit

    let whereClause = 'c.organization_id = $1 AND c.is_deleted = true'
    const values: any[] = [orgId]
    let paramIndex = 2

    if (search) {
      whereClause += ` AND (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`
      values.push(`%${search}%`)
      paramIndex++
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contacts c WHERE ${whereClause}`,
      values
    )

    values.push(limit, offset)
    const result = await pool.query(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.contact_type,
              c.deleted_at, c.deleted_by_name, c.deleted_by_user_id, c.delete_reason,
              c.legal_hold,
              u.name as deleted_by_user_name
       FROM contacts c
       LEFT JOIN "user" u ON c.deleted_by_user_id::text = u.id
       WHERE ${whereClause}
       ORDER BY c.deleted_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    )

    return NextResponse.json({
      contacts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    })
  } catch (error) {
    console.error('Error fetching deleted contacts:', error)
    return NextResponse.json({ error: 'Failed to fetch deleted contacts' }, { status: 500 })
  }
}
