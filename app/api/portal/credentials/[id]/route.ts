import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { encrypt } from '@/lib/encryption'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  username: z.string().max(500).optional(),
  password: z.string().optional(),
  otpSecret: z.string().optional(),
  notes: z.string().optional(),
  uri: z.string().max(500).optional(),
  uriType: z.string().max(50).optional(),
  companyId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const { id } = await params

  // Authorization (audit C1): vault detail requires admin or the credentials capability.
  if (!(await hasCapabilityOrAdmin(userId, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  try {
    const cred = await queryOne(
      `SELECT
        c.id, c.name, c.description, c.category, c.username,
        c.uri, c.uri_type, c.is_important,
        c.expires_at, c.password_changed_at,
        c.tags, c.created_at, c.updated_at,
        c.company_id,
        co.name AS company_name
      FROM credentials c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = $1 AND c.organization_id = $2 AND c.is_deleted = false`,
      [id, orgId]
    )

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    // Get linked contacts
    const contacts = await query(
      `SELECT ct.id, ct.first_name || ' ' || COALESCE(ct.last_name, '') AS name
       FROM credential_links cl
       JOIN contacts ct ON cl.link_id = ct.id
       WHERE cl.credential_id = $1 AND cl.link_type = 'contact'`,
      [id]
    )

    // Get linked assets
    const assets = await query(
      `SELECT a.id, a.name, a.asset_tag
       FROM credential_links cl
       JOIN assets a ON cl.link_id = a.id
       WHERE cl.credential_id = $1 AND cl.link_type = 'asset'`,
      [id]
    )

    // Log access
    await query(
      `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'view', $3, $4)`,
      [id, userId, request.headers.get('x-forwarded-for') || '', request.headers.get('user-agent') || '']
    )

    const now = new Date()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const expiresAt = cred.expires_at ? new Date(cred.expires_at) : null
    const isExpired = expiresAt ? expiresAt < now : false
    const isExpiring = expiresAt && !isExpired ? (expiresAt.getTime() - now.getTime()) < thirtyDays : false

    return NextResponse.json({
      credential: {
        id: cred.id,
        name: cred.name,
        description: cred.description || '',
        category: cred.category || 'other',
        username: cred.username || '',
        uri: cred.uri || undefined,
        uriType: cred.uri_type || undefined,
        isImportant: cred.is_important,
        expiresAt: cred.expires_at,
        passwordChangedAt: cred.password_changed_at,
        tags: cred.tags || [],
        companyId: cred.company_id,
        companyName: cred.company_name,
        linkedContacts: contacts.map((c: any) => ({ id: c.id, name: c.name?.trim() })),
        linkedAssets: assets.map((a: any) => ({ id: a.id, name: a.name, assetTag: a.asset_tag })),
        isExpiring,
        isExpired,
        createdAt: cred.created_at,
        updatedAt: cred.updated_at,
      },
    })
  } catch (error) {
    console.error('Failed to fetch credential:', error)
    return NextResponse.json({ error: 'Failed to fetch credential' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const { id } = await params

  // Authorization (audit C1): editing vault entries requires admin or the credentials capability.
  if (!(await hasCapabilityOrAdmin(userId, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  // Verify exists
  const existing = await queryOne(
    'SELECT id FROM credentials WHERE id = $1 AND organization_id = $2 AND is_deleted = false',
    [id, orgId]
  )
  if (!existing) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  const d = parsed.data
  const sets: string[] = []
  const vals: any[] = []
  let idx = 1

  if (d.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(d.name) }
  if (d.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(d.description || null) }
  if (d.category !== undefined) { sets.push(`category = $${idx++}`); vals.push(d.category) }
  if (d.username !== undefined) { sets.push(`username = $${idx++}`); vals.push(d.username) }
  if (d.password !== undefined) {
    sets.push(`password_encrypted = $${idx++}`)
    vals.push(d.password ? encrypt(d.password) : null)
    sets.push(`password_changed_at = $${idx++}`)
    vals.push(new Date().toISOString())
  }
  if (d.otpSecret !== undefined) {
    sets.push(`otp_secret_encrypted = $${idx++}`)
    vals.push(d.otpSecret ? encrypt(d.otpSecret) : null)
  }
  if (d.notes !== undefined) {
    sets.push(`notes_encrypted = $${idx++}`)
    vals.push(d.notes ? encrypt(d.notes) : null)
  }
  if (d.uri !== undefined) { sets.push(`uri = $${idx++}`); vals.push(d.uri || null) }
  if (d.uriType !== undefined) { sets.push(`uri_type = $${idx++}`); vals.push(d.uriType || null) }
  if (d.companyId !== undefined) { sets.push(`company_id = $${idx++}`); vals.push(d.companyId) }
  if (d.expiresAt !== undefined) { sets.push(`expires_at = $${idx++}`); vals.push(d.expiresAt) }
  if (d.tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(d.tags) }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  sets.push(`updated_by = $${idx++}`)
  vals.push(userId)
  sets.push(`updated_at = NOW()`)

  vals.push(id)
  vals.push(orgId)

  try {
    await query(
      `UPDATE credentials SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++}`,
      vals
    )

    // Log update
    await query(
      `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'update', $3, $4)`,
      [id, userId, request.headers.get('x-forwarded-for') || '', request.headers.get('user-agent') || '']
    )

    return NextResponse.json({ message: 'Updated successfully' })
  } catch (error) {
    console.error('Failed to update credential:', error)
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const { id } = await params

  // Authorization (audit C1): deleting vault entries requires admin or the credentials capability.
  if (!(await hasCapabilityOrAdmin(userId, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  const existing = await queryOne(
    'SELECT id FROM credentials WHERE id = $1 AND organization_id = $2 AND is_deleted = false',
    [id, orgId]
  )
  if (!existing) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  try {
    await query(
      `UPDATE credentials
       SET is_deleted = true, deleted_at = NOW(), deleted_by_user_id = $1
       WHERE id = $2 AND organization_id = $3`,
      [userId, id, orgId]
    )

    await query(
      `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'delete', $3, $4)`,
      [id, userId, request.headers.get('x-forwarded-for') || '', request.headers.get('user-agent') || '']
    )

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Failed to delete credential:', error)
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 })
  }
}
