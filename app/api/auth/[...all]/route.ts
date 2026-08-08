import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { logAuthEvent, getClientIp } from '@/lib/audit'
import { getUserId } from '@/lib/org'

/**
 * Better Auth catch-all route.
 *
 * Auth-foundations Phase 1 (D8) consolidated credential-lifecycle audit
 * into Better Auth's `hooks.after` middleware in `lib/auth.ts` — except
 * for sign-out. By the time hooks.after runs Better Auth has already
 * cleared the session row, and `hooks.before` doesn't expose the runtime
 * user-session via `ctx.context.session` (that field is the framework's
 * session config, not the request session).
 *
 * The reliable path for sign-out is here: capture session info from the
 * request cookie BEFORE delegating to Better Auth, then emit the audit
 * row only if the response is 200. Rejected sign-outs (CSRF / bad
 * Content-Type) come back non-200 and skip the emit.
 *
 * 2026-04-26: removed login/login_failed/google emitters (those are now
 * in hooks.after); kept sign-out here for the reasons above.
 */

const handler = toNextJsHandler(auth)

export const GET = handler.GET

export async function POST(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname

  // Capture session info BEFORE Better Auth deletes it (sign-out only).
  let signOutSession: { userId: string; email: string } | null = null
  if (path.endsWith('/sign-out')) {
    try {
      const session = await auth.api.getSession({ headers: new Headers(request.headers) })
      if (session) {
        const resolvedUserId = await getUserId(session.user.email).catch(() => session.user.id)
        signOutSession = { userId: resolvedUserId, email: session.user.email }
      }
    } catch {
      // No valid session — nothing to audit. (Letting Better Auth handle
      // the response; it'll likely 401.)
    }
  }

  const response = await handler.POST(request)

  // Sign-out: audit only on a successful response.
  if (path.endsWith('/sign-out') && signOutSession && response.status === 200) {
    const headers = new Headers(request.headers)
    logAuthEvent({
      userId: signOutSession.userId,
      email: signOutSession.email,
      action: 'logout',
      actorIp: getClientIp(headers),
      success: true,
      userAgent: headers.get('user-agent'),
    })
  }

  return response
}
