import { auth } from '@/lib/auth'
import { pool, query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/portal/delegations
 *
 * List delegations where current user is delegator or delegate.
 * Returns active and upcoming delegations.
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const itsmUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const delegations = await query<{
      id: string
      delegator_id: string
      delegator_name: string
      delegate_id: string
      delegate_name: string
      scope: string
      reason: string | null
      starts_at: Date
      ends_at: Date
      is_active: boolean
      created_at: Date
    }>(
      `SELECT
        d.id, d.delegator_id, d.delegate_id,
        d.scope, d.reason, d.starts_at, d.ends_at,
        d.is_active, d.created_at,
        CONCAT(dr.first_name, ' ', dr.last_name) as delegator_name,
        CONCAT(de.first_name, ' ', de.last_name) as delegate_name
      FROM user_delegations d
      JOIN users dr ON d.delegator_id = dr.id
      JOIN users de ON d.delegate_id = de.id
      WHERE d.organization_id = $1
        AND (d.delegator_id = $2 OR d.delegate_id = $2)
        AND d.is_active = true
        AND d.ends_at > NOW()
      ORDER BY d.starts_at ASC`,
      [orgId, itsmUser.id]
    )

    return NextResponse.json({
      delegations: delegations.map((d) => ({
        id: d.id,
        delegatorId: d.delegator_id,
        delegatorName: d.delegator_name?.trim(),
        delegateId: d.delegate_id,
        delegateName: d.delegate_name?.trim(),
        scope: d.scope,
        reason: d.reason,
        startsAt: d.starts_at,
        endsAt: d.ends_at,
        isActive: d.is_active,
        createdAt: d.created_at,
        isMine: d.delegator_id === itsmUser.id,
      })),
    })
  } catch (error) {
    console.error('Error fetching delegations:', error)
    return NextResponse.json({ error: 'Failed to fetch delegations' }, { status: 500 })
  }
}

const CreateDelegationSchema = z.object({
  delegate_id: z.string().uuid(),
  scope: z.enum(['queue', 'full']).default('queue'),
  reason: z.string().max(500).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
})

/**
 * POST /api/portal/delegations
 *
 * Create a new delegation. Validates no self-delegation,
 * same org, valid date range, no overlapping active delegations.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()

    const itsmUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    )
    if (!itsmUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = CreateDelegationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { delegate_id, scope, reason, starts_at, ends_at } = parsed.data

    // No self-delegation
    if (delegate_id === itsmUser.id) {
      return NextResponse.json({ error: 'Cannot delegate to yourself' }, { status: 400 })
    }

    // Validate delegate exists in same org
    const delegate = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
      [delegate_id, orgId]
    )
    if (!delegate) {
      return NextResponse.json({ error: 'Delegate not found in organization' }, { status: 404 })
    }

    // Check for overlapping active delegations
    const overlap = await queryOne<{ id: string }>(
      `SELECT id FROM user_delegations
       WHERE organization_id = $1
         AND delegator_id = $2
         AND is_active = true
         AND starts_at < $4
         AND ends_at > $3
       LIMIT 1`,
      [orgId, itsmUser.id, starts_at, ends_at]
    )
    if (overlap) {
      return NextResponse.json({ error: 'Overlapping delegation already exists' }, { status: 409 })
    }

    const result = await queryOne<{ id: string }>(
      `INSERT INTO user_delegations
       (organization_id, delegator_id, delegate_id, scope, reason, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [orgId, itsmUser.id, delegate_id, scope, reason || null, starts_at, ends_at]
    )

    return NextResponse.json({ id: result!.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating delegation:', error)
    return NextResponse.json({ error: 'Failed to create delegation' }, { status: 500 })
  }
}
