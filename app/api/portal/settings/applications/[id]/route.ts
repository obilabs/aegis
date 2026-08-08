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

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fields = ['name', 'description', 'icon_url', 'owner_id', 'provisioning_notes',
                    'cost_per_license', 'license_type', 'vendor_id', 'requires_approval',
                    'approval_levels', 'is_active']

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`)
        values.push(body[field])
      }
    }

    if (body.access_levels !== undefined) {
      updates.push(`access_levels = $${paramIndex++}`)
      values.push(JSON.stringify(body.access_levels))
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    await pool.query(
      `UPDATE applications SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
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

    await pool.query(
      `UPDATE applications SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating application:', error)
    return NextResponse.json({ error: 'Failed to deactivate application' }, { status: 500 })
  }
}
