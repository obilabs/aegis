/**
 * Organization Domain API - Single Domain Operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
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

    const result = await pool.query(`
      UPDATE organization_domains
      SET 
        domain = COALESCE($1, domain),
        domain_type = COALESCE($2, domain_type),
        auto_contact_type = COALESCE($3, auto_contact_type),
        description = $4,
        allow_self_registration = COALESCE($5, allow_self_registration),
        require_email_verification = COALESCE($6, require_email_verification),
        auto_approve_users = COALESCE($7, auto_approve_users),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      domain?.toLowerCase(),
      domain_type,
      auto_contact_type,
      description,
      allow_self_registration,
      require_email_verification,
      auto_approve_users,
      id,
    ])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    return NextResponse.json({ domain: result.rows[0] })
  } catch (error) {
    console.error('Failed to update domain:', error)
    return NextResponse.json(
      { error: 'Failed to update domain' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    // Check if it's the primary domain
    const domainResult = await pool.query(
      'SELECT is_primary FROM organization_domains WHERE id = $1',
      [id]
    )

    if (domainResult.rows[0]?.is_primary) {
      return NextResponse.json(
        { error: 'Cannot delete primary domain. Set another domain as primary first.' },
        { status: 400 }
      )
    }

    await pool.query('DELETE FROM organization_domains WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete domain:', error)
    return NextResponse.json(
      { error: 'Failed to delete domain' },
      { status: 500 }
    )
  }
}
