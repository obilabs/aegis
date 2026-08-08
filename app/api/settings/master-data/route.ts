import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

const BOOLEAN_FIELDS = [
  'enforce_departments',
  'enforce_locations',
  'enforce_job_titles',
  'enforce_asset_types',
  'enforce_asset_models',
  'enforce_vendors',
  'enforce_operating_systems',
  'allow_inline_creation',
  'departments_migrated',
  'locations_migrated',
  'job_titles_migrated',
] as const

const DEFAULTS = Object.fromEntries(BOOLEAN_FIELDS.map(f => [f, false]))

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx

    const result = await pool.query(
      `SELECT * FROM master_data_settings WHERE organization_id = $1`,
      [orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ settings: { organization_id: orgId, ...DEFAULTS } })
    }

    return NextResponse.json({ settings: result.rows[0] })
  } catch (error) {
    console.error('Error fetching master data settings:', error)
    return NextResponse.json({ error: 'Failed to fetch master data settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, orgId } = ctx

    // Authorization (audit M1): mutating org master-data config is admin-only.
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()

    // Filter to only accepted boolean fields
    const fields: string[] = []
    const values: any[] = []
    let paramIndex = 2 // $1 is organization_id

    for (const field of BOOLEAN_FIELDS) {
      if (body[field] !== undefined) {
        fields.push(field)
        values.push(!!body[field])
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const insertColumns = ['organization_id', ...fields, 'updated_by'].join(', ')
    const insertValues = ['$1', ...fields.map((_, i) => `$${i + 2}`), `$${fields.length + 2}`].join(', ')
    const updateSet = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')

    const result = await pool.query(
      `INSERT INTO master_data_settings (${insertColumns})
       VALUES (${insertValues})
       ON CONFLICT (organization_id) DO UPDATE SET ${updateSet}, updated_at = NOW(), updated_by = $${fields.length + 2}
       RETURNING *`,
      [orgId, ...values, userId]
    )

    return NextResponse.json({ settings: result.rows[0] })
  } catch (error) {
    console.error('Error updating master data settings:', error)
    return NextResponse.json({ error: 'Failed to update master data settings' }, { status: 500 })
  }
}
