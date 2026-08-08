/**
 * KB Contributors API
 * 
 * Manage who can contribute to the knowledge base
 */

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId: organizationId } = ctx

    const result = await pool.query(`
      SELECT 
        c.id,
        c.user_id,
        c.contact_id,
        c.display_name,
        c.bio,
        c.expertise_areas,
        c.is_active,
        c.is_featured,
        c.requires_approval,
        c.can_self_publish,
        c.articles_published,
        c.articles_drafted,
        c.total_views,
        c.total_helpful_votes,
        c.created_at,
        u.email as user_email,
        ct.email as contact_email
      FROM kb_contributors c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.organization_id = $1
      ORDER BY c.is_featured DESC, c.articles_published DESC, c.display_name ASC
    `, [organizationId])

    return NextResponse.json({ contributors: result.rows })
  } catch (error) {
    console.error('Failed to fetch KB contributors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contributors' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId: organizationId } = ctx

    // Check if user is admin or manager
    if (!session.user.role || !['admin', 'manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Admin or manager access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      user_id,
      contact_id,
      display_name,
      bio,
      expertise_areas,
      requires_approval,
      can_self_publish,
      is_featured,
    } = body

    if (!user_id && !contact_id) {
      return NextResponse.json(
        { error: 'Either user_id or contact_id is required' },
        { status: 400 }
      )
    }

    const result = await pool.query(`
      INSERT INTO kb_contributors (
        organization_id, user_id, contact_id, display_name, bio,
        expertise_areas, requires_approval, can_self_publish, is_featured
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      organizationId,
      user_id || null,
      contact_id || null,
      display_name,
      bio || null,
      expertise_areas || [],
      requires_approval !== false,
      can_self_publish === true,
      is_featured === true,
    ])

    // Also grant KB permissions to the user
    if (user_id) {
      await pool.query(`
        INSERT INTO kb_permissions (organization_id, user_id, permission, granted_by)
        VALUES 
          ($1, $2, 'kb.view.internal', $3),
          ($1, $2, 'kb.create.draft', $3),
          ($1, $2, 'kb.edit.own', $3)
        ON CONFLICT DO NOTHING
      `, [organizationId, user_id, userId])
    }

    return NextResponse.json({ contributor: result.rows[0] })
  } catch (error: any) {
    console.error('Failed to create KB contributor:', error)

    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This user is already a contributor' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create contributor' },
      { status: 500 }
    )
  }
}
