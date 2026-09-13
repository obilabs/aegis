/**
 * Route guard for first-run setup endpoints. See lib/first-run-token.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { setupTokenFromHeaders, verifySetupToken } from '@/lib/first-run-token'

/** Setup is open until the setup wizard has created the organization. */
export async function isSetupOpen(): Promise<boolean> {
  const res = await pool.query('SELECT COUNT(*)::int AS n FROM organizations')
  return (res.rows[0]?.n ?? 0) === 0
}

/** 403 unless the request carries the valid first-run setup token. */
export function requireSetupToken(request: NextRequest): NextResponse | null {
  if (verifySetupToken(setupTokenFromHeaders(request.headers))) return null
  return NextResponse.json(
    {
      success: false,
      code: 'setup_token_invalid',
      error:
        "A valid setup token is required. Find it in the server log: docker compose logs aegis | grep 'setup token'",
    },
    { status: 403 },
  )
}
