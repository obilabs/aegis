import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { hasCapabilityOrAdmin } from '@/lib/permissions'
import { decrypt } from '@/lib/encryption'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { session, userId, orgId } = ctx

  // Authorization (audit C1): revealing decrypts infrastructure secrets. Org
  // scope alone is NOT enough — a customer/vendor portal login has a users
  // row too. Gate on admin OR the `credentials` role capability (granted to
  // System Admin + Technician by default; admins can grant it to any role).
  if (!(await hasCapabilityOrAdmin(userId, 'credentials'))) {
    return NextResponse.json({ error: 'Credential vault access required' }, { status: 403 })
  }

  const { id } = await params

  try {
    const cred = await queryOne(
      `SELECT id, name, password_encrypted, otp_secret_encrypted, notes_encrypted
       FROM credentials
       WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [id, orgId]
    )

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const ua = request.headers.get('user-agent') || ''

    // Log to credential_access_log
    await query(
      `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'reveal', $3, $4)`,
      [id, userId, ip, ua]
    )

    // Log to credential_reveal_log (detailed audit)
    await query(
      `INSERT INTO credential_reveal_log (
        organization_id, credential_id, credential_name,
        revealed_by_type, revealed_by_user_id, revealed_by_name, revealed_by_email,
        reveal_method, fields_revealed, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        orgId, id, cred.name,
        'user', userId, session.user.name, session.user.email,
        'ui', ['password'],
        ip, ua,
      ]
    )

    // Decrypt fields
    const result: Record<string, string | null> = {
      password: null,
      otpSecret: null,
      notes: null,
    }

    if (cred.password_encrypted) {
      result.password = decrypt(cred.password_encrypted)
    }
    if (cred.otp_secret_encrypted) {
      result.otpSecret = decrypt(cred.otp_secret_encrypted)
    }
    if (cred.notes_encrypted) {
      result.notes = decrypt(cred.notes_encrypted)
    }

    return NextResponse.json({ revealed: result })
  } catch (error) {
    console.error('Failed to reveal credential:', error)
    return NextResponse.json({ error: 'Failed to reveal credential' }, { status: 500 })
  }
}
