import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const { id } = await params
    const body = await request.json()

    const allowedFields: Record<string, string> = {
      name: 'name',
      slug: 'slug',
      short_description: 'short_description',
      description: 'description',
      icon: 'icon',
      category_id: 'category_id',
      requires_approval: 'requires_approval',
      request_form: 'request_form',
      estimated_fulfillment_days: 'estimated_fulfillment_days',
      fulfillment_instructions: 'fulfillment_instructions',
      auto_category: 'auto_category',
      auto_subcategory: 'auto_subcategory',
      application_id: 'application_id',
      owner_id: 'owner_id',
      display_order: 'display_order',
      is_active: 'is_active',
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 3

    for (const [key, column] of Object.entries(allowedFields)) {
      if (key in body) {
        let value = body[key]
        if (key === 'request_form' && typeof value !== 'string') {
          value = JSON.stringify(value)
        }
        updates.push(`${column} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)

    const result = await pool.query(
      `UPDATE catalog_items SET ${updates.join(', ')}
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, orgId, ...values]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating catalog item:', error)
    return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const { id } = await params

    const result = await pool.query(
      `UPDATE catalog_items SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating catalog item:', error)
    return NextResponse.json({ error: 'Failed to deactivate catalog item' }, { status: 500 })
  }
}
