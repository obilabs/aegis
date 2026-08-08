import { requireScope } from '@/lib/require-scope'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await requireScope(request, 'contacts:read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)))
    const offset = (page - 1) * perPage
    const type = url.searchParams.get('type')
    const search = url.searchParams.get('search')
    const includeDeleted = url.searchParams.get('include_deleted') === 'true'

    const conditions: string[] = ['c.organization_id = $1']

    if (!includeDeleted) {
      conditions.push('c.is_deleted = false')
    }
    const values: (string | number)[] = [ctx.orgId]
    let idx = 2

    if (type) {
      conditions.push(`c.contact_type = $${idx++}`)
      values.push(type)
    }
    if (search) {
      conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.email ILIKE $${idx})`)
      values.push(`%${search}%`)
      idx++
    }

    const where = conditions.join(' AND ')

    const [contactsResult, countResult] = await Promise.all([
      pool.query(`
        SELECT
          c.id, c.first_name, c.last_name, c.email, c.phone,
          c.contact_type, c.job_title, c.department_legacy as department,
          c.is_active, c.is_deleted, c.deleted_at, c.created_at, c.updated_at,
          cl.name as company_name
        FROM contacts c
        LEFT JOIN companies cl ON c.company_id = cl.id
        WHERE ${where}
        ORDER BY c.last_name ASC, c.first_name ASC
        LIMIT $${idx++} OFFSET $${idx++}
      `, [...values, perPage, offset]),
      pool.query(`
        SELECT COUNT(*)::int as total FROM contacts c WHERE ${where}
      `, values),
    ])

    return NextResponse.json({
      data: contactsResult.rows,
      meta: {
        page,
        per_page: perPage,
        total: countResult.rows[0].total,
        total_pages: Math.ceil(countResult.rows[0].total / perPage),
      },
    })
  } catch (error) {
    console.error('v1 contacts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
