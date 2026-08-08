import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    const templateResult = await pool.query(`
      SELECT ct.*, tc.name as category_name
      FROM checklist_templates ct
      LEFT JOIN ticket_categories tc ON ct.category_id = tc.id
      WHERE ct.id = $1 AND ct.organization_id = $2
    `, [id, orgId])

    if (templateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const itemsResult = await pool.query(`
      SELECT id, title, description, sort_order, is_required,
             service_category, default_assignee_type, default_assignee_id
      FROM checklist_template_items
      WHERE template_id = $1 AND organization_id = $2
      ORDER BY sort_order ASC
    `, [id, orgId])

    return NextResponse.json({
      template: templateResult.rows[0],
      items: itemsResult.rows,
    })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id } = await params
    const orgId = admin.orgId
    const body = await request.json()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Update template fields
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (body.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(body.name.trim())
      }
      if (body.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(body.description?.trim() || null)
      }
      if (body.category_id !== undefined) {
        updates.push(`category_id = $${paramIndex++}`)
        values.push(body.category_id || null)
      }
      if (body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        values.push(body.is_active)
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`)
        values.push(id, orgId)
        await client.query(
          `UPDATE checklist_templates SET ${updates.join(', ')}
           WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}`,
          values
        )
      }

      // Replace items if provided
      if (body.items && Array.isArray(body.items)) {
        await client.query(
          `DELETE FROM checklist_template_items WHERE template_id = $1 AND organization_id = $2`,
          [id, orgId]
        )
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i]
          if (!item.title?.trim()) continue
          await client.query(`
            INSERT INTO checklist_template_items (
              template_id, organization_id, title, description, sort_order,
              is_required, service_category, default_assignee_type, default_assignee_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            id, orgId, item.title.trim(), item.description?.trim() || null,
            i, item.is_required || false, item.service_category?.trim() || null,
            item.default_assignee_type || 'ticket_assignee', item.default_assignee_id || null,
          ])
        }
      }

      await client.query('COMMIT')
      return NextResponse.json({ success: true })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { id } = await params
    const orgId = admin.orgId

    const result = await pool.query(
      `DELETE FROM checklist_templates WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
