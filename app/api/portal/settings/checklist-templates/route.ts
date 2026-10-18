import { pool } from '@/lib/db'
import { requireStaff } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx
    const activeOnly = request.nextUrl.searchParams.get('active') !== 'false'

    const result = await pool.query(`
      SELECT
        ct.id,
        ct.name,
        ct.description,
        ct.category_id,
        ct.is_active,
        ct.created_at,
        tc.name as category_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        (SELECT COUNT(*) FROM checklist_template_items cti WHERE cti.template_id = ct.id) as item_count
      FROM checklist_templates ct
      LEFT JOIN ticket_categories tc ON ct.category_id = tc.id
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.organization_id = $1
        ${activeOnly ? 'AND ct.is_active = true' : ''}
      ORDER BY ct.name ASC
    `, [orgId])

    return NextResponse.json({ templates: result.rows })
  } catch (error) {
    console.error('Error fetching checklist templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const userId = admin.userId
    const orgId = admin.orgId
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const templateResult = await client.query(`
        INSERT INTO checklist_templates (organization_id, name, description, category_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, category_id, is_active, created_at
      `, [orgId, body.name.trim(), body.description?.trim() || null, body.category_id || null, userId])

      const template = templateResult.rows[0]

      // Insert items if provided
      if (body.items && Array.isArray(body.items)) {
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i]
          if (!item.title?.trim()) continue
          await client.query(`
            INSERT INTO checklist_template_items (
              template_id, organization_id, title, description, sort_order,
              is_required, service_category, default_assignee_type, default_assignee_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            template.id, orgId, item.title.trim(), item.description?.trim() || null,
            i, item.is_required || false, item.service_category?.trim() || null,
            item.default_assignee_type || 'ticket_assignee', item.default_assignee_id || null,
          ])
        }
      }

      await client.query('COMMIT')
      return NextResponse.json(template, { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating checklist template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
