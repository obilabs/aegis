import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { z } from 'zod'

const permissionsSchema = z.object({
  isRestricted: z.boolean(),
  permissions: z.array(z.object({
    role: z.string().min(1).max(50),
    permission: z.enum(['read', 'write', 'manage']),
  })),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id } = await params

  const folder = await queryOne(
    'SELECT id, is_restricted FROM folders WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  try {
    const permissions = await query(
      'SELECT id, role, permission FROM folder_permissions WHERE folder_id = $1 AND organization_id = $2',
      [id, orgId]
    )
    return NextResponse.json({ isRestricted: folder.is_restricted, permissions })
  } catch (error) {
    console.error('Failed to fetch folder permissions:', error)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id } = await params

  // Authorization (audit 2026-07-23): setting folder permissions is a settings action.
  const ctx = await getAuthContext(request)
  if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
    return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = permissionsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const folder = await queryOne(
    'SELECT id FROM folders WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const { isRestricted, permissions } = parsed.data

  try {
    // Update folder restriction flag
    await query(
      'UPDATE folders SET is_restricted = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3',
      [isRestricted, id, orgId]
    )

    // Replace all permissions
    await query('DELETE FROM folder_permissions WHERE folder_id = $1 AND organization_id = $2', [id, orgId])

    if (isRestricted && permissions.length > 0) {
      for (const p of permissions) {
        await query(
          'INSERT INTO folder_permissions (organization_id, folder_id, role, permission) VALUES ($1, $2, $3, $4)',
          [orgId, id, p.role, p.permission]
        )
      }
    }

    return NextResponse.json({ message: 'Permissions updated' })
  } catch (error) {
    console.error('Failed to update folder permissions:', error)
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
  }
}
