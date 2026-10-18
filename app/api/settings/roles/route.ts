import { auth } from '@/lib/auth'
import { requireStaff } from '@/lib/access'
import { query, pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { isAdmin } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_CAPABILITIES = ['triage', 'bulk_actions', 'reports', 'settings', 'user_management', 'credentials'] as const
const VALID_TICKET_ACCESS = ['own', 'team', 'all'] as const

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.object({
    capabilities: z.array(z.enum(VALID_CAPABILITIES)).default([]),
    ticket_access: z.enum(VALID_TICKET_ACCESS).default('own'),
    admin_access: z.boolean().default(false),
  }),
})

/**
 * GET /api/settings/roles — list all roles with user counts
 */
export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  const roles = await query<{
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
      r.id,
      r.name,
      r.description,
      r.permissions,
      r.is_system,
      r.created_at,
      r.updated_at,
      COUNT(u.id)::text as user_count
    FROM user_roles r
    LEFT JOIN users u ON u.role_id = r.id AND u.organization_id = r.organization_id
    WHERE r.organization_id = $1
    GROUP BY r.id
    ORDER BY r.is_system DESC, r.name ASC`,
    [orgId]
  )

  return NextResponse.json({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.is_system,
      userCount: parseInt(r.user_count, 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  })
}

/**
 * POST /api/settings/roles — create a new custom role
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  // Check admin permission
  const itsmUser = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2 LIMIT 1',
    [session.user.email, orgId]
  )
  if (!itsmUser[0]) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userIsAdmin = await isAdmin(itsmUser[0].id)
  if (!userIsAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = CreateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, description, permissions } = parsed.data

  try {
    const result = await pool.query(
      `INSERT INTO user_roles (organization_id, name, description, permissions, is_system)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, name, description, permissions, is_system, created_at, updated_at`,
      [orgId, name, description || null, JSON.stringify(permissions)]
    )

    const r = result.rows[0]
    return NextResponse.json({
      role: {
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.is_system,
        userCount: 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('user_roles_organization_id_name_key')) {
      return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 })
    }
    throw err
  }
}
