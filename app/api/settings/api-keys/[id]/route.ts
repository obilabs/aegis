/**
 * Admin API Key — update & revoke.
 *
 * PATCH  /api/settings/api-keys/[id] — mutate name, scopes, rate_limit, expires_at
 * DELETE /api/settings/api-keys/[id] — soft-delete (is_active = false)
 *
 * Admin only. The key hash itself can never be changed — rotation is a
 * revoke + reissue.
 *
 * PATCH on `scopes` is the way the migration banner "verify your
 * scopes" flow lands: admin reviews the auto-translated scope set,
 * tweaks if needed, and clears the `migrated_at` flag in the same
 * write so the banner goes away.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { API_SCOPE_LIST, type ApiScope } from '@obilabs/api-scopes'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'

const ApiScopeEnum = z.enum(API_SCOPE_LIST as [ApiScope, ...ApiScope[]])

const UpdateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(ApiScopeEnum).min(1).optional(),
  ai_context_level: z.enum(['end_user', 'technician', 'admin']).optional(),
  rate_limit: z.number().int().min(0).max(100000).optional(),
  expires_at: z.string().datetime().optional().nullable(),
  // When the admin confirms the auto-migrated scopes are correct,
  // the UI patches with `acknowledge_migration: true` and we clear
  // the `migrated_at` flag so the per-key banner stops rendering.
  acknowledge_migration: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = UpdateKeySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const orgId = await getOrgId()

    const existing = await queryOne(
      'SELECT id FROM api_keys WHERE id = $1 AND organization_id = $2',
      [id, orgId],
    )
    if (!existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1
    const data = parsed.data

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(data.name)
    }
    // Scopes — write to BOTH `scopes` (text[], enforced) and
    // `permissions` (jsonb, legacy UI surface). Keeping the two in
    // sync is the price of not breaking a browser tab that's open
    // during the rollout; Chunk 4 collapses the read side.
    if (data.scopes !== undefined) {
      updates.push(`scopes = $${paramIndex++}::text[]`)
      values.push(data.scopes)
      updates.push(`permissions = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(data.scopes))
    }
    if (data.ai_context_level !== undefined) {
      updates.push(`ai_context_level = $${paramIndex++}`)
      values.push(data.ai_context_level)
    }
    if (data.rate_limit !== undefined) {
      updates.push(`rate_limit = $${paramIndex++}`)
      values.push(data.rate_limit)
    }
    if (data.expires_at !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`)
      values.push(data.expires_at)
    }
    if (data.acknowledge_migration === true) {
      updates.push(`migrated_at = NULL`)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(id)
    values.push(orgId)

    const row = await queryOne(
      `UPDATE api_keys
          SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
        RETURNING id, name, key_prefix, permissions, scopes, rate_limit,
                  expires_at, ai_context_level, key_type, key_owner_user_id,
                  migrated_at, is_active, created_at`,
      values,
    )

    return NextResponse.json(row)
  } catch (error) {
    console.error('Failed to update API key:', error)
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete (revoke) any key in the org
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    const row = await queryOne(
      `UPDATE api_keys
          SET is_active = false
        WHERE id = $1 AND organization_id = $2
        RETURNING id, name, is_active`,
      [id, orgId],
    )

    if (!row) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'API key revoked', ...row })
  } catch (error) {
    console.error('Failed to revoke API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
}
