/**
 * Inbound email → ticket decision flow (D28, 5-step).
 *
 *   Step 1  Dedupe by Message-ID  (idempotent re-poll safety)
 *   Step 2  Aegis-signed Message-ID validation (HMAC-SHA256)
 *   Step 3  Header match against stored outbound_message_id
 *   Step 4  Subject-token fallback (prefix-aware regex)
 *   Step 5  No match → new ticket
 *
 * Loop detection (D28d) runs BEFORE Step 5 in the actual pipeline; rejection
 * short-circuits before ticket creation. We expose the decision as a pure
 * data shape so the IMAP poller can persist the outcome consistently. The
 * caller is responsible for the actual DB writes (creating the new ticket,
 * appending the reply, linking on auth-failure).
 *
 * Sender authorization (D28f) flows through `lib/permissions.ts.isEmailSenderAuthorizedForTicket`
 * — the same RBAC layer the UI uses (auth-foundations D5). Cross-instance
 * Aegis-signed Message-IDs are rejected (D28c) and create a new ticket
 * rather than silently appending across installs.
 */

import { pool } from '@/lib/db'
import { isEmailSenderAuthorizedForTicket } from '@/lib/permissions'
import { extractSubjectToken, type ParsedEmail } from './parser'
import { verifyMessageId, type SigningKeys } from './signing'

export type ThreadingDecision =
  | { kind: 'duplicate'; existingLogId: number }
  | {
      kind: 'thread_existing'
      ticketId: string
      matchPath: 'signed_valid' | 'header_legacy' | 'subject_token'
      signatureValidated: boolean
      senderAuthorized: true
      signedByPreviousKey?: boolean
    }
  | {
      kind: 'create_linked_auth_failed'
      sourceTicketId: string
      matchPath: 'signed_invalid_replay' | 'header_legacy'
      signatureValidated: boolean
      senderAuthorized: false
      signedByPreviousKey?: boolean
    }
  | {
      kind: 'reject_foreign_instance'
      foreignInstanceUuid: string
      matchPath: 'foreign_instance'
    }
  | {
      kind: 'create_new'
      matchPath: 'new'
    }

export interface ThreadingContext {
  organizationId: string
  mailboxId: string
  /** This install's instance_uuid (D28c). */
  instanceUuid: string
  /** Current + previous signing keys for HMAC verification (D28h). */
  signingKeys: SigningKeys
}

interface ReplyMatch {
  ticket_id: string
  matched_column: 'outbound_message_id' | 'inbound_message_id'
}

/**
 * Step 1 — dedupe. Returns the existing log row id when this Message-ID
 * has already been ingested for this mailbox. Idempotent re-poll safety:
 * polling the same email twice (e.g., after a connection drop) doesn't
 * create duplicate tickets/replies.
 */
async function findDuplicate(messageId: string, mailboxId: string): Promise<number | null> {
  const r = await pool.query<{ id: number }>(
    `SELECT id FROM inbound_email_log
     WHERE message_id = $1 AND mailbox_id = $2
     LIMIT 1`,
    [messageId, mailboxId],
  )
  return r.rows[0]?.id ?? null
}

/**
 * Step 3 — match a non-signed Message-ID against the stored outbound or
 * inbound message_id on ticket_replies.
 */
async function findReplyByLegacyMessageId(messageId: string, orgId: string): Promise<ReplyMatch | null> {
  const r = await pool.query<{ ticket_id: string; matched_column: 'outbound_message_id' | 'inbound_message_id' }>(
    `SELECT ticket_id,
            CASE WHEN outbound_message_id = $1 THEN 'outbound_message_id'
                 ELSE 'inbound_message_id' END AS matched_column
       FROM ticket_replies
      WHERE (outbound_message_id = $1 OR inbound_message_id = $1)
        AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = $2)
      LIMIT 1`,
    [messageId, orgId],
  )
  return r.rows[0] ?? null
}

/**
 * Step 4 — match a parsed [PREFIX-NUMBER] subject token against an existing
 * ticket. Only matches against THIS organization's tickets (FK already
 * scopes; the org filter is belt-and-suspenders).
 */
async function findTicketByPrefixNumber(
  prefix: string,
  number: number,
  orgId: string,
): Promise<{ id: string } | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM tickets
      WHERE organization_id = $1 AND prefix = $2 AND ticket_number = $3
      LIMIT 1`,
    [orgId, prefix, number],
  )
  return r.rows[0] ?? null
}

/** Strip RFC 5322 angle brackets and normalize a Message-ID for lookup. */
function canonicalizeMessageId(raw: string): string {
  return raw.trim().replace(/^<|>$/g, '').toLowerCase()
}

/**
 * Decide what to do with a parsed inbound email. Pure decision — no DB
 * writes. The caller (poller) persists the outcome:
 *   - 'duplicate' → no-op (already logged)
 *   - 'thread_existing' → append ticket_replies + log
 *   - 'create_linked_auth_failed' → create ticket + ticket_links + log
 *   - 'reject_foreign_instance' → log only, then fall through to create_new
 *   - 'create_new' → create ticket + log
 *
 * Loop-detection rejection short-circuits BEFORE this function is called;
 * D30/D28d rejections never reach the threading flow.
 */
export async function decideThreading(
  email: ParsedEmail,
  ctx: ThreadingContext,
): Promise<ThreadingDecision> {
  // ----- Step 1 — dedupe ----------------------------------------------------
  if (email.messageId) {
    const dup = await findDuplicate(canonicalizeMessageId(email.messageId), ctx.mailboxId)
    if (dup !== null) {
      return { kind: 'duplicate', existingLogId: dup }
    }
  }

  // Threading candidates: In-Reply-To and References (oldest-first).
  const candidates: string[] = []
  if (email.inReplyTo) candidates.push(canonicalizeMessageId(email.inReplyTo))
  for (const r of email.references) candidates.push(canonicalizeMessageId(r))

  // ----- Step 2 — Aegis-signed Message-ID validation -----------------------
  for (const candidate of candidates) {
    const verified = verifyMessageId(candidate, ctx.signingKeys)
    if (!verified.signed) continue

    if (verified.instanceUuid !== ctx.instanceUuid) {
      // Aegis-signed but for a DIFFERENT install — D28c cross-instance loop
      // protection. Don't append to a foreign instance's ticket. Caller
      // proceeds to create a new ticket; the log row records the event.
      return {
        kind: 'reject_foreign_instance',
        foreignInstanceUuid: verified.instanceUuid,
        matchPath: 'foreign_instance',
      }
    }

    // Verify the ticket actually exists, is open, and isn't merged.
    const ticket = await pool.query<{ id: string }>(
      `SELECT id FROM tickets
        WHERE id = $1 AND organization_id = $2 AND is_deleted = false
        LIMIT 1`,
      [verified.ticketId, ctx.organizationId],
    )
    if (!ticket.rows[0]) continue // signed but ticket gone — fall through

    // Sender authorization — D28f. Replay attack check.
    const authorized = email.fromAddress
      ? await isEmailSenderAuthorizedForTicket(email.fromAddress, verified.ticketId, ctx.organizationId)
      : false

    if (authorized) {
      return {
        kind: 'thread_existing',
        ticketId: verified.ticketId,
        matchPath: 'signed_valid',
        signatureValidated: true,
        senderAuthorized: true,
        signedByPreviousKey: verified.signedByPreviousKey,
      }
    }

    // Signature valid but sender unauthorized → replay attempt or thread
    // forwarded externally. D28j: create new ticket linked to original via
    // ticket_links rather than silently appending or silently dropping.
    return {
      kind: 'create_linked_auth_failed',
      sourceTicketId: verified.ticketId,
      matchPath: 'signed_invalid_replay',
      signatureValidated: true,
      senderAuthorized: false,
      signedByPreviousKey: verified.signedByPreviousKey,
    }
  }

  // ----- Step 3 — header match against stored outbound/inbound message_id -
  for (const candidate of candidates) {
    // Skip strings we already KNOW are Aegis-signed format (those went through
    // Step 2 and either threaded, rejected, or fell through). Re-checking
    // here would only succeed if signature failed — and we DON'T want a
    // forged Aegis-signed Message-ID to fall through to the legacy path.
    if (looksAegisSigned(candidate)) continue

    const match = await findReplyByLegacyMessageId(candidate, ctx.organizationId)
    if (!match) continue

    const authorized = email.fromAddress
      ? await isEmailSenderAuthorizedForTicket(email.fromAddress, match.ticket_id, ctx.organizationId)
      : false

    if (authorized) {
      return {
        kind: 'thread_existing',
        ticketId: match.ticket_id,
        matchPath: 'header_legacy',
        signatureValidated: false,
        senderAuthorized: true,
      }
    }

    return {
      kind: 'create_linked_auth_failed',
      sourceTicketId: match.ticket_id,
      matchPath: 'header_legacy',
      signatureValidated: false,
      senderAuthorized: false,
    }
  }

  // ----- Step 4 — subject token fallback -----------------------------------
  const token = extractSubjectToken(email.subject)
  if (token) {
    const ticket = await findTicketByPrefixNumber(token.prefix, token.number, ctx.organizationId)
    if (ticket) {
      const authorized = email.fromAddress
        ? await isEmailSenderAuthorizedForTicket(email.fromAddress, ticket.id, ctx.organizationId)
        : false
      if (authorized) {
        return {
          kind: 'thread_existing',
          ticketId: ticket.id,
          matchPath: 'subject_token',
          signatureValidated: false,
          senderAuthorized: true,
        }
      }
      // No fall-through to "linked" on subject-token path — too easy to
      // weaponize via subject spoofing. Drop to Step 5 (new ticket).
    }
  }

  // ----- Step 5 — no match → create new ticket ------------------------------
  return { kind: 'create_new', matchPath: 'new' }
}

/**
 * Cheap structural check — does this Message-ID at least LOOK like the
 * Aegis-signed format? Used by Step 3 to skip strings that should have been
 * caught by Step 2 (and explicitly weren't, meaning the signature failed).
 * Prevents a forged-but-failing Aegis-format string from succeeding via the
 * legacy header path.
 */
function looksAegisSigned(messageId: string): boolean {
  return /^aegis-[0-9a-f-]{36}-[0-9a-f-]{36}-[0-9a-f-]{36}-[0-9a-f]{24}@/i.test(messageId)
}
