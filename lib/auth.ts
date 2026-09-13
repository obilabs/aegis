import { betterAuth } from 'better-auth'
import { buildTrustedOrigins } from '@/lib/trusted-origins'
import { twoFactor, admin, bearer, emailOTP } from 'better-auth/plugins'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { Pool } from 'pg'
import { logAuthEvent } from '@/lib/audit'
import { resolveSecret } from '@/lib/secret-bootstrap'
import { setupTokenFromHeaders, verifySetupToken } from '@/lib/first-run-token'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Audit dedup. Better Auth's hooks.after fires twice for some auth paths
 * (likely the endpoint POST + an implicit follow-up). The 2026-04-26
 * regression suite caught duplicate audit rows landing 0.003-0.018s apart
 * for every signin/signout. Track the last emit time per (path + sessionId)
 * key and skip if we just emitted within DEDUP_WINDOW_MS. Map self-prunes
 * old entries lazily; size cap keeps memory bounded.
 */
const DEDUP_WINDOW_MS = 5_000
const DEDUP_MAX_ENTRIES = 10_000
const recentAuthEvents = new Map<string, number>()

function shouldEmitAuthEvent(action: string, sessionId: string | null | undefined): boolean {
  if (!sessionId) return true // can't dedupe without a key — emit
  const key = `${action}:${sessionId}`
  const now = Date.now()
  const prev = recentAuthEvents.get(key)
  if (prev !== undefined && now - prev < DEDUP_WINDOW_MS) {
    return false
  }
  recentAuthEvents.set(key, now)
  // Lazy prune: if the map grows too large, drop the oldest entries.
  if (recentAuthEvents.size > DEDUP_MAX_ENTRIES) {
    const cutoff = now - DEDUP_WINDOW_MS
    for (const [k, t] of recentAuthEvents) {
      if (t < cutoff) recentAuthEvents.delete(k)
    }
  }
  return true
}

// Personal Gmail domains that should be blocked
const BLOCKED_DOMAINS = ['gmail.com', 'googlemail.com']

// Helper to check if an email is from a personal Gmail account
function isPersonalGmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return BLOCKED_DOMAINS.includes(domain)
}

export const auth = betterAuth({
  appName: 'Aegis',
  database: pool,

  // Env wins; otherwise a persisted/auto-generated secret so sessions survive
  // restarts on a minimal .env. Better Auth would otherwise mint a NEW secret
  // every boot when BETTER_AUTH_SECRET is unset, invalidating all sessions
  // (spec: zero-config-secret-bootstrap).
  secret: resolveSecret('BETTER_AUTH_SECRET'),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      scope: ['openid', 'email', 'profile'],
      mapProfileToUser: (profile) => {
        const hostedDomain = profile.hd
        const email = profile.email as string

        if (!hostedDomain || isPersonalGmail(email)) {
          throw new Error('PERSONAL_GMAIL_NOT_ALLOWED')
        }

        return {
          email: email,
          name: profile.name as string,
          image: profile.picture as string,
        }
      },
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  onAPIError: {
    onError: (error) => {
      if (error instanceof Error && error.message?.includes('PERSONAL_GMAIL_NOT_ALLOWED')) {
        console.error('Personal Gmail login blocked:', error.message)
      }
    },
  },

  plugins: [
    twoFactor({
      issuer: 'Aegis Portal',
      totpOptions: {
        period: 30,
        digits: 6,
      },
    }),
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
    bearer(),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        const { queueEmail } = await import('@/lib/email-queue')
        // Fail-loud for user-facing flows (design D7): password reset
        // requires a working email path. Signup verification and OTP
        // sign-in are queued unconditionally — the user has already
        // proven control via password/session, so the email is a nicety
        // not a gate. Worker logs unsendable attempts to email_attempts.
        if (type === 'forget-password') {
          const { isEmailConfigured } = await import('@/lib/email-settings')
          if (!(await isEmailConfigured())) {
            throw new Error(
              'email-not-configured: Password reset is currently unavailable. ' +
                'Your administrator needs to configure email at Settings → Email.',
            )
          }
        }
        const subjects: Record<string, string> = {
          'sign-in': 'Your Aegis Login Code',
          'email-verification': 'Verify Your Email — Aegis',
          'forget-password': 'Password Reset Code — Aegis',
        }
        await queueEmail({
          to: email,
          subject: subjects[type] || 'Your Aegis Code',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Aegis</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
                <p style="margin: 0 0 10px; color: #374151;">Your verification code is:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; padding: 15px; background: white; border-radius: 8px; border: 2px dashed #d1d5db; margin: 10px 0;">
                  ${otp}
                </div>
                <p style="margin: 15px 0 0; color: #6b7280; font-size: 13px;">
                  This code expires in 5 minutes. Do not share it with anyone.
                </p>
              </div>
            </div>
          `,
          type: 'system',
          priority: 'critical',
        })
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      disableSignUp: true, // Only existing users can sign in with OTP
    }),
  ],

  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/forgot-password': { window: 300, max: 3 },
    },
  },

  // Auth-foundations Phase 1 D8: every credential lifecycle event flows
  // through logAuthEvent. Per-endpoint switch covers signin/signup/signout,
  // OTP send + verify, and password reset completion.
  //
  // Success determination: `typeof returned.status === 'number' && status < 400`.
  // Earlier `!returned?.status || status < 400` was buggy — when the request
  // errored before returning a structured response (e.g., CSRF rejection on
  // /sign-out), `returned.status` is undefined, `!undefined` is true, so the
  // hook falsely recorded success and wrote a logout audit row even on the
  // 403. Fixed 2026-04-26 by treating undefined-status as failure.
  //
  // Duplicate emit: hooks.after fires twice per signin/signout (caught by the
  // 2026-04-26 regression suite). Mitigated via shouldEmitAuthEvent's per-
  // (action, sessionId) dedup window.
  // /sign-out audit lives in app/api/auth/[...all]/route.ts — by hooks.after
  // Better Auth has already cleared the session row, and the hooks.before
  // ctx.context.session is the framework's session-config, not the runtime
  // user-session. The catch-all route can call auth.api.getSession() with
  // the request headers to capture user info before the endpoint runs.
  hooks: {
    // unified-auth-bootstrap D2: server-side signup gate. Self-registration is
    // only permitted at first-run (empty user table) or for allowlisted email
    // domains once an owner exists. This is the enforcement point — the login
    // page's create-account link (signup-status) is UX only and never trusted.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return
      // First-run claim: while no account exists, the first sign-up must
      // present the one-time setup token from the server log / data volume
      // (lib/first-run-token.ts). Stops whoever reaches a fresh instance first
      // from claiming it.
      if (await hasNoUsers()) {
        const presented =
          setupTokenFromHeaders(ctx.headers) ?? setupTokenFromHeaders(ctx.request?.headers)
        if (!verifySetupToken(presented)) {
          throw new APIError('FORBIDDEN', {
            message:
              "A valid setup token is required. Find it in the server log: docker compose logs aegis | grep 'setup token'",
          })
        }
      }
      const body = (ctx.body || {}) as Record<string, unknown>
      const email = typeof body.email === 'string' ? body.email : ''
      if (!email || !(await isSelfSignupPermitted(email))) {
        throw new APIError('FORBIDDEN', {
          message: 'Self-registration is closed. Ask an administrator for an invite.',
        })
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      try {
        const path = ctx.path
        // (Removed dev debug log line that printed `returned` payloads.)
        const ip = ctx.request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          ctx.request?.headers?.get('x-real-ip') || null
        const ua = ctx.request?.headers?.get('user-agent') || null
        // Better Auth's `ctx.context.returned` is the response BODY (not a
        // status wrapper). Successful endpoints return shapes like
        // `{user, token, redirect}` (signin) or `{success: true}` (signout);
        // rejected requests (CSRF / bad media type) return `{code, message}`.
        // We use signal-per-event below — `newSession` for signins,
        // `returned.success === true` for ack-style endpoints, and explicit
        // error-shape detection elsewhere.
        const returned = ctx.context.returned as Record<string, unknown> | undefined
        const isErrorShape = !!returned && typeof returned.code === 'string'
        const body = (ctx.body || {}) as Record<string, unknown>
        const email = typeof body.email === 'string' ? body.email : undefined
        const newSession = ctx.context.newSession as { user?: { email?: string; id?: string }; session?: { id?: string } } | undefined
        const oldSession = ctx.context.session as { session?: { id?: string }; user?: { email?: string; id?: string } } | undefined
        const sessionEmail = newSession?.user?.email
        const sessionUserId = newSession?.user?.id
        const sessionIdForDedup = newSession?.session?.id ?? oldSession?.session?.id ?? null

        switch (path) {
          case '/sign-in/email':
          case '/sign-in/social': {
            // Signin success signal: newSession populated AND no error shape.
            const success = !!sessionUserId && !isErrorShape
            const action = success ? 'login' : 'login_failed'
            if (!shouldEmitAuthEvent(action, sessionIdForDedup ?? email ?? null)) break
            logAuthEvent({
              email: sessionEmail || email,
              userId: sessionUserId,
              action,
              method: path === '/sign-in/social' ? 'google' : 'email',
              actorIp: ip,
              success,
              userAgent: ua,
            })
            break
          }

          case '/sign-up/email': {
            const success = !!sessionUserId && !isErrorShape
            if (!success) break
            if (!shouldEmitAuthEvent('signup', sessionIdForDedup ?? email ?? null)) break
            logAuthEvent({
              email: sessionEmail || email,
              userId: sessionUserId,
              action: 'signup',
              method: 'email',
              actorIp: ip,
              success: true,
              userAgent: ua,
            })
            break
          }

          // /sign-out is audited from app/api/auth/[...all]/route.ts —
          // session info isn't available here.

          case '/email-otp/send-verification-otp': {
            // Send-OTP success: ack body without error shape.
            const success = !isErrorShape
            if (!success) break
            const otpType = typeof body.type === 'string' ? body.type : undefined
            if (!shouldEmitAuthEvent('otp_sent', email ?? null)) break
            logAuthEvent({
              email,
              action: 'otp_sent',
              method: otpType ? `otp_${otpType}` : 'otp',
              actorIp: ip,
              success: true,
              userAgent: ua,
              metadata: { otpType },
            })
            break
          }

          case '/sign-in/email-otp':
          case '/email-otp/verify-email': {
            // OTP verify success: newSession populated for sign-in path; ack
            // body for email-verification path. Either way, no error shape.
            const success = !isErrorShape && (!!sessionUserId || returned?.success === true)
            if (!success) break
            if (!shouldEmitAuthEvent('otp_verified', sessionIdForDedup ?? email ?? null)) break
            logAuthEvent({
              email: sessionEmail || email,
              userId: sessionUserId,
              action: 'otp_verified',
              method: path === '/email-otp/verify-email' ? 'otp_email-verification' : 'otp_sign-in',
              actorIp: ip,
              success: true,
              userAgent: ua,
            })
            break
          }

          case '/reset-password':
          case '/email-otp/reset-password': {
            const success = !isErrorShape
            if (!success) break
            if (!shouldEmitAuthEvent('password_reset_completed', email ?? null)) break
            logAuthEvent({
              email,
              action: 'password_reset_completed',
              method: 'email',
              actorIp: ip,
              success: true,
              userAgent: ua,
            })
            break
          }
        }
      } catch (err) {
        // Audit failure must never break the auth flow.
        console.error('[auth.hooks.after] audit log failed:', err)
      }
    }),
  },

  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  advanced: {
    cookiePrefix: 'better-auth',
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https') ?? false,
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },

  // Additional trusted origins (e.g. aliases pointing at the same backend
  // through different DNS names) come from BETTER_AUTH_TRUSTED_ORIGINS as
  // a comma-separated list. Better Auth requires the exact origin a
  // request comes from to be in this list, so a deploy reachable as
  // both X and Y needs both listed.
  // Loopback aliases are expanded and the final list is logged at boot — see
  // lib/trusted-origins.ts for why a bare BETTER_AUTH_URL is a production
  // lockout risk.
  trustedOrigins: buildTrustedOrigins('http://localhost:3000', 'aegis'),
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

// Helper to check if registration is allowed
// Used by middleware and API routes
async function hasNoUsers(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM "user"')
    return parseInt(result.rows[0].count, 10) === 0
  } catch {
    // Can't tell — treat as first run so the token is still required.
    return true
  }
}

export async function isRegistrationAllowed(): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION === 'true') {
    return true
  }
  
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM "user"')
    const userCount = parseInt(result.rows[0].count, 10)
    return userCount === 0
  } catch {
    return true
  }
}

// Allowed email domains for self-service signup AFTER the first-run owner
// claim (unified-auth-bootstrap D3). Sourced from the existing Domains feature:
// domains an admin has marked "Allow self-registration" in
// Settings → Domains (organization_domains.allow_self_registration). No admins
// set ⇒ empty ⇒ signup is invite/admin-only once the first user exists.
// Single-tenant, so no organization_id filter is needed (one org's rows only).
export async function getAllowedSignupDomains(): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT lower(domain) AS domain
         FROM organization_domains
        WHERE allow_self_registration = true`
    )
    return result.rows
      .map((r) => (typeof r.domain === 'string' ? r.domain.trim().toLowerCase() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

export type SignupState = 'open' | 'closed' | 'domain-gated'

// Live signup posture for the operator tier (unified-auth-bootstrap D4).
// Drives BOTH the server-side gate (hooks.before) and the login page's
// create-account link (via GET /api/auth/signup-status). The gate is the
// enforcement point; the status endpoint is UX only.
//   - open:        first-run (no users yet) or ALLOW_REGISTRATION override
//   - domain-gated: closed to the public, but allowlisted domains may register
//   - closed:      invite-only (admin creates users; they use a set-password link)
export async function getSignupStatus(): Promise<{ state: SignupState; allowedDomains: string[] }> {
  if (await isRegistrationAllowed()) {
    return { state: 'open', allowedDomains: [] }
  }
  const allowedDomains = await getAllowedSignupDomains()
  return { state: allowedDomains.length > 0 ? 'domain-gated' : 'closed', allowedDomains }
}

// Server-side gate: may THIS email self-register right now? Enforcement point
// for unified-auth-bootstrap D2, called from hooks.before on /sign-up/email.
// Invited users never reach /sign-up/email — admin provisions them and they
// set a password via the set-password link — so this only governs self-signup.
export async function isSelfSignupPermitted(email: string): Promise<boolean> {
  const { state, allowedDomains } = await getSignupStatus()
  if (state === 'open') return true
  if (state === 'closed') return false
  const domain = email.split('@')[1]?.trim().toLowerCase()
  return !!domain && allowedDomains.includes(domain)
}
