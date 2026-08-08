import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'
import { buildOutboundHeaders } from '@/lib/email/outbound-headers'
import { resolveSigningKeysFromEnv } from '@/lib/email/signing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { session, userId, orgId } = ctx
    const { id: ticketId } = await params
    const body = await request.json()
    const { content, is_internal } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Verify ticket exists and belongs to this org
    const ticketResult = await pool.query(
      `SELECT t.id, t.organization_id, ts.name as status_name, ts.is_default, ts.base_status, t.status_id
       FROM tickets t
       JOIN ticket_statuses ts ON t.status_id = ts.id
       WHERE t.id = $1 AND t.organization_id = $2`,
      [ticketId, orgId]
    )

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const ticket = ticketResult.rows[0]

    // Look up the ITSM user (staff member)
    const userResult = await pool.query(
      `SELECT id, first_name, last_name, email FROM users
       WHERE organization_id = $1 AND email = $2`,
      [orgId, session.user.email]
    )
    const itsmUser = userResult.rows[0]

    // Create the reply
    const replyResult = await pool.query(
      `INSERT INTO ticket_replies (ticket_id, content, is_internal, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, is_internal, created_at`,
      [ticketId, content.trim(), is_internal || false, itsmUser?.id || null]
    )

    const reply = replyResult.rows[0]

    // Auto-assign ticket to replier if unassigned and reply is not internal
    if (itsmUser && !is_internal) {
      const assignCheck = await pool.query(
        `SELECT assigned_to FROM tickets WHERE id = $1`,
        [ticketId]
      )
      if (!assignCheck.rows[0]?.assigned_to) {
        await pool.query(
          `UPDATE tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2`,
          [itsmUser.id, ticketId]
        )
      } else {
        await pool.query(
          `UPDATE tickets SET updated_at = NOW() WHERE id = $1`,
          [ticketId]
        )
      }
    } else {
      // Update ticket's updated_at
      await pool.query(
        `UPDATE tickets SET updated_at = NOW() WHERE id = $1`,
        [ticketId]
      )
    }

    // New → Open auto-transition: if ticket is in "New" status and replier is staff
    if (ticket.status_name === 'New' && ticket.is_default && itsmUser) {
      const openStatus = await pool.query(
        `SELECT id FROM ticket_statuses
         WHERE organization_id = $1 AND name = 'Open'
         LIMIT 1`,
        [orgId]
      )

      if (openStatus.rows[0]) {
        await pool.query(
          `UPDATE tickets SET status_id = $1, updated_at = NOW() WHERE id = $2`,
          [openStatus.rows[0].id, ticketId]
        )

        // Log status transition
        await pool.query(
          `INSERT INTO ticket_status_history
           (ticket_id, from_status_id, to_status_id, changed_by, reason,
            sla_paused_seconds_at_change, sla_was_paused)
           VALUES ($1, $2, $3, $4, 'Auto-transitioned: agent replied to New ticket',
            COALESCE((SELECT sla_total_paused_seconds FROM tickets WHERE id = $1), 0),
            (SELECT sla_paused_at IS NOT NULL FROM tickets WHERE id = $1))`,
          [ticketId, ticket.status_id, openStatus.rows[0].id, userId]
        )
      }
    }

    // Queue triage job (non-blocking)
    try {
      const { queueTriageJob } = await import('@/lib/triage-worker')
      await queueTriageJob(ticketId, orgId, 'reply_added')
    } catch {
      // Triage queue failure shouldn't block reply creation
    }

    // Send email notification to contact (non-internal replies only, non-blocking)
    if (!is_internal) {
      try {
        const ticketInfo = await pool.query(
          `SELECT t.ticket_number, t.prefix, t.subject, t.contact_id, t.source_mailbox_id,
                  c.email as contact_email
           FROM tickets t
           LEFT JOIN contacts c ON t.contact_id = c.id
           WHERE t.id = $1`,
          [ticketId]
        )
        const ti = ticketInfo.rows[0]
        if (ti?.contact_email) {
          const { sendTicketReplyNotification } = await import('@/lib/email-queue')
          const replierName = itsmUser
            ? `${itsmUser.first_name} ${itsmUser.last_name}`.trim()
            : session.user.name || 'Support'

          // D28b/D29: build the signed outbound Message-ID + threading headers.
          // Failures here MUST NOT block notification delivery — fall back to
          // unsigned send so the recipient still gets the reply.
          const outboundHeaders = await buildReplyOutboundHeaders({
            ticketId,
            replyId: reply.id,
            sourceMailboxId: ti.source_mailbox_id ?? null,
            ticketPrefix: ti.prefix,
            ticketNumber: ti.ticket_number,
            originalSubject: ti.subject,
          }).catch((err) => {
            console.warn('[replies] threading-headers build failed; sending unsigned:', err)
            return null
          })

          if (outboundHeaders) {
            // Persist the signed Message-ID alongside the reply (best-effort).
            try {
              await pool.query(
                `UPDATE ticket_replies SET outbound_message_id = $1 WHERE id = $2`,
                [outboundHeaders.messageId, reply.id],
              )
            } catch (err) {
              // Column doesn't exist yet (migration 079 not applied) — log
              // and proceed without persistence. The send itself still works.
              console.warn('[replies] outbound_message_id persist skipped (column missing?):', err)
            }
          }

          await sendTicketReplyNotification({
            to: ti.contact_email,
            ticketNumber: `${ti.prefix || ''}${ti.ticket_number}`,
            ticketSubject: ti.subject,
            ticketId,
            replyPreview: content.trim().slice(0, 500),
            replierName,
            headers: outboundHeaders ? {
              messageId: outboundHeaders.messageId,
              inReplyTo: outboundHeaders.inReplyTo,
              references: outboundHeaders.references,
              extra: outboundHeaders.extraHeaders,
            } : undefined,
            sourceMailboxId: ti.source_mailbox_id ?? undefined,
          })
        }
      } catch {
        // Email failure should not block reply creation
      }
    }

    // Return reply in the format the frontend expects
    return NextResponse.json({
      id: reply.id,
      content: reply.content,
      is_internal: reply.is_internal,
      created_at: reply.created_at,
      contact: null,
      user: itsmUser ? {
        id: itsmUser.id,
        name: `${itsmUser.first_name} ${itsmUser.last_name}`.trim(),
        email: itsmUser.email,
      } : null,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating reply:', error)
    return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 })
  }
}

/**
 * Build the outbound threading headers for a staff reply (D28b + D29).
 *
 *   - Looks up instance_uuid (D28c) and the source mailbox config (if any)
 *   - Walks the prior thread to assemble References (most recent 30 messages)
 *   - parentMessageId = most-recent prior message-id (in or outbound) per D29
 *   - Falls back to env defaults when there's no source mailbox (portal-
 *     created ticket): host derived from SMTP_FROM domain, reply address from
 *     SMTP_FROM
 *
 * Throws if `system_install` row is missing (migration 079 not applied) or
 * AEGIS_SECRETS_KEY isn't configured. Caller catches and falls back to an
 * unsigned send.
 */
async function buildReplyOutboundHeaders(args: {
  ticketId: string
  replyId: string
  sourceMailboxId: string | null
  ticketPrefix: string
  ticketNumber: number
  originalSubject: string
}) {
  const installRow = await pool.query<{ instance_uuid: string }>(
    'SELECT instance_uuid FROM system_install WHERE id = 1',
  )
  if (!installRow.rows[0]) {
    throw new Error('system_install row missing — apply migration 079 before signing replies')
  }
  const instanceUuid = installRow.rows[0].instance_uuid

  const signingKeys = resolveSigningKeysFromEnv()

  let messageIdHost: string | null = null
  let replyAddress: string | null = null

  if (args.sourceMailboxId) {
    const mb = await pool.query<{ message_id_host: string | null; reply_address: string | null; username: string }>(
      'SELECT message_id_host, reply_address, username FROM inbound_mailboxes WHERE id = $1',
      [args.sourceMailboxId],
    )
    if (mb.rows[0]) {
      messageIdHost = mb.rows[0].message_id_host
      replyAddress = mb.rows[0].reply_address || mb.rows[0].username
    }
  }

  // Fall back to SMTP_FROM domain when there's no source mailbox or it
  // doesn't carry a configured host.
  const fromEnv = process.env.SMTP_FROM || 'noreply@aegis.local'
  if (!messageIdHost) messageIdHost = `aegis.${fromEnv.split('@')[1] || 'local'}`
  if (!replyAddress) replyAddress = fromEnv

  // Build References chain — oldest first, most-recent last.
  const chain = await pool.query<{
    outbound_message_id: string | null
    inbound_message_id: string | null
  }>(
    `SELECT outbound_message_id, inbound_message_id
       FROM ticket_replies
      WHERE ticket_id = $1 AND id != $2
      ORDER BY created_at ASC
      LIMIT 30`,
    [args.ticketId, args.replyId],
  )
  const refs = chain.rows
    .map(r => r.outbound_message_id || r.inbound_message_id)
    .filter((s): s is string => !!s)

  const parentMessageId = refs.length > 0 ? refs[refs.length - 1] : null

  return buildOutboundHeaders({
    instanceUuid,
    ticketId: args.ticketId,
    replyId: args.replyId,
    messageIdHost,
    signingKeys,
    parentMessageId,
    threadReferences: refs,
    ticketPrefix: args.ticketPrefix,
    ticketNumber: args.ticketNumber,
    originalSubject: args.originalSubject,
    replyAddress,
    origin: 'human_reply',
  })
}
