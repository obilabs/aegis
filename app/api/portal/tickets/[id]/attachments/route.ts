import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { logAudit, getClientIp } from '@/lib/audit'
import { getAuthContext } from '@/lib/org'
import { buildTicketKey, uploadFile, validateUpload } from '@/lib/storage'
import { findAccessibleTicket } from '@/lib/ticket-attachments'

/** GET /api/portal/tickets/[id]/attachments: files attached to a ticket. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const ticket = await findAccessibleTicket(id, ctx.userId, ctx.orgId)
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const res = await pool.query(
      `SELECT ta.id, COALESCE(ta.original_filename, ta.filename) AS file_name,
              ta.mime_type AS file_type, ta.file_size, ta.created_at,
              NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS uploaded_by_name
         FROM ticket_attachments ta
         LEFT JOIN users u ON u.id = ta.uploaded_by
        WHERE ta.ticket_id = $1
        ORDER BY ta.created_at ASC`,
      [id],
    )
    return NextResponse.json({ attachments: res.rows })
  } catch (error) {
    console.error('Failed to list ticket attachments:', error)
    return NextResponse.json({ error: 'Failed to list attachments' }, { status: 500 })
  }
}

/** POST /api/portal/tickets/[id]/attachments: multipart form, field `file`. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const ticket = await findAccessibleTicket(id, ctx.userId, ctx.orgId)
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const mimeType = file.type || 'application/octet-stream'
    const validation = validateUpload(file.size, mimeType)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const storageKey = buildTicketKey(ctx.orgId, id, file.name)
    await uploadFile(storageKey, Buffer.from(await file.arrayBuffer()), mimeType)

    const name = file.name.slice(0, 255)
    const inserted = await pool.query(
      `INSERT INTO ticket_attachments
         (ticket_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, original_filename AS file_name, mime_type AS file_type, file_size, created_at`,
      [id, (storageKey.split('/').pop() || name).slice(0, 255), name, storageKey, file.size, mimeType, ctx.userId],
    )
    const attachment = inserted.rows[0]

    logAudit({
      orgId: ctx.orgId, userId: ctx.userId, action: 'ticket_attachment_added', actionCategory: 'create',
      entityType: 'tickets', entityId: id, entityName: ticket.subject,
      newValues: { attachment_id: attachment.id, file_name: name, file_size: file.size, mime_type: mimeType },
      actorIp: getClientIp(request.headers),
    })

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (error) {
    console.error('Failed to upload ticket attachment:', error)
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 })
  }
}
