import { NextResponse } from 'next/server'
import { getSignupStatus } from '@/lib/auth'

/**
 * Public, unauthenticated signup-status endpoint (unified-auth-bootstrap D4).
 *
 * The login page reads this to decide whether to show the "create account"
 * link and what messaging to display:
 *   - open:         first-run — anyone may claim the install as owner
 *   - domain-gated: show the link, but only allowlisted domains will succeed
 *   - closed:       hide the link (invite-only)
 *
 * This is UX only. The actual enforcement is the hooks.before gate in
 * lib/auth.ts (isSelfSignupPermitted) — this endpoint is never trusted for
 * authorization. Deliberately public: it exposes only the posture and, when
 * domain-gated, the allowlisted domains (which a legitimate registrant needs
 * to know anyway).
 */
export async function GET() {
  const status = await getSignupStatus()
  return NextResponse.json(status)
}
