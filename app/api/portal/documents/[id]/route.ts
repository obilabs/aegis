import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/access'
import { toSafeHtml } from '@/lib/article-render'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  changeSummary: z.string().optional(),
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
    // RBAC read scoping (audit 2026-07-23): the detail read ignored folder
    // permissions — any user could read any document by id, bypassing
    // restricted-folder access. Replicate the LIST's predicate: a doc in a
    // restricted folder is readable only by a role with a folder_permissions
    // grant (admins bypass). Inaccessible → 404 (never leak existence).
    const userRole = session.user.role || 'user'
    const folderAccess = userRole !== 'admin'
      ? `AND (
          d.folder_id IS NULL
          OR f.is_restricted = false
          OR EXISTS (
            SELECT 1 FROM folder_permissions fp
            WHERE fp.folder_id = d.folder_id AND fp.role = $3
          )
        )`
      : ''
    const doc = await queryOne(
      `SELECT d.*, f.name AS folder_name, co.name AS company_name,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS created_by_name
       FROM documents d
       LEFT JOIN folders f ON d.folder_id = f.id
       LEFT JOIN companies co ON d.company_id = co.id
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = $1 AND d.organization_id = $2 AND d.is_deleted = false ${folderAccess}`,
      userRole !== 'admin' ? [id, orgId, userRole] : [id, orgId]
    )

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Increment view count
    await query('UPDATE documents SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = $1', [id])

    // Get version history
    const versions = await query(
      `SELECT dv.id, dv.version_number, dv.title, dv.change_summary, dv.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS created_by_name
       FROM document_versions dv
       LEFT JOIN users u ON dv.created_by = u.id
       WHERE dv.document_id = $1
       ORDER BY dv.version_number DESC`,
      [id]
    )

    // Get attachments
    const attachments = await query(
      `SELECT da.id, da.file_name, da.file_type, da.file_size, da.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS uploaded_by_name
       FROM document_attachments da
       LEFT JOIN users u ON da.uploaded_by = u.id
       WHERE da.document_id = $1 AND da.organization_id = $2
       ORDER BY da.created_at DESC`,
      [id, orgId]
    )

    return NextResponse.json({ document: doc, versions, attachments })
  } catch (error) {
    console.error('Failed to fetch document:', error)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
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
    'SELECT id FROM documents WHERE id = $1 AND organization_id = $2 AND is_deleted = false',
    [id, orgId]
  )
  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const d = parsed.data
  // Rich text: sanitized on write (and again at render via <SafeHtml>).
  if (d.content) d.content = toSafeHtml(d.content)
  const sets: string[] = []
  const vals: any[] = []
  let idx = 1

  if (d.title !== undefined) { sets.push(`title = $${idx++}`); vals.push(d.title) }
  if (d.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(d.description || null) }
  if (d.content !== undefined) {
    sets.push(`content = $${idx++}`)
    vals.push(d.content || null)
    const raw = d.content ? d.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : null
    sets.push(`content_raw = $${idx++}`)
    vals.push(raw)
  }
  if (d.folderId !== undefined) { sets.push(`folder_id = $${idx++}`); vals.push(d.folderId) }
  if (d.tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(d.tags) }
  if (d.isPublic !== undefined) { sets.push(`is_public = $${idx++}`); vals.push(d.isPublic) }
  if (d.isPinned !== undefined) { sets.push(`is_pinned = $${idx++}`); vals.push(d.isPinned) }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const userId = await getUserId(session.user.email)
  sets.push(`updated_by = $${idx++}`)
  vals.push(userId)
  sets.push(`updated_at = NOW()`)
  vals.push(id)
  vals.push(orgId)

  try {
    await query(
      `UPDATE documents SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++}`,
      vals
    )

    // Create new version if content changed
    if (d.content !== undefined) {
      const maxVersion = await queryOne(
        'SELECT COALESCE(MAX(version_number), 0) AS max FROM document_versions WHERE document_id = $1',
        [id]
      )
      await query(
        `INSERT INTO document_versions (document_id, version_number, title, content, change_summary, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, (maxVersion?.max || 0) + 1, d.title || 'Updated', d.content, d.changeSummary || null, userId]
      )
    }

    return NextResponse.json({ message: 'Updated successfully' })
  } catch (error) {
    console.error('Failed to update document:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
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

  const existing = await queryOne(
    'SELECT id FROM documents WHERE id = $1 AND organization_id = $2 AND is_deleted = false',
    [id, orgId]
  )
  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const userId = await getUserId(session.user.email)
    await query(
      `UPDATE documents SET is_deleted = true, deleted_at = NOW(), deleted_by_user_id = $1
       WHERE id = $2 AND organization_id = $3`,
      [userId, id, orgId]
    )

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Failed to delete document:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
