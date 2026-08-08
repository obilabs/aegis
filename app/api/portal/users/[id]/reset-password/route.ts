import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { mintToken, publicBaseUrl } from '@/lib/setup-tokens'
import { z } from 'zod'

/**
 * POST /api/portal/users/[id]/reset-password
 *
 * Admin-initiated password RESET — mints a one-time set-password LINK and
 * returns it (admins never set or learn the password; spec:
 * admin-password-onboarding). The user's current password stays valid until
 * they complete the link, UNLESS `revoke_current` is set (compromised path).
 * Requires `user_management` (or admin), org-scoped.
 */
const schema = z.object({
  revoke_current: z.boolean().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasCapabilityOrAdmin(ctx.userId, 'user_management'))) {
    return NextResponse.json({ error: 'Requires user_management capability' }, { status: 403 })
  }

  // Policy toggle (organizations.settings.admin_password_reset_enabled, default
  // true when absent). Off → resets are disallowed for this org.
  const settingRes = await pool.query<{ enabled: boolean }>(
    `SELECT COALESCE((settings->>'admin_password_reset_enabled')::boolean, true) AS enabled
       FROM organizations WHERE id = $1`,
    [ctx.orgId],
  )
  if (settingRes.rows[0] && settingRes.rows[0].enabled === false) {
    return NextResponse.json({ error: 'admin_reset_disabled' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const target = await pool.query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1 AND organization_id = $2`,
    [id, ctx.orgId],
  )
  if (target.rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const email = target.rows[0].email

  // Compromised-credential path: null the current password now so only the link
  // can restore access. Default (false) keeps the old password valid until the
  // user completes the link, so a lost link never locks anyone out.
  if (parsed.data.revoke_current) {
    await pool.query(
      `UPDATE "account" SET password = NULL, "updatedAt" = NOW()
       WHERE "providerId" = 'credential' AND "userId" = (SELECT id FROM "user" WHERE email = $1)`,
      [email],
    )
  }

  const link = await mintToken({
    userId: id,
    orgId: ctx.orgId,
    purpose: 'reset',
    createdBy: ctx.userId,
    baseUrl: publicBaseUrl(request),
  })

  return NextResponse.json({ success: true, setPasswordUrl: link.url, expiresAt: link.expiresAt })
}
