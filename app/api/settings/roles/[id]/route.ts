import { auth } from '@/lib/auth'
import { query, queryOne, pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_CAPABILITIES = ['triage', 'bulk_actions', 'reports', 'settings', 'user_management', 'credentials'] as const
const VALID_TICKET_ACCESS = ['own', 'team', 'all'] as const

const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.object({
    capabilities: z.array(z.enum(VALID_CAPABILITIES)).default([]),
    ticket_access: z.enum(VALID_TICKET_ACCESS),
    admin_access: z.boolean(),
  }).optional(),
})

async function requireAdmin(request: NextRequest): Promise<{ userId: string; orgId: string } | NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orgId = await getOrgId()
  const itsmUser = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2 LIMIT 1',
    [session.user.email, orgId]
  )
  if (!itsmUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userIsAdmin = await isAdmin(itsmUser.id)
  if (!userIsAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return { userId: itsmUser.id, orgId }
}

/**
 * GET /api/settings/roles/[id] — get a single role with user count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orgId = await getOrgId()

  const role = await queryOne<{
    id: string
    name: string
    description: string | null
    permissions: Record<string, unknown>
    is_system: boolean
    created_at: Date
    updated_at: Date
    user_count: string
  }>(
    `SELECT
      r.id, r.name, r.description, r.permissions, r.is_system,
      r.created_at, r.updated_at,
      COUNT(u.id)::text as user_count
    FROM user_roles r
    LEFT JOIN users u ON u.role_id = r.id AND u.organization_id = r.organization_id
    WHERE r.id = $1 AND r.organization_id = $2
    GROUP BY r.id`,
    [id, orgId]
  )

  if (!role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  return NextResponse.json({
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isSystem: role.is_system,
      userCount: parseInt(role.user_count, 10),
      createdAt: role.created_at,
      updatedAt: role.updated_at,
    },
  })
}

/**
 * PATCH /api/settings/roles/[id] — update a role's permissions
 *
 * System roles: can toggle capabilities but cannot change ticket_access or admin_access.
 * Custom roles: can change everything.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin(request)
  if (adminCheck instanceof NextResponse) return adminCheck

  const { orgId } = adminCheck
  const { id } = await params

  const body = await request.json()
  const parsed = UpdateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await queryOne<{
    id: string
    is_system: boolean
    permissions: Record<string, unknown>
  }>(
    'SELECT id, is_system, permissions FROM user_roles WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )

  if (!existing) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (parsed.data.name !== undefined) {
    if (existing.is_system) {
      return NextResponse.json({ error: 'Cannot rename system roles' }, { status: 400 })
    }
    updates.push(`name = $${paramIndex++}`)
    values.push(parsed.data.name)
  }

  if (parsed.data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(parsed.data.description)
  }

  if (parsed.data.permissions !== undefined) {
    const newPerms = parsed.data.permissions

    if (existing.is_system) {
      // System roles: only capabilities can be changed
      const existingPerms = existing.permissions as {
        capabilities?: string[]
        ticket_access?: string
        admin_access?: boolean
      }
      const mergedPerms = {
        capabilities: newPerms.capabilities,
        ticket_access: existingPerms.ticket_access || 'own',
        admin_access: existingPerms.admin_access || false,
      }
      updates.push(`permissions = $${paramIndex++}`)
      values.push(JSON.stringify(mergedPerms))
    } else {
      updates.push(`permissions = $${paramIndex++}`)
      values.push(JSON.stringify(newPerms))
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  updates.push(`updated_at = NOW()`)
  values.push(id, orgId)

  try {
    const result = await pool.query(
      `UPDATE user_roles SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING id, name, description, permissions, is_system, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    const r = result.rows[0]
    logAudit({
      orgId, userId: adminCheck.userId, action: 'role_updated', actionCategory: 'settings',
      entityType: 'roles', entityId: id, entityName: r.name,
      oldValues: existing.permissions as Record<string, unknown>,
      newValues: parsed.data as Record<string, unknown>,
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({
      role: {
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.is_system,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('user_roles_organization_id_name_key')) {
      return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 })
    }
    throw err
  }
}

/**
 * DELETE /api/settings/roles/[id] — delete a custom role
 *
 * System roles cannot be deleted.
 * Users with this role must be reassigned first (returns error if any users have this role).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin(request)
  if (adminCheck instanceof NextResponse) return adminCheck

  const { orgId } = adminCheck
  const { id } = await params

  const existing = await queryOne<{
    id: string
    is_system: boolean
    name: string
  }>(
    'SELECT id, is_system, name FROM user_roles WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )

  if (!existing) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  if (existing.is_system) {
    return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 400 })
  }

  // Check if any users have this role
  const userCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM users WHERE role_id = $1 AND organization_id = $2',
    [id, orgId]
  )

  if (userCount && parseInt(userCount.count, 10) > 0) {
    return NextResponse.json({
      error: `Cannot delete role "${existing.name}" — ${userCount.count} user(s) still have this role. Reassign them first.`,
    }, { status: 409 })
  }

  await pool.query(
    'DELETE FROM user_roles WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )

  logAudit({
    orgId, userId: adminCheck.userId, action: 'role_deleted', actionCategory: 'delete',
    entityType: 'roles', entityId: id, entityName: existing.name,
    actorIp: getClientIp(request.headers),
  })

  return NextResponse.json({ success: true })
}
