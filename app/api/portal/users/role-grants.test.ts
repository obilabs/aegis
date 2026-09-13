/**
 * Principle 1 — admin is bootstrapped once, then only granted by an admin.
 *
 * Exercises the real route handlers (POST /api/portal/users and
 * PATCH /api/portal/users/[id]) against an in-memory stand-in for the DB.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const ORG = '00000000-0000-4000-8000-000000000001'
const ADMIN_ROLE = '10000000-0000-4000-8000-000000000001'
const TECH_ROLE = '10000000-0000-4000-8000-000000000002'
const USER_MGR_ROLE = '10000000-0000-4000-8000-000000000003'
const ADMIN = '20000000-0000-4000-8000-000000000001'
const ADMIN2 = '20000000-0000-4000-8000-000000000004'
const MANAGER = '20000000-0000-4000-8000-000000000002' // user_management, not admin
const TECH = '20000000-0000-4000-8000-000000000003'

type Role = { admin: boolean; caps: string[] }
type User = { email: string; role_id: string | null; status: string; contact_id: string | null }

const db = {
  roles: new Map<string, Role>(),
  users: new Map<string, User>(),
  createdUsers: [] as unknown[][],
}
const audit: Array<{ action: string }> = []
let actor = ADMIN

function reset() {
  db.roles = new Map([
    [ADMIN_ROLE, { admin: true, caps: ['user_management'] }],
    [TECH_ROLE, { admin: false, caps: [] }],
    [USER_MGR_ROLE, { admin: false, caps: ['user_management'] }],
  ])
  db.users = new Map([
    [ADMIN, { email: 'admin@example.com', role_id: ADMIN_ROLE, status: 'active', contact_id: null }],
    [MANAGER, { email: 'mgr@example.com', role_id: USER_MGR_ROLE, status: 'active', contact_id: null }],
    [TECH, { email: 'tech@example.com', role_id: TECH_ROLE, status: 'active', contact_id: null }],
  ])
  db.createdUsers = []
  audit.length = 0
}

function roleOf(userId: string): Role | undefined {
  const u = db.users.get(userId)
  return u?.role_id ? db.roles.get(u.role_id) : undefined
}

async function fakeQuery(sql: string, params: unknown[] = []) {
  const s = sql.replace(/\s+/g, ' ')
  if (/FROM user_roles WHERE id = \$1 AND organization_id = \$2/.test(s)) {
    const r = db.roles.get(params[0] as string)
    return { rows: r ? [{ admin_access: r.admin }] : [] }
  }
  if (/FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id WHERE u.id = \$1/.test(s)) {
    const u = db.users.get(params[0] as string)
    return { rows: u ? [{ admin_access: roleOf(params[0] as string)?.admin ?? null, status: u.status }] : [] }
  }
  if (/COUNT\(\*\)::int AS n/.test(s)) {
    const n = [...db.users.entries()].filter(([id, u]) => u.status === 'active' && roleOf(id)?.admin).length
    return { rows: [{ n }] }
  }
  if (/SELECT role_id, status, contact_id FROM users/.test(s)) {
    const u = db.users.get(params[0] as string)
    return { rows: u ? [{ role_id: u.role_id, status: u.status, contact_id: u.contact_id }] : [] }
  }
  if (/^ ?UPDATE users SET/.test(s)) {
    const id = params[params.length - 2] as string
    const u = db.users.get(id)
    if (!u) return { rows: [] }
    const sets = s.slice(s.indexOf('SET') + 3, s.indexOf('WHERE')).split(',').map((x) => x.trim())
    sets.forEach((set) => {
      const m = set.match(/^(\w+) = \$(\d+)$/)
      if (m) (u as Record<string, unknown>)[m[1]] = params[Number(m[2]) - 1]
    })
    return { rows: [{ id, ...u }] }
  }
  if (/SELECT id FROM users WHERE email = \$1/.test(s)) return { rows: [] }
  if (/INSERT INTO contacts/.test(s)) return { rows: [{ id: 'contact-1' }] }
  if (/INSERT INTO users/.test(s)) {
    db.createdUsers.push(params)
    return { rows: [{ id: 'new-user', email: params[1], role_id: params[4] }] }
  }
  return { rows: [] }
}

vi.mock('@/lib/db', () => ({
  pool: {
    query: (sql: string, params?: unknown[]) => fakeQuery(sql, params),
    connect: async () => ({ query: (sql: string, params?: unknown[]) => fakeQuery(sql, params), release: () => {} }),
  },
  query: vi.fn(),
  queryOne: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: 'ba', email: 'x' } }) } } }))
vi.mock('@/lib/org', () => ({
  getOrgId: async () => ORG,
  getAuthContext: async () => ({ userId: actor, orgId: ORG, session: { user: { email: db.users.get(actor)?.email } } }),
}))
vi.mock('@/lib/permissions', () => ({
  isAdmin: async (id: string) => roleOf(id)?.admin === true,
  hasCapabilityOrAdmin: async (id: string, cap: string) => {
    const r = roleOf(id)
    return !!r && (r.admin || r.caps.includes(cap))
  },
}))
vi.mock('@/lib/audit', () => ({
  logAudit: (e: { action: string }) => audit.push(e),
  getClientIp: () => null,
}))
vi.mock('@/lib/setup-tokens', () => ({
  mintToken: async () => ({ url: 'http://x/set-password', expiresAt: new Date().toISOString() }),
  publicBaseUrl: () => 'http://x',
}))

const { PATCH } = await import('./[id]/route')
const { POST } = await import('./route')

function patch(target: string, body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/portal/users/${target}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  return PATCH(req, { params: Promise.resolve({ id: target }) })
}

function create(body: Record<string, unknown>) {
  const req = new NextRequest('http://localhost/api/portal/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'new@example.com', first_name: 'New', last_name: 'User', ...body }),
    headers: { 'content-type': 'application/json' },
  })
  return POST(req)
}

beforeEach(() => {
  reset()
  actor = ADMIN
})

describe('account creation never carries an admin role', () => {
  it('rejects an admin role_id from a user_management (non-admin) caller', async () => {
    actor = MANAGER
    const res = await create({ role_id: ADMIN_ROLE })
    expect(res.status).toBe(403)
    expect(db.createdUsers).toHaveLength(0)
  })

  it('rejects an admin role_id even from an admin (grant is a separate step)', async () => {
    const res = await create({ role_id: ADMIN_ROLE })
    expect(res.status).toBe(403)
    expect(db.createdUsers).toHaveLength(0)
  })

  it('rejects an unknown role_id', async () => {
    const res = await create({ role_id: '10000000-0000-4000-8000-0000000000ff' })
    expect(res.status).toBe(400)
  })

  it('still creates accounts with a non-admin role', async () => {
    actor = MANAGER
    const res = await create({ role_id: TECH_ROLE })
    expect(res.status).toBe(201)
    expect(db.createdUsers).toHaveLength(1)
  })
})

describe('admin role is only granted by an admin', () => {
  it('user_management alone cannot grant an admin role to someone else', async () => {
    actor = MANAGER
    const res = await patch(TECH, { role_id: ADMIN_ROLE })
    expect(res.status).toBe(403)
    expect(db.users.get(TECH)!.role_id).toBe(TECH_ROLE)
  })

  it('user_management alone cannot grant themselves an admin role', async () => {
    actor = MANAGER
    const res = await patch(MANAGER, { role_id: ADMIN_ROLE })
    expect(res.status).toBe(403)
    expect(db.users.get(MANAGER)!.role_id).toBe(USER_MGR_ROLE)
  })

  it('user_management alone cannot demote or suspend an admin', async () => {
    db.users.set(ADMIN2, { email: 'a2@example.com', role_id: ADMIN_ROLE, status: 'active', contact_id: null })
    actor = MANAGER
    expect((await patch(ADMIN2, { role_id: TECH_ROLE })).status).toBe(403)
    expect((await patch(ADMIN2, { status: 'suspended' })).status).toBe(403)
    expect(db.users.get(ADMIN2)!.role_id).toBe(ADMIN_ROLE)
    expect(db.users.get(ADMIN2)!.status).toBe('active')
  })

  it('an admin can grant an admin role, and it is audited', async () => {
    const res = await patch(TECH, { role_id: ADMIN_ROLE })
    expect(res.status).toBe(200)
    expect(db.users.get(TECH)!.role_id).toBe(ADMIN_ROLE)
    expect(audit.map((a) => a.action)).toContain('user.admin_role_granted')
  })

  it('nobody changes their own role — not even an admin', async () => {
    db.users.set(ADMIN2, { email: 'a2@example.com', role_id: ADMIN_ROLE, status: 'active', contact_id: null })
    const res = await patch(ADMIN, { role_id: TECH_ROLE })
    expect(res.status).toBe(403)
    expect(db.users.get(ADMIN)!.role_id).toBe(ADMIN_ROLE)
  })

  it('user_management can still assign non-admin roles to non-admins', async () => {
    const other = '20000000-0000-4000-8000-000000000009'
    db.users.set(other, { email: 'o@example.com', role_id: null, status: 'active', contact_id: null })
    actor = MANAGER
    const res = await patch(other, { role_id: TECH_ROLE })
    expect(res.status).toBe(200)
    expect(db.users.get(other)!.role_id).toBe(TECH_ROLE)
  })

  it('the last active admin cannot be removed', async () => {
    db.users.set(ADMIN2, { email: 'a2@example.com', role_id: ADMIN_ROLE, status: 'suspended', contact_id: null })
    actor = ADMIN2 // suspended admin row is not counted; ADMIN is the last active admin
    const res = await patch(ADMIN, { status: 'inactive' })
    expect(res.status).toBe(409)
  })
})
