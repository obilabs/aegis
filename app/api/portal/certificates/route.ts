import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  domainName: z.string().max(255).optional(),
  sanDomains: z.array(z.string()).optional(),
  issuer: z.string().max(255).optional(),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  serialNumber: z.string().max(255).optional(),
  certType: z.string().max(50).optional(),
  isWildcard: z.boolean().optional(),
  autoRenew: z.boolean().optional(),
  domainId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  notes: z.string().optional(),
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
        c.id, c.name, c.domain_name, c.san_domains, c.issuer,
        c.issued_at, c.expires_at, c.serial_number, c.cert_type,
        c.is_wildcard, c.is_active, c.auto_renew, c.notes,
        c.domain_id, c.company_id,
        c.created_at, c.updated_at,
        d.name AS linked_domain_name,
        co.name AS company_name,
        (SELECT COUNT(*)::int FROM certificate_assets ca WHERE ca.certificate_id = c.id) AS asset_count
      FROM certificates c
      LEFT JOIN domains d ON c.domain_id = d.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.organization_id = $1
      ORDER BY c.expires_at ASC NULLS LAST`,
      [orgId]
    )

    const now = new Date()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    const certificates = rows.map((r: any) => {
      const expiresAt = r.expires_at ? new Date(r.expires_at) : null
      const isExpired = expiresAt ? expiresAt < now : false
      const isExpiring = expiresAt && !isExpired ? (expiresAt.getTime() - now.getTime()) < thirtyDays : false

      return {
        ...r,
        isExpiring,
        isExpired,
        health: isExpired ? 'expired' : isExpiring ? 'expiring' : 'valid',
      }
    })

    return NextResponse.json({ certificates })
  } catch (error) {
    console.error('Failed to fetch certificates:', error)
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const body = await request.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  try {
    const result = await query(
      `INSERT INTO certificates (
        organization_id, name, domain_name, san_domains, issuer,
        issued_at, expires_at, serial_number, cert_type,
        is_wildcard, auto_renew, domain_id, company_id, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id, name, created_at`,
      [
        orgId, d.name, d.domainName || null, d.sanDomains || [],
        d.issuer || null, d.issuedAt || null, d.expiresAt || null,
        d.serialNumber || null, d.certType || null,
        d.isWildcard || false, d.autoRenew || false,
        d.domainId || null, d.companyId || null, d.notes || null,
      ]
    )

    return NextResponse.json({ certificate: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to create certificate:', error)
    return NextResponse.json({ error: 'Failed to create certificate' }, { status: 500 })
  }
}
