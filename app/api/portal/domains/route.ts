import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId, getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  registrar: z.string().max(255).optional(),
  registrarUrl: z.string().max(500).optional(),
  registeredAt: z.string().optional(),
  expiresAt: z.string().optional(),
  autoRenew: z.boolean().optional(),
  nameservers: z.array(z.string()).optional(),
  dnsProvider: z.string().max(255).optional(),
  webhost: z.string().max(255).optional(),
  mailProvider: z.string().max(100).optional(),
  companyId: z.string().uuid().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    const rows = await query(
      `SELECT
        d.id, d.name, d.description, d.registrar, d.registrar_url,
        d.registered_at, d.expires_at, d.auto_renew,
        d.nameservers, d.dns_provider, d.webhost, d.mail_provider,
        d.is_active, d.is_important, d.notes, d.tags,
        d.company_id, d.created_at, d.updated_at,
        co.name AS company_name,
        (SELECT COUNT(*)::int FROM dns_records dr WHERE dr.domain_id = d.id) AS record_count,
        (SELECT COUNT(*)::int FROM certificates c WHERE c.domain_id = d.id AND c.is_active = true) AS cert_count
      FROM domains d
      LEFT JOIN companies co ON d.company_id = co.id
      WHERE d.organization_id = $1
      ORDER BY d.name`,
      [orgId]
    )

    const now = new Date()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    const domains = rows.map((r: any) => {
      const expiresAt = r.expires_at ? new Date(r.expires_at) : null
      return {
        ...r,
        isExpiring: expiresAt ? (expiresAt.getTime() - now.getTime()) < thirtyDays && expiresAt > now : false,
        isExpired: expiresAt ? expiresAt < now : false,
      }
    })

    return NextResponse.json({ domains })
  } catch (error) {
    console.error('Failed to fetch domains:', error)
    return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  // Authorization (audit 2026-07-23): registering an email domain is a
  // settings action.
  const ctx = await getAuthContext(request)
  if (!ctx || !(await hasCapabilityOrAdmin(ctx.userId, 'settings'))) {
    return NextResponse.json({ error: 'Requires settings capability' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  try {
    const result = await query(
      `INSERT INTO domains (
        organization_id, name, description, registrar, registrar_url,
        registered_at, expires_at, auto_renew, nameservers, dns_provider,
        webhost, mail_provider, company_id, notes, tags
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id, name, created_at`,
      [
        orgId, d.name, d.description || null, d.registrar || null, d.registrarUrl || null,
        d.registeredAt || null, d.expiresAt || null, d.autoRenew ?? true,
        d.nameservers || [], d.dnsProvider || null, d.webhost || null,
        d.mailProvider || null, d.companyId || null, d.notes || null, d.tags || [],
      ]
    )

    return NextResponse.json({ domain: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to create domain:', error)
    return NextResponse.json({ error: 'Failed to create domain' }, { status: 500 })
  }
}
