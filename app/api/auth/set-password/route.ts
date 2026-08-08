import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { consumeToken } from '@/lib/setup-tokens'
import { hashPassword } from '@/lib/password'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'

/**
 * POST /api/auth/set-password  { token, password }
 *
 * The bootstrap credential path (spec: admin-password-onboarding). A user
 * redeems a one-time invite/reset link and sets their OWN password — no admin
 * ever knows it. AUTH IS THE TOKEN: this route is intentionally outside the
 * portal session guard. Errors are generic so token validity can't be probed.
 */
const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { token, password } = parsed.data

  // Single-use consume (atomic). Any invalid/expired/used token → one generic
  // error.
  const consumed = await consumeToken(token)
  if (!consumed) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired. Ask an administrator for a new one.' },
      { status: 400 },
    )
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const baUser = await client.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [consumed.email],
    )
    if (baUser.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Account not found.' }, { status: 400 })
    }
    const baUserId = baUser.rows[0].id
    const hashed = await hashPassword(password)

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" = 'credential'`,
      [baUserId],
    )
    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
        [hashed, existing.rows[0].id],
      )
    } else {
      await client.query(
        `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'credential', $4, NOW(), NOW())`,
        [`acct-${randomBytes(12).toString('hex')}`, baUserId, baUserId, hashed],
      )
    }

    // Drop any existing sessions — a reset must not leave old sessions valid.
    await client.query(`DELETE FROM "session" WHERE "userId" = $1`, [baUserId])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[set-password] failed:', err)
    return NextResponse.json({ error: 'Could not set password.' }, { status: 500 })
  } finally {
    client.release()
  }

  // The user now signs in with their new password (front-end redirects to login).
  return NextResponse.json({ success: true, email: consumed.email })
}
