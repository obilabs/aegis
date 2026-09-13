import { toSafeHtml } from '@/lib/article-render'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  content: z.string().optional(),
  folderId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const folderId = request.nextUrl.searchParams.get('folderId')
  const search = request.nextUrl.searchParams.get('q')

  try {
    const userRole = session.user.role || 'user'

    let sql = `
      SELECT
        d.id, d.title, d.description, d.is_public, d.is_pinned,
        d.is_important, d.view_count, d.tags,
        d.folder_id, d.company_id,
        d.created_at, d.updated_at,
        f.name AS folder_name,
        co.name AS company_name,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS created_by_name,
        (SELECT MAX(dv.version_number) FROM document_versions dv WHERE dv.document_id = d.id) AS latest_version,
        (SELECT COUNT(*)::int FROM document_attachments da WHERE da.document_id = d.id) AS attachment_count
      FROM documents d
      LEFT JOIN folders f ON d.folder_id = f.id
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.organization_id = $1 AND d.is_deleted = false AND d.is_template = false
    `
    const params: any[] = [orgId]
    let idx = 2

    // Filter by folder permissions (admins bypass restrictions)
    if (userRole !== 'admin') {
      sql += ` AND (
        d.folder_id IS NULL
        OR f.is_restricted = false
        OR EXISTS (
          SELECT 1 FROM folder_permissions fp
          WHERE fp.folder_id = d.folder_id AND fp.role = $${idx}
        )
      )`
      params.push(userRole)
      idx++
    }

    if (folderId) {
      sql += ` AND d.folder_id = $${idx++}`
      params.push(folderId)
    }

    if (search) {
      sql += ` AND (d.title ILIKE $${idx} OR d.description ILIKE $${idx})`
      params.push(`%${search}%`)
      idx++
    }

    sql += ' ORDER BY d.is_pinned DESC, d.updated_at DESC'

    const documents = await query(sql, params)

    // Fetch folders (with permission filtering)
    let folderSql = `
      SELECT f.id, f.name, f.description, f.parent_id, f.icon, f.display_order, f.is_restricted,
        COUNT(d.id)::int AS document_count
      FROM folders f
      LEFT JOIN documents d ON d.folder_id = f.id AND d.is_deleted = false
      WHERE f.organization_id = $1
    `
    const folderParams: any[] = [orgId]
    let fIdx = 2

    if (userRole !== 'admin') {
      folderSql += ` AND (
        f.is_restricted = false
        OR EXISTS (
          SELECT 1 FROM folder_permissions fp
          WHERE fp.folder_id = f.id AND fp.role = $${fIdx}
        )
      )`
      folderParams.push(userRole)
      fIdx++
    }

    folderSql += ' GROUP BY f.id ORDER BY f.display_order, f.name'

    const folders = await query(folderSql, folderParams)

    return NextResponse.json({ documents, folders })
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
  // Rich text: sanitized on write (and again at render via <SafeHtml>).
  if (d.content) d.content = toSafeHtml(d.content)

  try {
    const userId = await getUserId(session.user.email)

    // Strip HTML for raw content
    const contentRaw = d.content ? d.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : null

    const result = await query(
      `INSERT INTO documents (
        organization_id, title, description, content, content_raw,
        folder_id, company_id, tags, is_public, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, title, created_at`,
      [
        orgId, d.title, d.description || null, d.content || null, contentRaw,
        d.folderId || null, d.companyId || null, d.tags || [],
        d.isPublic || false, userId,
      ]
    )

    // Create initial version
    await query(
      `INSERT INTO document_versions (document_id, version_number, title, content, created_by)
       VALUES ($1, 1, $2, $3, $4)`,
      [result[0].id, d.title, d.content || null, userId]
    )

    return NextResponse.json({ document: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to create document:', error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
