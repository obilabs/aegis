import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    // By type
    const byType = await query(
      `SELECT COALESCE(at.name, 'Untyped') AS type, COUNT(*)::int AS count,
        COALESCE(SUM(a.purchase_cost), 0)::numeric AS total_value
       FROM assets a
       LEFT JOIN asset_types at ON a.type_id = at.id
       WHERE a.organization_id = $1 AND a.is_deleted = false
       GROUP BY at.name
       ORDER BY count DESC`,
      [orgId]
    )

    // By status
    const byStatus = await query(
      `SELECT COALESCE(a.status, 'unknown') AS status, COUNT(*)::int AS count
       FROM assets a
       WHERE a.organization_id = $1 AND a.is_deleted = false
       GROUP BY a.status
       ORDER BY count DESC`,
      [orgId]
    )

    // By company
    const byCompany = await query(
      `SELECT COALESCE(c.name, 'Unassigned') AS company, COUNT(*)::int AS count
       FROM assets a
       LEFT JOIN companies c ON a.company_id = c.id
       WHERE a.organization_id = $1 AND a.is_deleted = false
       GROUP BY c.name
       ORDER BY count DESC
       LIMIT 20`,
      [orgId]
    )

    // Totals
    const totals = await query(
      `SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(a.purchase_cost), 0)::numeric AS total_value,
        COUNT(*) FILTER (WHERE a.warranty_expire < NOW())::int AS warranty_expired,
        COUNT(*) FILTER (WHERE a.warranty_expire BETWEEN NOW() AND NOW() + interval '30 days')::int AS warranty_expiring
       FROM assets a
       WHERE a.organization_id = $1 AND a.is_deleted = false`,
      [orgId]
    )

    return NextResponse.json({
      report: {
        totals: totals[0] || { total: 0, total_value: 0, warranty_expired: 0, warranty_expiring: 0 },
        byType,
        byStatus,
        byCompany,
      },
    })
  } catch (error) {
    console.error('Failed to generate asset inventory:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}
