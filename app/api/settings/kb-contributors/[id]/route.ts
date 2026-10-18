/**
 * KB Contributor API - Single Contributor Operations
 */

import { requireStaff } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    if (!session.user.role || !['admin', 'manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Admin or manager access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      display_name,
      bio,
      expertise_areas,
      requires_approval,
      can_self_publish,
      is_featured,
      is_active,
    } = body

    const result = await pool.query(`
      UPDATE kb_contributors
      SET 
        display_name = COALESCE($1, display_name),
        bio = $2,
        expertise_areas = COALESCE($3, expertise_areas),
        requires_approval = COALESCE($4, requires_approval),
        can_self_publish = COALESCE($5, can_self_publish),
        is_featured = COALESCE($6, is_featured),
        is_active = COALESCE($7, is_active),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      display_name,
      bio,
      expertise_areas,
      requires_approval,
      can_self_publish,
      is_featured,
      is_active,
      id,
    ])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contributor not found' }, { status: 404 })
    }

    return NextResponse.json({ contributor: result.rows[0] })
  } catch (error) {
    console.error('Failed to update KB contributor:', error)
    return NextResponse.json(
      { error: 'Failed to update contributor' },
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

    // Get the contributor's user_id before deleting
    const contributorResult = await pool.query(
      'SELECT user_id FROM kb_contributors WHERE id = $1',
      [id]
    )
    const userId = contributorResult.rows[0]?.user_id

    // Delete the contributor
    await pool.query('DELETE FROM kb_contributors WHERE id = $1', [id])

    // Also remove KB permissions for the user
    if (userId) {
      await pool.query(`
        DELETE FROM kb_permissions 
        WHERE user_id = $1 
          AND permission IN ('kb.create.draft', 'kb.edit.own')
      `, [userId])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete KB contributor:', error)
    return NextResponse.json(
      { error: 'Failed to delete contributor' },
      { status: 500 }
    )
  }
}
