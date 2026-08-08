import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { encrypt } from '@/lib/encryption'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  username: z.string().max(500).optional(),
  password: z.string().optional(),
  otpSecret: z.string().optional(),
  notes: z.string().optional(),
  uri: z.string().max(500).optional(),
  uriType: z.string().max(50).optional(),
  companyId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit C1): the vault inventory (names, usernames, URIs of
  // infrastructure) requires admin or the credentials capability; org scope alone would expose it to any
  // authenticated principal, including customer/vendor portal logins.
  if (!(await hasCapabilityOrAdmin(userId, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  try {
    const rows = await query(
      `SELECT
        c.id, c.name, c.description, c.category, c.username,
        c.uri, c.uri_type, c.is_important,
        c.expires_at, c.password_changed_at,
        c.tags, c.created_at, c.updated_at,
        c.company_id,
        co.name AS company_name,
        (SELECT COUNT(*)::int FROM credential_links cl WHERE cl.credential_id = c.id AND cl.link_type = 'contact') AS contact_count,
        (SELECT COUNT(*)::int FROM credential_links cl WHERE cl.credential_id = c.id AND cl.link_type = 'asset') AS asset_count
      FROM credentials c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.organization_id = $1 AND c.is_deleted = false
      ORDER BY c.name`,
      [orgId]
    )

    const now = new Date()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    const credentials = rows.map((r: any) => {
      const expiresAt = r.expires_at ? new Date(r.expires_at) : null
      const isExpired = expiresAt ? expiresAt < now : false
      const isExpiring = expiresAt && !isExpired ? (expiresAt.getTime() - now.getTime()) < thirtyDays : false

      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        category: r.category || 'other',
        username: r.username || '',
        uri: r.uri || undefined,
        uriType: r.uri_type || undefined,
        isImportant: r.is_important,
        expiresAt: r.expires_at,
        passwordChangedAt: r.password_changed_at,
        tags: r.tags || [],
        companyId: r.company_id,
        companyName: r.company_name,
        contactCount: r.contact_count,
        assetCount: r.asset_count,
        isExpiring,
        isExpired,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    })

    return NextResponse.json({ credentials })
  } catch (error) {
    console.error('Failed to fetch credentials:', error)
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx

  // Authorization (audit C1): creating vault entries requires admin or the credentials capability.
  if (!(await hasCapabilityOrAdmin(userId, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, description, category, username, password, otpSecret, notes, uri, uriType, companyId, expiresAt, tags } = parsed.data

  try {
    const passwordEncrypted = password ? encrypt(password) : null
    const otpSecretEncrypted = otpSecret ? encrypt(otpSecret) : null
    const notesEncrypted = notes ? encrypt(notes) : null

    const result = await query(
      `INSERT INTO credentials (
        organization_id, name, description, category, username,
        password_encrypted, otp_secret_encrypted, notes_encrypted,
        uri, uri_type, company_id, expires_at, tags,
        password_changed_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, name, created_at`,
      [
        orgId, name, description || null, category || null, username || null,
        passwordEncrypted, otpSecretEncrypted, notesEncrypted,
        uri || null, uriType || null, companyId || null,
        expiresAt || null, tags || [],
        password ? new Date().toISOString() : null,
        userId,
      ]
    )

    // Log creation
    await query(
      `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'create', $3, $4)`,
      [
        result[0].id,
        userId,
        request.headers.get('x-forwarded-for') || '',
        request.headers.get('user-agent') || '',
      ]
    )

    return NextResponse.json({ credential: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to create credential:', error)
    return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 })
  }
}
