import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { isSetupOpen, requireSetupToken } from '@/lib/first-run-guard'

/**
 * Set the first user as admin during initial setup.
 *
 * Security (audit M10): requires the caller to be authenticated AS the user
 * being promoted, so an unauthenticated caller can no longer race the setup
 * window to trigger this privileged write. Still guarded to "exactly one user
 * exists" so it only functions during first-run. Uses the shared pool from
 * lib/db (previously spun up its own).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First-run only, and only for whoever holds the setup token.
    if (!(await isSetupOpen())) {
      return NextResponse.json(
        { success: false, error: 'This endpoint only works during initial setup' },
        { status: 403 }
      )
    }
    const tokenError = requireSetupToken(request)
    if (tokenError) return tokenError

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // The caller may only promote THEMSELVES (the first user), never an
    // arbitrary id supplied in the body.
    if (session.user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Can only set admin for the signed-in user during setup' },
        { status: 403 }
      )
    }

    // Only works during first-run: exactly one user exists.
    const countResult = await pool.query('SELECT COUNT(*) as count FROM "user"')
    const userCount = parseInt(countResult.rows[0].count, 10)

    if (userCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'This endpoint only works during initial setup' },
        { status: 403 }
      )
    }

    // Verify the user exists and is the only user
    const userResult = await pool.query(
      'SELECT id FROM "user" WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Update the user's role to admin
    await pool.query(
      'UPDATE "user" SET role = $1 WHERE id = $2',
      ['admin', userId]
    )

    return NextResponse.json({
      success: true,
      message: 'User role updated to admin',
    })
  } catch (error) {
    console.error('Set admin error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set admin role' },
      { status: 500 }
    )
  }
}
