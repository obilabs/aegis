import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(
      `SELECT id, name, description, icon, color, display_order, is_active,
              description_template, subject_prefix, parent_id, depth,
              created_at, updated_at
       FROM ticket_categories
       WHERE organization_id = $1
       ORDER BY depth ASC, display_order ASC, name ASC`,
      [orgId]
    )

    // Also fetch the max depth setting
    const settingResult = await pool.query(
      `SELECT value FROM site_settings WHERE organization_id = $1 AND key = 'max_category_depth'`,
      [orgId]
    )
    const maxDepth = settingResult.rows[0]?.value ? parseInt(settingResult.rows[0].value) : 1

    return NextResponse.json({ categories: result.rows, max_depth: maxDepth })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  description_template: z.string().nullable().optional(),
  subject_prefix: z.string().max(50).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    let depth = 0

    if (data.parent_id) {
      // Validate parent exists and get its depth
      const parent = await pool.query(
        'SELECT id, depth FROM ticket_categories WHERE id = $1 AND organization_id = $2',
        [data.parent_id, orgId]
      )
      if (parent.rows.length === 0) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 })
      }
      depth = parent.rows[0].depth + 1

      // Check max depth setting
      const settingResult = await pool.query(
        `SELECT value FROM site_settings WHERE organization_id = $1 AND key = 'max_category_depth'`,
        [orgId]
      )
      const maxDepth = settingResult.rows[0]?.value ? parseInt(settingResult.rows[0].value) : 1
      if (depth > maxDepth) {
        return NextResponse.json({ error: `Maximum category depth is ${maxDepth}` }, { status: 400 })
      }
    }

    // Get next display order within the same parent level
    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
       FROM ticket_categories
       WHERE organization_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [orgId, data.parent_id || null]
    )

    const result = await pool.query(
      `INSERT INTO ticket_categories (organization_id, name, description, icon, color, parent_id, depth,
         display_order, description_template, subject_prefix)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orgId,
        data.name.trim(),
        data.description?.trim() || null,
        data.icon || null,
        data.color || null,
        data.parent_id || null,
        depth,
        orderResult.rows[0].next_order,
        data.description_template?.trim() || null,
        data.subject_prefix?.trim() || null,
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A category with this name already exists at this level' }, { status: 409 })
    }
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
