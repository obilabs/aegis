import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { downloadFile, deleteFile } from '@/lib/storage'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await auth.api.getSession({ headers: _request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id, attachmentId } = await params

  // RBAC read scoping (audit 2026-07-23): gate the attachment download by the
  // PARENT document's folder permissions (same predicate as the document read
  // + LIST). Inaccessible → 404 (never leak existence).
  const userRole = session.user.role || 'user'
  const folderAccess = userRole !== 'admin'
    ? `AND (
        d.folder_id IS NULL
        OR f.is_restricted = false
        OR EXISTS (
          SELECT 1 FROM folder_permissions fp
          WHERE fp.folder_id = d.folder_id AND fp.role = $4
        )
      )`
    : ''
  const attachment = await queryOne(
    `SELECT da.storage_key, da.file_name, da.file_type
     FROM document_attachments da
     JOIN documents d ON da.document_id = d.id
     LEFT JOIN folders f ON d.folder_id = f.id
     WHERE da.id = $1 AND da.document_id = $2 AND da.organization_id = $3 AND d.is_deleted = false ${folderAccess}`,
    userRole !== 'admin' ? [attachmentId, id, orgId, userRole] : [attachmentId, id, orgId]
  )

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  try {
    const { body, contentType, contentLength } = await downloadFile(attachment.storage_key)

    return new NextResponse(body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(contentLength),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.file_name)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Failed to download attachment:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()
  const { id, attachmentId } = await params

  const attachment = await queryOne(
    'SELECT id, storage_key FROM document_attachments WHERE id = $1 AND document_id = $2 AND organization_id = $3',
    [attachmentId, id, orgId]
  )

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  try {
    await deleteFile(attachment.storage_key)
    await query('DELETE FROM document_attachments WHERE id = $1', [attachmentId])
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Failed to delete attachment:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
