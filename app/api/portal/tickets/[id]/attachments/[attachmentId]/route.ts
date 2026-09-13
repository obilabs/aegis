import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { attachmentDisposition, downloadFile } from '@/lib/storage'
import { findAccessibleTicket, UUID_RE } from '@/lib/ticket-attachments'

/** GET /api/portal/tickets/[id]/attachments/[attachmentId]: download. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, attachmentId } = await params
  if (!UUID_RE.test(attachmentId)) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  try {
    const ticket = await findAccessibleTicket(id, ctx.userId, ctx.orgId)
    if (!ticket) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

    const res = await pool.query(
      `SELECT file_path, COALESCE(original_filename, filename) AS file_name
         FROM ticket_attachments WHERE id = $1 AND ticket_id = $2`,
      [attachmentId, id],
    )
    const row = res.rows[0]
    if (!row?.file_path) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

    const { body, contentType, contentLength } = await downloadFile(row.file_path)
    return new NextResponse(body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
        'Content-Disposition': attachmentDisposition(row.file_name),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Failed to download ticket attachment:', error)
    return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 })
  }
}
