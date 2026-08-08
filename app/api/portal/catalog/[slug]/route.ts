import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const { slug } = await params

    const result = await pool.query(`
      SELECT
        ci.id, ci.name, ci.slug, ci.short_description, ci.description,
        ci.icon, ci.image_url, ci.requires_approval,
        ci.estimated_fulfillment_days, ci.has_cost, ci.cost_amount,
        ci.currency_code, ci.request_form, ci.fulfillment_instructions,
        ci.auto_category, ci.auto_subcategory, ci.application_id,
        sc.name as category_name
      FROM catalog_items ci
      LEFT JOIN service_categories sc ON ci.category_id = sc.id
      WHERE ci.organization_id = $1
        AND ci.slug = $2
        AND ci.is_active = true
    `, [orgId, slug])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching catalog item:', error)
    return NextResponse.json({ error: 'Failed to fetch catalog item' }, { status: 500 })
  }
}
