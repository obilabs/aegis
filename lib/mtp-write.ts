/**
 * MSP write-back — the transactional core behind /api/v1/mtp/tickets/{id}/*.
 *
 * Spec: openspec/changes/msp-mtp-inline-ticket-actions (minimal write path,
 * 2026-08-16). This is the half of the customer's stated buying trigger that
 * multi-technician unblocked: before per-human identity existed MTP-side,
 * every write from every technician carried one shared address and the audit
 * trail said nothing.
 *
 * ── ONE TRANSACTION, ALWAYS ────────────────────────────────────────────────
 * Comment + status + assignee + field-history + audit all commit together or
 * none do. The failure this prevents is the one the repo keeps re-learning: a
 * write that half-lands is indistinguishable from success at the call site. An
 * MSP reply visible to a customer with no audit row is worse than a refused
 * write, because nobody finds out until an incident review.
 *
 * Audit rows are INSERTed inline here rather than through `logAudit()` for the
 * same reason the cascade-revocation path does it: `logAudit()` is
 * fire-and-forget, so its row can be lost while the mutation it describes
 * commits.
 *
 * ── is_internal IS NEVER DEFAULTED ─────────────────────────────────────────
 * `ticket_replies.is_internal` is `DEFAULT false`, i.e. the default direction
 * is PUBLIC — the dangerous one. `CommentInput.isInternal` is therefore a
 * REQUIRED boolean with no default anywhere in this module: an omitted flag is
 * a compile error, not a note silently published to the customer.
 */

import { pool } from '@/lib/db'
import type { PoolClient } from 'pg'

export interface MtpWriteContext {
  orgId: string
  /** The pairing key making the call — stamped as write provenance. */
  pairingKeyId: string
  /** Asserted acting human (X-Aegis-Acting-User-Email), already shape-validated. */
  actorEmail: string
  /** X-Aegis-Action-Ticket, captured for the audit chain. */
  actorTicketRef: string
  actorIp: string | null
}

export interface CommentInput {
  body: string
  /** REQUIRED. See the module header — there is deliberately no default. */
  isInternal: boolean
  timeSpentMinutes?: number
}

/**
 * Build the write context from an already-authorized request.
 *
 * MUST be called only after `requireScope(req, 'tickets:write')` has returned a
 * context: that call is what validates the actor headers are present and
 * well-formed (412 `missing-action-context` otherwise). Re-reading them here is
 * safe because they have already been shape-checked; the non-null assertions
 * below are that guarantee, not an assumption.
 */
export function mtpWriteContextFromRequest(
  request: Request,
  auth: { orgId: string; keyId?: string | null },
): MtpWriteContext {
  return {
    orgId: auth.orgId,
    pairingKeyId: auth.keyId ?? '',
    actorEmail: request.headers.get('x-aegis-acting-user-email') ?? '',
    actorTicketRef: request.headers.get('x-aegis-action-ticket') ?? '',
    actorIp:
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      null,
  }
}

export interface TicketWriteInput {
  comment?: CommentInput
  statusId?: string
  /** `null` explicitly unassigns; `undefined` leaves the assignee alone. */
  assigneeUserId?: string | null
}

export type MtpWriteFailure =
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'invalid_status' }
  | { ok: false; reason: 'invalid_assignee' }
  | { ok: false; reason: 'empty_write' }

export type MtpWriteResult =
  | {
      ok: true
      ticketId: string
      replyId: string | null
      statusChanged: boolean
      assigneeChanged: boolean
    }
  | MtpWriteFailure

/**
 * Resolve the asserted MSP technician to a local `users` row if one exists.
 *
 * Deliberately BEST EFFORT rather than required. The MSP's technician often
 * has no account in the customer's install, and refusing the write in that
 * case would make the write path unusable for exactly the MSPs it is for.
 * Authorship never depends on this: `msp_actor_email` carries the asserted
 * identity unconditionally, so the reply is attributable either way. When the
 * user DOES exist the link is worth having — it makes cascade revocation and
 * the customer's own "who touched this" views resolve to a person.
 */
async function resolveLocalUser(
  client: PoolClient,
  orgId: string,
  email: string,
): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id FROM users
      WHERE organization_id = $1 AND LOWER(email) = LOWER($2)
      LIMIT 1`,
    [orgId, email],
  )
  return r.rows[0]?.id ?? null
}

/**
 * Apply an MSP write to one ticket, atomically.
 *
 * Returns `not_found` for a ticket outside the caller's organization — the
 * caller MUST surface that as 404 and never 403, matching the read endpoints:
 * existence is not disclosed.
 */
export async function writeTicketUpdate(
  ticketId: string,
  ctx: MtpWriteContext,
  input: TicketWriteInput,
): Promise<MtpWriteResult> {
  const wantsComment = input.comment !== undefined
  const wantsStatus = input.statusId !== undefined
  const wantsAssignee = input.assigneeUserId !== undefined
  if (!wantsComment && !wantsStatus && !wantsAssignee) {
    return { ok: false, reason: 'empty_write' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock the row for the duration. Two technicians acting on the same ticket
    // at once is ordinary in a shared queue, and the old/new values recorded in
    // ticket_field_changes have to describe a real transition rather than a
    // read from before someone else's commit.
    const cur = await client.query<{
      id: string
      status_id: string | null
      assigned_to: string | null
    }>(
      `SELECT id, status_id, assigned_to
         FROM tickets
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE`,
      [ticketId, ctx.orgId],
    )
    const ticket = cur.rows[0]
    if (!ticket) {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'not_found' }
    }

    const actingUserId = await resolveLocalUser(client, ctx.orgId, ctx.actorEmail)

    let replyId: string | null = null
    let statusChanged = false
    let assigneeChanged = false
    const changedFields: string[] = []
    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    // ---- comment / internal note -------------------------------------------
    if (input.comment) {
      const c = input.comment
      const ins = await client.query<{ id: string }>(
        `INSERT INTO ticket_replies
           (ticket_id, user_id, content, is_internal, time_spent_minutes,
            via_pairing_key_id, msp_actor_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          ticketId,
          actingUserId,
          c.body,
          // Explicit. Never `?? false` — see the module header.
          c.isInternal,
          c.timeSpentMinutes ?? 0,
          ctx.pairingKeyId,
          ctx.actorEmail,
        ],
      )
      replyId = ins.rows[0].id
      changedFields.push('reply')
      newValues.reply_is_internal = c.isInternal

      // First public response starts the SLA response clock. An internal note
      // is not a response to the customer and deliberately does not.
      if (!c.isInternal) {
        await client.query(
          `UPDATE tickets
              SET first_response_at = COALESCE(first_response_at, NOW())
            WHERE id = $1`,
          [ticketId],
        )
      }
    }

    // ---- status ------------------------------------------------------------
    if (input.statusId !== undefined) {
      const st = await client.query<{ id: string }>(
        `SELECT id FROM ticket_statuses
          WHERE id = $1 AND organization_id = $2`,
        [input.statusId, ctx.orgId],
      )
      if (st.rows.length === 0) {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'invalid_status' }
      }
      if (ticket.status_id !== input.statusId) {
        await client.query(
          `UPDATE tickets SET status_id = $1 WHERE id = $2`,
          [input.statusId, ticketId],
        )
        await client.query(
          `INSERT INTO ticket_field_changes
             (organization_id, ticket_id, field_name, old_value, new_value,
              changed_by, change_source, change_reason)
           VALUES ($1, $2, 'status_id', $3, $4, $5, 'msp', $6)`,
          [
            ctx.orgId,
            ticketId,
            ticket.status_id,
            input.statusId,
            actingUserId,
            `via MTP pairing by ${ctx.actorEmail} (${ctx.actorTicketRef})`,
          ],
        )
        statusChanged = true
        changedFields.push('status_id')
        oldValues.status_id = ticket.status_id
        newValues.status_id = input.statusId
      }
    }

    // ---- assignee ----------------------------------------------------------
    if (input.assigneeUserId !== undefined) {
      if (input.assigneeUserId !== null) {
        const u = await client.query<{ id: string }>(
          `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
          [input.assigneeUserId, ctx.orgId],
        )
        if (u.rows.length === 0) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'invalid_assignee' }
        }
        // NOTE: the spec also wants "an MSP may only assign to its OWN techs",
        // which needs `users.msp_pairing_key_id` — that column ships in
        // migration 093 and is NOT in init.sql, so a fresh install would not
        // have it. Org membership is enforced here; the tighter pairing-scoped
        // check lands with the init.sql migration consolidation rather than
        // being written against a column a fresh install lacks.
      }
      if (ticket.assigned_to !== input.assigneeUserId) {
        await client.query(
          `UPDATE tickets SET assigned_to = $1 WHERE id = $2`,
          [input.assigneeUserId, ticketId],
        )
        await client.query(
          `INSERT INTO ticket_field_changes
             (organization_id, ticket_id, field_name, old_value, new_value,
              changed_by, change_source, change_reason)
           VALUES ($1, $2, 'assigned_to', $3, $4, $5, 'msp', $6)`,
          [
            ctx.orgId,
            ticketId,
            ticket.assigned_to,
            input.assigneeUserId,
            actingUserId,
            `via MTP pairing by ${ctx.actorEmail} (${ctx.actorTicketRef})`,
          ],
        )
        assigneeChanged = true
        changedFields.push('assigned_to')
        oldValues.assigned_to = ticket.assigned_to
        newValues.assigned_to = input.assigneeUserId
      }
    }

    await client.query(`UPDATE tickets SET updated_at = NOW() WHERE id = $1`, [ticketId])

    // ---- audit, in the SAME transaction ------------------------------------
    // actor_type 'msp' distinguishes this from a local user's action. The
    // asserted email is recorded verbatim: the bearer key authenticates the
    // FIRM, the header is the firm's assertion about which of its humans acted,
    // and conflating the two would misrepresent what was actually proven.
    await client.query(
      `INSERT INTO audit_log
         (organization_id, actor_type, user_id, actor_email, actor_ip,
          action, action_category, entity_type, entity_id,
          old_values, new_values, changed_fields, success)
       VALUES ($1, 'msp', $2, $3, $4, $5, 'update', 'ticket', $6, $7, $8, $9, true)`,
      [
        ctx.orgId,
        actingUserId,
        ctx.actorEmail,
        ctx.actorIp,
        'mtp.ticket.write',
        ticketId,
        JSON.stringify(oldValues),
        JSON.stringify({ ...newValues, action_ticket_ref: ctx.actorTicketRef }),
        changedFields,
      ],
    )

    await client.query('COMMIT')
    return { ok: true, ticketId, replyId, statusChanged, assigneeChanged }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
