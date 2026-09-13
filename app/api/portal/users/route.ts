import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { decideRoleOnCreate, lookupRole } from '@/lib/role-grants'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { mintToken, publicBaseUrl } from '@/lib/setup-tokens'

const createUserSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  role_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  // Inline contact fields (used when contact_id is not provided)
  contact_type: z.enum(['employee', 'customer', 'vendor', 'partner']).optional(),
  department_id: z.string().uuid().optional().nullable(),
  job_title_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  // Cascade-revocation provisioning fields (msp-cascade-revocation spec).
  // When an admin marks a new user as provisioned by an MSP firm, both
  // are set together. Revoking that MSP's pairing later cascades and
  // disables this user. When unset, the user is customer_native — safe
  // default.
  msp_pairing_key_id: z.string().uuid().optional().nullable(),
  user_origin: z
    .enum(['msp_provisioned', 'customer_native', 'customer_linked_to_msp'])
    .optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const url = new URL(request.url)
    const assignableOnly = url.searchParams.get('assignable') === 'true'

    // When assignable=true, only return users whose role has ticket_access != 'own'
    const assignableFilter = assignableOnly
      ? `AND ur.permissions->>'ticket_access' IS NOT NULL AND ur.permissions->>'ticket_access' != 'own'`
      : ''

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
        u.last_login_at,
        u.created_at,
        c.contact_type,
        c.department_id,
        d.name as department_name,
        c.job_title_id,
        jt.name as job_title_name
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      LEFT JOIN contacts c ON u.contact_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN job_titles jt ON c.job_title_id = jt.id
      WHERE u.organization_id = $1 AND u.status = 'active' ${assignableFilter}
      ORDER BY u.first_name ASC, u.last_name ASC
    `, [orgId])

    return NextResponse.json({ users: result.rows })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization (audit 2026-07-23): creating a user provisions a
    // loginable account with a caller-chosen role_id. Without this guard any
    // authenticated user could create an admin account (privilege
    // escalation). Requires the user_management capability (or admin).
    if (!(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
      return NextResponse.json(
        { error: 'Requires user_management capability' },
        { status: 403 },
      )
    }

    const orgId = ctx.orgId
    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Principle 1 (lib/role-grants.ts): account creation never carries an
    // administrator role, whoever the caller is. Admin access is granted
    // afterwards by an existing admin through PATCH /api/portal/users/[id],
    // which is audited.
    if (data.role_id) {
      const role = await lookupRole(data.role_id, orgId)
      if (!role) {
        return NextResponse.json({ error: 'Role not found' }, { status: 400 })
      }
      const decision = decideRoleOnCreate({ roleIsAdmin: role.adminAccess })
      if (!decision.ok) {
        return NextResponse.json({ error: decision.error }, { status: decision.status })
      }
    }

    // Check email isn't already taken
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
      [data.email, orgId]
    )
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      let contactId = data.contact_id || null

      // Create contact if not linking to existing one
      if (!contactId) {
        const contactType = data.contact_type || 'employee'

        const contactResult = await client.query(`
          INSERT INTO contacts (
            organization_id, first_name, last_name, email,
            contact_type, department_id, job_title_id, location_id,
            company_id, phone, has_portal_access
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
          RETURNING id
        `, [
          orgId,
          data.first_name.trim(),
          data.last_name.trim(),
          data.email.trim(),
          contactType,
          data.department_id || null,
          data.job_title_id || null,
          data.location_id || null,
          data.company_id || null,
          data.phone?.trim() || null,
        ])
        contactId = contactResult.rows[0].id
      }

      // Derive cascade fields — if msp_pairing_key_id is set, default
      // user_origin to msp_provisioned (that's what the dropdown is
      // for). Explicit user_origin wins so admin can also mark
      // customer_linked_to_msp — customer employees who happen to use
      // the MSP's SSO surface but keep their account on cascade.
      const derivedUserOrigin: 'msp_provisioned' | 'customer_native' | 'customer_linked_to_msp' =
        data.user_origin
          ? data.user_origin
          : data.msp_pairing_key_id
          ? 'msp_provisioned'
          : 'customer_native'

      // Create internal user record
      const userResult = await client.query(`
        INSERT INTO users (
          organization_id, email, first_name, last_name,
          role_id, contact_id, auth_method, status,
          user_origin, msp_pairing_key_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'local', 'active', $7, $8)
        RETURNING id, email, first_name, last_name, role_id, contact_id, status, created_at,
                  user_origin, msp_pairing_key_id
      `, [
        orgId,
        data.email.trim(),
        data.first_name.trim(),
        data.last_name.trim(),
        data.role_id || null,
        contactId,
        derivedUserOrigin,
        data.msp_pairing_key_id || null,
      ])

      const user = userResult.rows[0]

      // Create the Better Auth login identity WITHOUT a credential — the user
      // sets their own password via a one-time link, so no admin ever knows it
      // (spec: admin-password-onboarding).
      const baUserId = `user-${randomBytes(12).toString('hex')}`
      await client.query(
        `INSERT INTO "user" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'user', true, NOW(), NOW())`,
        [baUserId, data.email.trim(), `${data.first_name.trim()} ${data.last_name.trim()}`]
      )

      await client.query('COMMIT')

      // Mint the invite set-password link (own row; origin from the request so
      // the URL is correct behind the proxy, not the baked NEXT_PUBLIC_APP_URL).
      const invite = await mintToken({
        userId: user.id,
        orgId,
        purpose: 'invite',
        createdBy: ctx.userId,
        baseUrl: publicBaseUrl(request),
      })

      return NextResponse.json(
        { user, setPasswordUrl: invite.url, expiresAt: invite.expiresAt },
        { status: 201 },
      )
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
