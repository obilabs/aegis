import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = ctx
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    let queryText = `
      SELECT
        dt.id,
        dt.delegator_id,
        CONCAT(u1.first_name, ' ', u1.last_name) as delegator_name,
        u1.email as delegator_email,
        dt.delegate_id,
        CONCAT(u2.first_name, ' ', u2.last_name) as delegate_name,
        u2.email as delegate_email,
        dt.delegation_type,
        dt.actions,
        dt.starts_at, dt.ends_at,
        dt.notify_on_action,
        dt.reason,
        dt.is_active,
        dt.created_at
      FROM delegation_transfers dt
      JOIN users u1 ON dt.delegator_id = u1.id
      JOIN users u2 ON dt.delegate_id = u2.id
      WHERE dt.organization_id = $1
    `

    if (activeOnly) {
      queryText += ` AND dt.is_active = true AND dt.starts_at <= NOW() AND dt.ends_at >= NOW()`
    }

    queryText += ` ORDER BY dt.starts_at DESC`

    const result = await pool.query(queryText, [orgId])

    return NextResponse.json({ transfers: result.rows })
  } catch (error) {
    console.error('Error fetching delegation transfers:', error)
    return NextResponse.json({ error: 'Failed to fetch delegation transfers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const orgId = admin.orgId
    const userId = admin.userId
    const body = await request.json()

    if (!body.delegator_id) {
      return NextResponse.json({ error: 'Delegator is required' }, { status: 400 })
    }
    if (!body.delegate_id) {
      return NextResponse.json({ error: 'Delegate is required' }, { status: 400 })
    }
    if (!body.delegation_type?.trim()) {
      return NextResponse.json({ error: 'Delegation type is required' }, { status: 400 })
    }
    if (!body.starts_at) {
      return NextResponse.json({ error: 'Start date is required' }, { status: 400 })
    }
    if (!body.ends_at) {
      return NextResponse.json({ error: 'End date is required' }, { status: 400 })
    }
    if (body.delegator_id === body.delegate_id) {
      return NextResponse.json({ error: 'Delegator and delegate must be different users' }, { status: 400 })
    }
    if (new Date(body.starts_at) >= new Date(body.ends_at)) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO delegation_transfers (
        organization_id, delegator_id, delegate_id,
        delegation_type, actions,
        starts_at, ends_at,
        notify_on_action, reason,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      orgId,
      body.delegator_id,
      body.delegate_id,
      body.delegation_type.trim(),
      body.actions || null,
      body.starts_at,
      body.ends_at,
      body.notify_on_action ?? true,
      body.reason?.trim() || null,
      userId,
    ])

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating delegation transfer:', error)
    return NextResponse.json({ error: 'Failed to create delegation transfer' }, { status: 500 })
  }
}
