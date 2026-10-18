import { pool } from '@/lib/db'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_ENTITY_TYPES = ['contacts', 'tickets', 'assets', 'credentials', 'kb_articles', 'documents'] as const

const updateRetentionSchema = z.object({
  retention_mode: z.enum(['manual_only', 'auto_purge']).optional(),
  retention_days: z.number().int().min(365, 'Minimum retention period is 365 days').nullable().optional(),
  exempt_if_closed: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx
    const { entityType } = await params

    // Check admin role
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate entity type
    if (!VALID_ENTITY_TYPES.includes(entityType as any)) {
      return NextResponse.json(
        { error: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateRetentionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { retention_mode, retention_days, exempt_if_closed } = parsed.data

    // Build dynamic update
    const setClauses: string[] = ['updated_at = NOW()']
    const values: any[] = []
    let paramIndex = 1

    if (retention_mode !== undefined) {
      setClauses.push(`retention_mode = $${paramIndex++}`)
      values.push(retention_mode)
    }
    if (retention_days !== undefined) {
      setClauses.push(`retention_days = $${paramIndex++}`)
      values.push(retention_days)
    }
    if (exempt_if_closed !== undefined) {
      setClauses.push(`exempt_if_closed = $${paramIndex++}`)
      values.push(exempt_if_closed)
    }

    values.push(orgId, entityType)

    const result = await pool.query(
      `UPDATE data_retention_policies
       SET ${setClauses.join(', ')}
       WHERE organization_id = $${paramIndex++} AND entity_type = $${paramIndex}
       RETURNING id, entity_type, retention_mode, retention_days, exempt_if_closed, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Retention policy not found' }, { status: 404 })
    }

    logAudit({
      orgId, userId, action: 'retention_policy_updated', actionCategory: 'settings',
      entityType: 'data_retention_policies', entityId: result.rows[0].id,
      newValues: parsed.data,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ policy: result.rows[0] })
  } catch (error) {
    console.error('Error updating retention policy:', error)
    return NextResponse.json({ error: 'Failed to update retention policy' }, { status: 500 })
  }
}
