import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin, isAdmin } from '@/lib/permissions'
import { decidePrivilegedUpdate, lookupRole, userHasAdminRole } from '@/lib/role-grants'
import { logAudit, getClientIp } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateUserSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  role_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  contact_id: z.string().uuid().optional().nullable(),
  ui_mode: z.string().max(20).optional().nullable(),
  show_tooltips: z.boolean().optional(),
  compact_view: z.boolean().optional(),
  keyboard_shortcuts_enabled: z.boolean().optional(),
  dashboard_view_preference: z.string().max(20).optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = await getOrgId()

    // Authorization (audit 2026-07-23): a user record exposes role + contact
    // detail. A user may read their OWN record; reading anyone else's requires
    // user_management.
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (id !== ctx.userId && !(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
    }

    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role_id,
        ur.name as role_name,
        u.status,
        u.contact_id,
        u.auth_method,
        u.ui_mode,
        u.show_tooltips,
        u.compact_view,
        u.keyboard_shortcuts_enabled,
        u.dashboard_view_preference,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.contact_type,
        c.email as contact_email,
        c.phone as contact_phone,
        c.mobile as contact_mobile,
        c.department_id,
        d.name as department_name,
        c.job_title_id,
        jt.name as job_title_name,
        c.location_id,
        l.name as location_name,
        c.company_id,
        co.name as company_name
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      LEFT JOIN contacts c ON u.contact_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN job_titles jt ON c.job_title_id = jt.id
      LEFT JOIN locations l ON c.location_id = l.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE u.id = $1 AND u.organization_id = $2
    `, [id, orgId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId, orgId } = ctx

    const { id } = await params
    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Authorization (audit 2026-07-23): role_id / status / contact_id are
    // PRIVILEGED fields — mutating them, or editing ANOTHER user's record at
    // all, requires the user_management capability (or admin). Without this
    // any authenticated user could PATCH their own role_id to an admin role
    // (self-elevation) or suspend other users. A user may still patch their
    // OWN preference fields (ui_mode, tooltips, compact_view, ...).
    const touchesPrivileged =
      data.role_id !== undefined ||
      data.status !== undefined ||
      data.contact_id !== undefined
    if (touchesPrivileged || id !== userId) {
      if (!(await hasCapabilityOrAdmin(userId, 'user_management'))) {
        return NextResponse.json(
          { error: 'Requires user_management capability' },
          { status: 403 },
        )
      }
    }

    // Role-grant policy (Principle 1, lib/role-grants.ts): admin roles are only
    // granted by an admin, admins are only changed by an admin, and nobody
    // changes their own role.
    let newRoleIsAdmin = false
    let targetIsAdmin = false
    let actorIsAdmin = false
    if (touchesPrivileged) {
      if (data.role_id) {
        const role = await lookupRole(data.role_id, orgId)
        if (!role) {
          return NextResponse.json({ error: 'Role not found' }, { status: 400 })
        }
        newRoleIsAdmin = role.adminAccess
      }
      targetIsAdmin = await userHasAdminRole(id, orgId)
      actorIsAdmin = await isAdmin(userId)
      const decision = decidePrivilegedUpdate({
        actorUserId: userId,
        actorIsAdmin,
        targetUserId: id,
        changesRole: data.role_id !== undefined,
        newRoleIsAdmin,
        targetIsAdmin,
        touchesPrivileged,
      })
      if (!decision.ok) {
        return NextResponse.json({ error: decision.error }, { status: decision.status })
      }
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    const fields: Record<string, unknown> = {
      first_name: data.first_name?.trim(),
      last_name: data.last_name?.trim(),
      role_id: data.role_id,
      status: data.status,
      contact_id: data.contact_id,
      ui_mode: data.ui_mode,
      show_tooltips: data.show_tooltips,
      compact_view: data.compact_view,
      keyboard_shortcuts_enabled: data.keyboard_shortcuts_enabled,
      dashboard_view_preference: data.dashboard_view_preference,
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`)
        values.push(value ?? null)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, orgId)

    // Last-admin guard (PRINCIPLES.md: never lock out administration). Refuse
    // to deactivate or demote the FINAL user with admin access. Recovery from a
    // zero-admin state is out-of-band (setup wizard / DB), never this endpoint.
    const willDeactivate = data.status !== undefined && data.status !== 'active'
    const willChangeRole = data.role_id !== undefined
    if (willDeactivate || willChangeRole) {
      const targetRes = await pool.query(
        `SELECT (ur.permissions->>'admin_access')::boolean AS admin_access, u.status
           FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id
          WHERE u.id = $1 AND u.organization_id = $2`,
        [id, orgId],
      )
      const target = targetRes.rows[0]
      const targetIsActiveAdmin = target?.admin_access === true && target?.status === 'active'
      const staysAdmin = willChangeRole ? newRoleIsAdmin : target?.admin_access === true
      const wouldLoseAdmin = targetIsActiveAdmin && (willDeactivate || (willChangeRole && !staysAdmin))
      if (wouldLoseAdmin) {
        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS n
             FROM users u JOIN user_roles ur ON u.role_id = ur.id
            WHERE u.organization_id = $1 AND u.status = 'active'
              AND (ur.permissions->>'admin_access')::boolean = true`,
          [orgId],
        )
        if ((countRes.rows[0]?.n ?? 0) <= 1) {
          return NextResponse.json(
            { error: 'Cannot remove the last administrator — administration would be locked out.' },
            { status: 409 },
          )
        }
      }
    }

    // Capture the PRIOR privileged state for the audit trail — only when a
    // privileged field (role_id / status / contact_id) is actually changing, so
    // preference-only PATCHes don't write noise.
    let priorPrivileged: { role_id: string | null; status: string; contact_id: string | null } | null = null
    if (touchesPrivileged) {
      const prev = await pool.query(
        `SELECT role_id, status, contact_id FROM users WHERE id = $1 AND organization_id = $2`,
        [id, orgId],
      )
      priorPrivileged = prev.rows[0] ?? null
    }

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING id, email, first_name, last_name, role_id, status, contact_id, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Audit privileged mutations (role/status/contact) — append-only trail so a
    // role change or account suspension is attributable (Principle #8 privileged
    // changes are audited, #12 append-only). Preference-only edits are skipped.
    if (touchesPrivileged && priorPrivileged) {
      const oldValues: Record<string, unknown> = {}
      const newValues: Record<string, unknown> = {}
      if (data.role_id !== undefined) { oldValues.role_id = priorPrivileged.role_id; newValues.role_id = data.role_id ?? null }
      if (data.status !== undefined) { oldValues.status = priorPrivileged.status; newValues.status = data.status }
      if (data.contact_id !== undefined) { oldValues.contact_id = priorPrivileged.contact_id; newValues.contact_id = data.contact_id ?? null }
      logAudit({
        orgId,
        userId, // the actor performing the change
        action: 'user.privileged_update',
        actionCategory: 'update',
        entityType: 'user',
        entityId: id,
        entityName: result.rows[0].email,
        oldValues,
        newValues,
        actorIp: getClientIp(request.headers),
      })

      // A grant or removal of administrator access gets its own, explicitly
      // named audit entry so it is easy to find in the trail.
      if (data.role_id !== undefined && newRoleIsAdmin !== targetIsAdmin) {
        logAudit({
          orgId,
          userId,
          action: newRoleIsAdmin ? 'user.admin_role_granted' : 'user.admin_role_revoked',
          actionCategory: 'update',
          entityType: 'user',
          entityId: id,
          entityName: result.rows[0].email,
          oldValues: { role_id: priorPrivileged.role_id, admin_access: targetIsAdmin },
          newValues: { role_id: data.role_id ?? null, admin_access: newRoleIsAdmin },
          actorIp: getClientIp(request.headers),
        })
      }
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
