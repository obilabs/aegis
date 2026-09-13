import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id } = await params

  try {
    const folder = await queryOne(
      `SELECT f.id, f.name, f.description, f.parent_id, f.icon, f.display_order,
        f.is_restricted, f.created_at, f.updated_at,
        COUNT(d.id)::int AS document_count
       FROM folders f
       LEFT JOIN documents d ON d.folder_id = f.id AND d.is_deleted = false
       WHERE f.id = $1 AND f.organization_id = $2
       GROUP BY f.id`,
      [id, orgId]
    )

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Get child folders
    const children = await query(
      `SELECT id, name, icon FROM folders WHERE parent_id = $1 AND organization_id = $2 ORDER BY display_order, name`,
      [id, orgId]
    )

    // Get permissions if restricted
    let permissions: any[] = []
    if (folder.is_restricted) {
      permissions = await query(
        'SELECT id, role, permission FROM folder_permissions WHERE folder_id = $1 AND organization_id = $2',
        [id, orgId]
      )
    }

    return NextResponse.json({ folder, children, permissions })
  } catch (error) {
    console.error('Failed to fetch folder:', error)
    return NextResponse.json({ error: 'Failed to fetch folder' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await queryOne(
    'SELECT id FROM folders WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )
  if (!existing) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const d = parsed.data

  // Prevent setting parent to self or descendant
  if (d.parentId !== undefined) {
    if (d.parentId === id) {
      return NextResponse.json({ error: 'A folder cannot be its own parent' }, { status: 400 })
    }
    if (d.parentId) {
      // Check for circular reference
      let current = d.parentId
      while (current) {
        if (current === id) {
          return NextResponse.json({ error: 'Cannot move folder into its own descendant' }, { status: 400 })
        }
        const parent = await queryOne(
          'SELECT parent_id FROM folders WHERE id = $1 AND organization_id = $2',
          [current, orgId]
        )
        current = parent?.parent_id || null
      }
    }
  }

  const sets: string[] = []
  const vals: any[] = []
  let idx = 1

  if (d.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(d.name) }
  if (d.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(d.description) }
  if (d.parentId !== undefined) { sets.push(`parent_id = $${idx++}`); vals.push(d.parentId) }
  if (d.icon !== undefined) { sets.push(`icon = $${idx++}`); vals.push(d.icon) }
  if (d.displayOrder !== undefined) { sets.push(`display_order = $${idx++}`); vals.push(d.displayOrder) }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  sets.push('updated_at = NOW()')
  vals.push(id, orgId)

  try {
    await query(
      `UPDATE folders SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++}`,
      vals
    )
    return NextResponse.json({ message: 'Folder updated' })
  } catch (error) {
    console.error('Failed to update folder:', error)
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(request)
  if (guard instanceof NextResponse) return guard
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id } = await params

  const folder = await queryOne(
    'SELECT id, parent_id FROM folders WHERE id = $1 AND organization_id = $2',
    [id, orgId]
  )
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  try {
    // Move documents in this folder to the parent folder (or unassign)
    await query(
      'UPDATE documents SET folder_id = $1 WHERE folder_id = $2 AND organization_id = $3',
      [folder.parent_id || null, id, orgId]
    )

    // Move child folders to the parent folder (or make them root)
    await query(
      'UPDATE folders SET parent_id = $1 WHERE parent_id = $2 AND organization_id = $3',
      [folder.parent_id || null, id, orgId]
    )

    // Delete the folder
    await query(
      'DELETE FROM folders WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Failed to delete folder:', error)
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
  }
}
