import { requireScope } from '@/lib/require-scope'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await requireScope(request, 'assets:read')
  if (ctx instanceof NextResponse) return ctx

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)))
    const offset = (page - 1) * perPage
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')

    const conditions: string[] = ['a.organization_id = $1', 'a.is_deleted = false']
    const values: (string | number)[] = [ctx.orgId]
    let idx = 2

    if (status) {
      conditions.push(`a.status = $${idx++}`)
      values.push(status)
    }
    if (type) {
      conditions.push(`at.name ILIKE $${idx++}`)
      values.push(type)
    }

    const where = conditions.join(' AND ')

    const [assetsResult, countResult] = await Promise.all([
      pool.query(`
        SELECT
          a.id, a.name, a.asset_tag, a.serial_number,
          a.make, a.model, a.status, a.primary_ip, a.os,
          a.warranty_expire, a.created_at, a.updated_at,
          COALESCE(at.name, a.type_id::text) as type,
          CONCAT(c.first_name, ' ', c.last_name) as assigned_to,
          c.email as assigned_email,
          COALESCE(l.name, a.physical_location) as location
        FROM assets a
        LEFT JOIN asset_types at ON a.type_id = at.id
        LEFT JOIN contacts c ON a.contact_id = c.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE ${where}
        ORDER BY a.updated_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `, [...values, perPage, offset]),
      pool.query(`
        SELECT COUNT(*)::int as total
        FROM assets a
        LEFT JOIN asset_types at ON a.type_id = at.id
        WHERE ${where}
      `, values),
    ])

    return NextResponse.json({
      data: assetsResult.rows,
      meta: {
        page,
        per_page: perPage,
        total: countResult.rows[0].total,
        total_pages: Math.ceil(countResult.rows[0].total / perPage),
      },
    })
  } catch (error) {
    console.error('v1 assets GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
