import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId, getUserId } from '@/lib/org'
import { uploadFile, buildDocumentKey, validateUpload } from '@/lib/storage'

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

  // Verify document exists and belongs to org
  const doc = await queryOne(
    'SELECT id FROM documents WHERE id = $1 AND organization_id = $2 AND is_deleted = false',
    [id, orgId]
  )
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const attachments = await query(
      `SELECT da.id, da.file_name, da.file_type, da.file_size, da.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS uploaded_by_name
       FROM document_attachments da
       LEFT JOIN users u ON da.uploaded_by = u.id
       WHERE da.document_id = $1 AND da.organization_id = $2
       ORDER BY da.created_at DESC`,
      [id, orgId]
    )
    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('Failed to fetch attachments:', error)
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id } = await params

  // Verify document exists and belongs to org
  const doc = await queryOne(
    'SELECT id FROM documents WHERE id = $1 AND organization_id = $2 AND is_deleted = false',
    [id, orgId]
  )
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validation = validateUpload(file.size, file.type)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const storageKey = buildDocumentKey(orgId, id, file.name)

    await uploadFile(storageKey, buffer, file.type)

    const userId = await getUserId(session.user.email)
    const result = await query(
      `INSERT INTO document_attachments (organization_id, document_id, file_name, file_type, file_size, storage_key, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_name, file_type, file_size, created_at`,
      [orgId, id, file.name, file.type, file.size, storageKey, userId]
    )

    return NextResponse.json({ attachment: result[0] }, { status: 201 })
  } catch (error) {
    console.error('Failed to upload attachment:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
