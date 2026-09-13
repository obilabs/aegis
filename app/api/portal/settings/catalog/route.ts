import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET all catalog items for admin management (including inactive).
 * POST to create a new catalog item.
 */
export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(`
      SELECT
        ci.id, ci.name, ci.slug, ci.short_description, ci.description,
        ci.icon, ci.display_order, ci.is_active, ci.requires_approval,
        ci.request_form, ci.estimated_fulfillment_days, ci.fulfillment_instructions,
        ci.auto_category, ci.auto_subcategory, ci.application_id, ci.owner_id,
        ci.created_at,
        sc.name as category_name,
        CONCAT(u.name) as owner_name
      FROM catalog_items ci
      LEFT JOIN service_categories sc ON ci.category_id = sc.id
      LEFT JOIN "user" u ON ci.owner_id::text = u.id
      WHERE ci.organization_id = $1
      ORDER BY ci.display_order ASC, ci.name ASC
    `, [orgId])

    // Also get categories for the form dropdown
    const categories = await pool.query(
      `SELECT id, name FROM service_categories WHERE organization_id = $1 ORDER BY display_order ASC, name ASC`,
      [orgId]
    )

    return NextResponse.json({
      items: result.rows,
      categories: categories.rows,
    })
  } catch (error) {
    console.error('Error fetching catalog items:', error)
    return NextResponse.json({ error: 'Failed to fetch catalog items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()

    const {
      name, slug, short_description, description, icon,
      category_id, requires_approval, request_form,
      estimated_fulfillment_days, fulfillment_instructions,
      auto_category, auto_subcategory, application_id, owner_id,
      display_order,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug if not provided
    const itemSlug = slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Check for duplicate slug
    const existing = await pool.query(
      `SELECT id FROM catalog_items WHERE organization_id = $1 AND slug = $2`,
      [orgId, itemSlug]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'A catalog item with this slug already exists' }, { status: 409 })
    }

    const result = await pool.query(`
      INSERT INTO catalog_items (
        organization_id, name, slug, short_description, description, icon,
        category_id, requires_approval, request_form,
        estimated_fulfillment_days, fulfillment_instructions,
        auto_category, auto_subcategory, application_id, owner_id,
        display_order, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
      RETURNING id
    `, [
      orgId, name.trim(), itemSlug,
      short_description || null, description || null, icon || null,
      category_id || null, requires_approval ?? false,
      JSON.stringify(request_form || []),
      estimated_fulfillment_days || null, fulfillment_instructions || null,
      auto_category || null, auto_subcategory || null,
      application_id || null, owner_id || null,
      display_order ?? 0,
    ])

    return NextResponse.json({ id: result.rows[0].id }, { status: 201 })
  } catch (error) {
    console.error('Error creating catalog item:', error)
    return NextResponse.json({ error: 'Failed to create catalog item' }, { status: 500 })
  }
}
