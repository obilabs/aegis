import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const result = await pool.query(`
      SELECT
        dr.id, dr.name, dr.description,
        dr.delegator_type, dr.delegator_id,
        CONCAT(u.first_name, ' ', u.last_name) as delegator_name,
        dr.action, dr.target_scope,
        dr.target_group_id,
        dr.requires_justification,
        dr.max_cost,
        dr.is_active,
        dr.starts_at, dr.ends_at,
        dr.created_at
      FROM delegation_rules dr
      LEFT JOIN users u ON dr.delegator_id = u.id
      WHERE dr.organization_id = $1
      ORDER BY dr.name ASC
    `, [orgId])

    return NextResponse.json({ rules: result.rows })
  } catch (error) {
    console.error('Error fetching delegation rules:', error)
    return NextResponse.json({ error: 'Failed to fetch delegation rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const body = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!body.delegator_type?.trim()) {
      return NextResponse.json({ error: 'Delegator type is required' }, { status: 400 })
    }
    if (!body.action?.trim()) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }
    if (!body.target_scope?.trim()) {
      return NextResponse.json({ error: 'Target scope is required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO delegation_rules (
        organization_id, name, description,
        delegator_type, delegator_id,
        action, target_scope, target_group_id,
        requires_justification, max_cost,
        is_active, starts_at, ends_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      orgId,
      body.name.trim(),
      body.description?.trim() || null,
      body.delegator_type.trim(),
      body.delegator_id || null,
      body.action.trim(),
      body.target_scope.trim(),
      body.target_group_id || null,
      body.requires_justification ?? false,
      body.max_cost ?? null,
      body.is_active ?? true,
      body.starts_at || null,
      body.ends_at || null,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating delegation rule:', error)
    return NextResponse.json({ error: 'Failed to create delegation rule' }, { status: 500 })
  }
}
