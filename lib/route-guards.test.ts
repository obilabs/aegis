/**
 * Every API route handler must check access, or be listed below with a reason.
 *
 * The test walks app/api, splits each route.ts into its exported handlers and
 * requires each handler to call a guard (lib/access.ts, lib/require-admin.ts,
 * lib/require-scope.ts, or a permission check from lib/permissions.ts). A
 * handler that only checks "is someone signed in" is not enough: an end user
 * is signed in too.
 *
 * Handlers that are deliberately public, or that any signed-in user may call
 * because the query is limited to the caller's own rows, are listed in
 * ALLOWED with the reason. The list is exact: an entry for a route that no
 * longer exists, or that now calls a guard, fails the test too, so the list
 * cannot rot.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const API = join(ROOT, 'app', 'api')

const GUARDS = [
  /\brequireUser\(/,
  /\bfolderAccessFilter\(/,
  /\brequireStaff\(/,
  /\brequireCapability\(/,
  /\brequireTicketAccess\(/,
  /\brequireAdmin\(/,
  /\brequireScope\(/,
  /\brequireSetupToken\(/,
  /\bhasCapabilityOrAdmin\(/,
  /\bhasCapability\(/,
  /\bisAdmin\(/,
  /\bgetTicketAccessFilter\(/,
  /\bfindAccessibleTicket\(/,
  /\bgetUserPermissions\(/,
  /\brequestAllows\(/,
  /\bisAdminRequest\(/,
  /\bisStaffRequest\(/,
  /\bisAdminIdentity\(/,
  /\bisStaffIdentity\(/,
]

type Reason = string
/** "route METHOD" -> why no guard is needed. Keep sorted. */
const ALLOWED: Record<string, Reason> = {
  // ---- public by design ----
  'auth/[...all] POST': 'Better Auth handler; enforces its own session and admin-plugin rules',
  'auth/set-password POST': 'one-time set-password token is the credential',
  'auth/signup-status GET': 'login page: whether self-registration is open',
  'files/public/[...key] GET': 'public images embedded in public KB articles (public/ prefix only)',
  'health GET': 'container healthcheck',
  'kb/public GET': 'public knowledge base',
  'kb/public/article/[slug]/feedback POST': 'anonymous "was this helpful" on public articles; rate limited',
  'kb/public/search GET': 'public knowledge base search',
  'openapi GET': 'API description, no data',
  'setup/status GET': 'first-run state, no data',
  'setup/templates GET': 'first-run wizard presets, no instance data',
  'v1/mtp/handshake POST': 'pairing-key handshake; key + pairing window are the credential',

  // ---- any signed-in user; rows limited to the caller ----
  'ai/chat/suggestions GET': "prompt suggestions from the caller's own tickets and public articles",
  'ai/escalation-summary POST': "summarises the caller's own chat transcript from the request body",
  'features GET': 'feature flag states, used to render navigation',
  'portal/ai-disclaimer GET': 'static disclaimer text',
  'portal/assets/mine GET': "assets assigned to the caller's own contact",
  'portal/banners GET': "banners for the caller; dismissals stored on the caller's user row",
  'portal/catalog GET': 'service catalog items anyone may request',
  'portal/catalog/[slug] GET': 'service catalog item anyone may request',
  'portal/categories GET': 'ticket categories for the new-ticket form',
  'portal/categories/[id]/template GET': 'description template for the new-ticket form',
  'portal/dashboard/my-hardware GET': "caller's own hardware",
  'portal/dashboard/my-software GET': "caller's own software",
  'portal/dashboard/my-tickets GET': "caller's own tickets",
  'portal/dashboard/policy-progress GET': "caller's own policy acknowledgments",
  'portal/dashboard/preference GET': "caller's own dashboard preference",
  'portal/dashboard/preference POST': "caller's own dashboard preference",
  'portal/dashboard/training-progress GET': "caller's own training progress",
  'portal/documents/templates GET': 'document templates',
  'portal/kb/[slug]/acknowledge POST': 'caller acknowledges a policy for themselves',
  'portal/kb/[slug]/acknowledgment-status GET': "caller's own acknowledgment",
  'portal/kb/[slug]/complete-training POST': 'caller records their own training completion',
  'portal/kb/[slug]/training-status GET': "caller's own training status",
  'portal/kb/search GET': 'KB search; visibility resolved per caller in search_kb_articles_for_user',
  'portal/me/api-keys GET': "caller's own personal API keys",
  'portal/me/api-keys POST': 'issues a personal key capped to the caller (userMaxScopes)',
  'portal/me/api-keys/[id] DELETE': "revokes the caller's own key (owner in WHERE)",
  'portal/media GET': 'public image library (files are public by design)',
  'portal/my-tasks GET': 'ticket tasks assigned to the caller',
  'portal/notes GET': "caller's own quick notes",
  'portal/notes POST': "caller's own quick notes",
  'portal/notes/[id] DELETE': "caller's own quick notes (owner in WHERE)",
  'portal/notes/[id] PATCH': "caller's own quick notes (owner in WHERE)",
  'portal/policies/[id] POST': 'caller acknowledges a policy for themselves',
  'portal/requests POST': 'anyone may request a catalog item for themselves',
  'portal/tasks GET': "caller's own personal tasks",
  'portal/tasks POST': "caller's own personal tasks",
  'portal/tasks/[id] DELETE': "caller's own personal tasks (owner in WHERE)",
  'portal/tasks/[id] PATCH': "caller's own personal tasks (owner in WHERE)",
  'portal/telemetry-consent-banner GET': 'returns only whether to show the consent banner',
  'portal/ticket-statuses GET': 'status names and colours',
  'settings/portal GET': 'one display flag (portal guidance on/off)',
  'support/conversations DELETE': "caller's own support conversations (owner in WHERE)",
  'support/conversations GET': "caller's own support conversations",
  'support/conversations/[id]/messages GET': "caller's own conversation (owner checked)",
}

const METHOD_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) routeFiles(full, out)
    else if (name === 'route.ts') out.push(full)
  }
  return out
}

function handlers(file: string): Array<{ key: string; guarded: boolean }> {
  return analyze(relative(API, file).split(sep).slice(0, -1).join('/'), readFileSync(file, 'utf8'))
}

function analyze(route: string, src: string): Array<{ key: string; guarded: boolean }> {
  const marks = [...src.matchAll(METHOD_RE)].map((m) => ({ method: m[1], at: m.index ?? 0 }))
  // Same-file helpers (e.g. a local requireAdmin) count for every handler that calls them.
  const helperGuard = [...src.matchAll(/(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*\{/g)]
    .filter((m) => !/^(GET|POST|PUT|PATCH|DELETE)$/.test(m[1]))
    .filter((m) => {
      const start = m.index ?? 0
      const next = src.slice(start + 1).search(/\n(?:export |async function |function )/)
      const body = src.slice(start, next < 0 ? src.length : start + 1 + next)
      return GUARDS.some((g) => g.test(body))
    })
    .map((m) => new RegExp(`\\b${m[1]}\\(`))
  return marks.map((mark, i) => {
    const body = src.slice(mark.at, i + 1 < marks.length ? marks[i + 1].at : src.length)
    const guarded = GUARDS.some((g) => g.test(body)) || helperGuard.some((g) => g.test(body.slice(20)))
    return { key: `${route} ${mark.method}`, guarded }
  })
}

/**
 * Line numbers (1-based) on which a source decides admin/staff access from the
 * Better Auth identity role. Catches the role read inline AND through a local
 * it was bound to, which is how `const userRole = session.user.role` followed
 * by `includes(userRole)` went unnoticed.
 */
export function baRoleDecisions(src: string): number[] {
  const lines = src.split(/\r?\n/)

  // Locals bound to the Better Auth role, however indirectly:
  //   const userRole = session.user.role
  //   const role = isAdmin ? 'admin' : (session.user.role || 'user')
  //   const { role } = session.user
  const tainted = new Set<string>()
  for (const line of lines) {
    const assigned = line.match(/(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*[^=\n]*\buser\.role\b/)
    if (assigned) tainted.add(assigned[1])
    const reassigned = line.match(/^\s*(\w+)\s*=\s*[^=\n]*\buser\.role\b/)
    if (reassigned) tainted.add(reassigned[1])
    const destructured = line.match(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*[\w.]*\buser\b\s*$/)
    if (destructured && /\brole\b/.test(destructured[1])) tainted.add('role')
  }

  // The role used as a decision, or read straight out of the Better Auth table.
  const direct =
    /\buser\.role\s*[!=]==|[!=]==\s*[\w.]*\buser\.role\b|\.includes\(\s*[\w.]*\buser\.role\s*\)|SELECT\s+role\s+FROM\s+"user"/

  const decides = (name: string) =>
    new RegExp(
      String.raw`(\b${name}\s*[!=]==)|([!=]==\s*${name}\b)|(\.includes\(\s*${name}\s*\))|(!\s*${name}\s*[|)])`,
    )

  const hits: number[] = []
  lines.forEach((line, i) => {
    if (direct.test(line)) {
      hits.push(i + 1)
      return
    }
    for (const name of tainted) {
      if (decides(name).test(line)) {
        hits.push(i + 1)
        return
      }
    }
  })
  return hits
}

describe('API route access checks', () => {
  const all = routeFiles(API).flatMap(handlers)

  it('finds the API routes', () => {
    // Guards against a path change silently turning this into a no-op.
    expect(all.length).toBeGreaterThan(150)
  })

  it('every handler checks access or is allowed with a reason', () => {
    const missing = all.filter((h) => !h.guarded && !(h.key in ALLOWED)).map((h) => h.key)
    expect(missing, 'add a guard from lib/access.ts, or an ALLOWED entry with a reason').toEqual([])
  })

  it('flags a handler that only checks for a session (control)', () => {
    const src = [
      "export async function GET(request) {",
      "  const session = await auth.api.getSession({ headers: request.headers })",
      "  if (!session) return NextResponse.json({}, { status: 401 })",
      "  return NextResponse.json(await pool.query('SELECT * FROM contacts'))",
      "}",
      "export async function POST(request) {",
      "  const guard = await requireStaff(request)",
      "  if (guard instanceof NextResponse) return guard",
      "}",
    ].join('\n')
    expect(analyze('x', src)).toEqual([
      { key: 'x GET', guarded: false },
      { key: 'x POST', guarded: true },
    ])
  })

  it('no route decides admin or staff access from the Better Auth role', () => {
    // session.user.role / "user".role is 'admin' only for the account created
    // at setup; an administrator granted the role later would be refused.
    // Use requireStaff / requestAllows / isAdminRequest (lib/access.ts), which
    // read the application role.
    const hits = routeFiles(API).flatMap((file) => {
      const rel = relative(ROOT, file).split(sep).join('/')
      const src = readFileSync(file, 'utf8')
      const lines = src.split(/\r?\n/)
      return baRoleDecisions(src).map((n) => `${rel}:${n}: ${lines[n - 1].trim()}`)
    })
    expect(hits).toEqual([])
  })

  it('catches a Better Auth role decision taken through a local (control)', () => {
    // The first version of the check above matched only a direct comparison, so
    // `const userRole = session.user.role` followed by `includes(userRole)`
    // slipped past it. Every shape below must be caught.
    expect(baRoleDecisions("  if (session.user.role !== 'admin') return forbidden()")).toEqual([1])

    const viaLocal = [
      'export async function POST(request) {',
      '  const userRole = session.user.role',
      "  if (!userRole || !['admin', 'technician', 'helpdesk'].includes(userRole)) {",
      '    return forbidden()',
      '  }',
      '}',
    ].join('\n')
    expect(baRoleDecisions(viaLocal), 'assigned to a local, then tested').toEqual([3])

    const viaTernary = [
      "  const role = isAdmin ? 'admin' : (session.user.role || 'user')",
      "  if (role !== 'admin') return forbidden()",
    ].join('\n')
    expect(baRoleDecisions(viaTernary), 'bound through a ternary').toEqual([2])

    const viaDestructure = [
      '  const { role } = session.user',
      "  if (['admin'].includes(role)) return ok()",
    ].join('\n')
    expect(baRoleDecisions(viaDestructure), 'destructured').toEqual([2])

    // Reading the Better Auth role for something that is not an access decision
    // — here the string matched against folder_permissions.role — is allowed,
    // and so is every application-role check.
    const allowed = [
      '  const access = folderAccess(ctx.perms, session.user.role)',
      "  if (!allows(ctx.perms, { level: 'staff' })) return forbidden()",
      "  const chat = messages.filter((m) => m.role === 'user')",
      '  const perms = await getUserPermissions(userId)',
      "  if (!perms.adminAccess && perms.ticketAccess === 'own') return forbidden()",
    ].join('\n')
    expect(baRoleDecisions(allowed), 'no false positives').toEqual([])
  })

  it('the allow list has no stale entries', () => {
    const byKey = new Map(all.map((h) => [h.key, h]))
    const stale = Object.keys(ALLOWED).filter((k) => !byKey.has(k) || byKey.get(k)!.guarded)
    expect(stale, 'remove entries for routes that are gone or now guarded').toEqual([])
  })
})
