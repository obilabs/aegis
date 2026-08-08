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

    // Get catalog items with category info
    const items = await pool.query(`
      SELECT
        ci.id, ci.name, ci.slug, ci.short_description, ci.description,
        ci.icon, ci.image_url, ci.requires_approval,
        ci.estimated_fulfillment_days, ci.has_cost, ci.cost_amount,
        ci.display_order, ci.auto_category,
        sc.id as category_id, sc.name as category_name, sc.icon as category_icon
      FROM catalog_items ci
      LEFT JOIN service_categories sc ON ci.category_id = sc.id
      WHERE ci.organization_id = $1
        AND ci.is_active = true
        AND ci.is_requestable = true
      ORDER BY sc.display_order ASC, ci.display_order ASC, ci.name ASC
    `, [orgId])

    // Get categories for filtering
    const categories = await pool.query(`
      SELECT id, name, icon, display_order
      FROM service_categories
      WHERE organization_id = $1
      ORDER BY display_order ASC
    `, [orgId])

    return NextResponse.json({
      items: items.rows,
      categories: categories.rows,
    })
  } catch (error) {
    console.error('Error fetching catalog:', error)
    return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })
  }
}
