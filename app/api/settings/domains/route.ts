/**
 * Organization Domains API
 * 
 * Manage email domains for automatic user classification
 */

import { requireStaff } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization ID
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1')
    const organizationId = orgResult.rows[0]?.id

    if (!organizationId) {
      return NextResponse.json({ domains: [] })
    }

    const result = await pool.query(`
      SELECT 
        id, domain, domain_type, auto_contact_type,
        is_verified, is_primary, allow_self_registration,
        require_email_verification, auto_approve_users,
        sso_enabled, sso_provider, description, created_at
      FROM organization_domains
      WHERE organization_id = $1
      ORDER BY is_primary DESC, domain ASC
    `, [organizationId])

    return NextResponse.json({ domains: result.rows })
  } catch (error) {
    console.error('Failed to fetch domains:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      domain,
      domain_type,
      auto_contact_type,
      description,
      allow_self_registration,
      require_email_verification,
      auto_approve_users,
    } = body

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      )
    }

    // Get organization ID
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1')
    const organizationId = orgResult.rows[0]?.id

    // Check if this is the first domain (make it primary)
    const existingCount = await pool.query(
      'SELECT COUNT(*) FROM organization_domains WHERE organization_id = $1',
      [organizationId]
    )
    const isPrimary = parseInt(existingCount.rows[0].count) === 0

    const result = await pool.query(`
      INSERT INTO organization_domains (
        organization_id, domain, domain_type, auto_contact_type,
        description, allow_self_registration, require_email_verification,
        auto_approve_users, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      organizationId,
      domain.toLowerCase(),
      domain_type || 'internal',
      auto_contact_type || 'employee',
      description || null,
      allow_self_registration !== false,
      require_email_verification === true,
      auto_approve_users !== false,
      isPrimary,
    ])

    return NextResponse.json({ domain: result.rows[0] })
  } catch (error: any) {
    console.error('Failed to create domain:', error)
    
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'Domain already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 }
    )
  }
}
