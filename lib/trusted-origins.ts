/**
 * Trusted origins for Better Auth — and a loud complaint when they look wrong.
 *
 * Better Auth rejects any auth request whose Origin is not in this list, with a
 * bare 403 `{"code":"INVALID_ORIGIN"}`. The UI renders that as the string
 * "Invalid origin" and nothing else.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The 2026-08-17 launch UI sweep found sign-in and sign-up returning 403 on
 * `http://127.0.0.1:<port>` across THREE products, while the identical request
 * to `http://localhost:<port>` succeeded. `BETTER_AUTH_URL` names one hostname;
 * everything else is refused.
 *
 * In a test environment that is a nuisance. In production it is a brick: if the
 * deployed domain is not in the list, NOBODY CAN EVER LOG IN — including the
 * owner, including the person who would fix it — and the on-screen error gives
 * them no clue what is wrong. There is no recovery path through the UI.
 *
 * Two mitigations, both deliberate:
 *
 * 1. LOOPBACK EQUIVALENCE. `localhost`, `127.0.0.1` and `[::1]` are the same
 *    machine. Trusting one and refusing the others protects nothing and costs
 *    an afternoon of confusion, so all three are accepted whenever any of them
 *    is configured.
 *
 * 2. A LOUD STARTUP LINE. The list is logged at boot, so diagnosing a lockout
 *    is reading one log line rather than guessing. This is the only signal an
 *    operator gets before they are locked out.
 */

/** Expand a loopback origin to all three spellings of the same machine. */
function withLoopbackAliases(origin: string): string[] {
  try {
    const u = new URL(origin)
    const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']
    if (!LOOPBACK.includes(u.hostname) && u.hostname !== '::1') return [origin]
    return LOOPBACK.map((h) => `${u.protocol}//${h}${u.port ? `:${u.port}` : ''}`)
  } catch {
    // Not a parseable URL — pass it through untouched rather than dropping it.
    return [origin]
  }
}

/**
 * Build the trusted-origin list.
 *
 * @param fallback used when BETTER_AUTH_URL is unset (per-app dev default)
 * @param label    app name, for the startup log line
 */
export function buildTrustedOrigins(fallback: string, label: string): string[] {
  const base = process.env.BETTER_AUTH_URL || fallback
  const extra =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  const origins = Array.from(
    new Set([...withLoopbackAliases(base), ...extra.flatMap(withLoopbackAliases)]),
  )

  // Logged unconditionally. An operator locked out by this list needs to be
  // able to SEE it, and the cost is one line per boot.
  console.info(
    `[auth] ${label} trusted origins: ${origins.join(', ')}\n` +
      `[auth] Sign-in from any other origin returns 403 "Invalid origin". ` +
      `Add more with BETTER_AUTH_TRUSTED_ORIGINS (comma-separated) and restart.`,
  )

  if (!process.env.BETTER_AUTH_URL) {
    console.warn(
      `[auth] BETTER_AUTH_URL is UNSET — falling back to ${fallback}. ` +
        `In production this WILL lock every user out of ${label}: the deployed ` +
        `domain will not be trusted and the login page will only say "Invalid origin".`,
    )
  }

  return origins
}
