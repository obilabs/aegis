/**
 * Outbound email header construction (D28b, D28e, D29).
 *
 *   - HMAC-signed Message-ID per D28b
 *   - In-Reply-To references most-recent in-thread message (NOT first)
 *   - References accumulates the chain trimmed at 30KB (RFC 5322)
 *   - Subject normalization to `Re: [<prefix>-<number>] subject` using the
 *     ticket's actual prefix (NOT a hardcoded AEGIS prefix)
 *   - Protective headers are scope-aware (D28e):
 *       - auto_notification: full set incl. `Precedence: bulk`
 *       - human_reply / ai_reply: `X-Loop` only (no `Precedence: bulk` —
 *         M365 EOP treats it as a strong negative spam signal)
 */

import { buildSignedMessageId, type SigningKeys } from './signing'

const REFERENCES_MAX_BYTES = 30_000 // RFC 5322 mentions 998-char lines but
                                    // accumulators may break on absurd lengths

export type OutboundOrigin = 'auto_notification' | 'human_reply' | 'ai_reply'

export interface OutboundHeadersInput {
  instanceUuid: string
  ticketId: string
  replyId: string
  /** Stable host portion of Message-ID. Per-mailbox configurable; see D28b. */
  messageIdHost: string
  signingKeys: SigningKeys
  /** Most-recent in-thread message-id (in or outbound) — used for In-Reply-To. */
  parentMessageId: string | null
  /** Full thread chain (oldest → newest), used for References. */
  threadReferences: string[]
  /** The ticket's actual prefix + number (e.g., 'TKT', 12345). NEVER hardcoded. */
  ticketPrefix: string
  ticketNumber: number
  /** Original subject, before re-prefixing. */
  originalSubject: string
  /** Reply-to address — set as X-Loop for self-loop detection on inbound. */
  replyAddress: string
  origin: OutboundOrigin
}

export interface OutboundHeaders {
  messageId: string
  inReplyTo: string | null
  references: string | null
  subject: string
  /** Extra headers — pass through nodemailer.sendMail({ headers }) verbatim. */
  extraHeaders: Record<string, string>
}

/**
 * Build all outbound headers for one email send. Pure function — caller
 * persists `messageId` to ticket_replies.outbound_message_id.
 */
export function buildOutboundHeaders(input: OutboundHeadersInput): OutboundHeaders {
  const messageId = buildSignedMessageId({
    instanceUuid: input.instanceUuid,
    ticketId: input.ticketId,
    replyId: input.replyId,
    host: input.messageIdHost,
    keys: input.signingKeys,
  })

  const inReplyTo = input.parentMessageId ? wrapAngle(input.parentMessageId) : null

  // References: dedupe + trim. Spec keeps oldest → newest, then we append the
  // current message (the parent) so the chain reads parent-of-parent → parent.
  const refs = buildReferences(input.threadReferences, input.parentMessageId)

  const subject = normalizeSubject(input.originalSubject, input.ticketPrefix, input.ticketNumber)

  const extraHeaders: Record<string, string> = {
    'X-Loop': input.replyAddress,
  }

  switch (input.origin) {
    case 'auto_notification':
      // Full RFC 3834 + vendor convention set. M365 EOP penalty for
      // `Precedence: bulk` is acceptable on these — system notifications
      // SHOULD be classified differently from human replies.
      extraHeaders['Auto-Submitted'] = 'auto-generated'
      extraHeaders['X-Auto-Response-Suppress'] = 'All'
      extraHeaders['Precedence'] = 'bulk'
      break

    case 'ai_reply':
      // Recipient SHOULD know they got an AI reply (D17 honesty principle);
      // their autoresponder can choose to suppress. Auto-Submitted is the
      // honest signal — but DO NOT add `Precedence: bulk`, it tanks delivery
      // on fresh-domain installs.
      extraHeaders['Auto-Submitted'] = 'auto-generated'
      break

    case 'human_reply':
      // Pure human reply — only X-Loop for self-detection. No
      // `Auto-Submitted`, no `Precedence` — these would mark a real human
      // reply as bulk and harm delivery.
      break
  }

  return {
    messageId,
    inReplyTo,
    references: refs,
    subject,
    extraHeaders,
  }
}

/**
 * RFC 5322 normalization: prepend `Re: [<prefix>-<number>]` to the subject
 * if it's not already present. Idempotent — won't double-prefix on
 * subsequent replies.
 */
function normalizeSubject(original: string, prefix: string, number: number): string {
  const token = `[${prefix}-${number}]`
  const stripped = original.replace(/^\s*(re|fwd?):\s*/i, '').trim()
  if (stripped.includes(token)) {
    // Subject already carries our token (probably from the recipient
    // hitting reply on a prior thread message). Just ensure `Re: ` is
    // prepended for client-side threading.
    return /^re:\s/i.test(original) ? original : `Re: ${original}`
  }
  return `Re: ${token} ${stripped}`
}

function wrapAngle(messageId: string): string {
  const trimmed = messageId.trim()
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return trimmed
  return `<${trimmed.replace(/^<|>$/g, '')}>`
}

/**
 * Build the References header. De-duplicates (case-insensitive on the bare
 * id), wraps each entry in angle brackets, and trims at REFERENCES_MAX_BYTES
 * to prevent runaway accumulation on long-lived threads.
 *
 * If trimming is needed, KEEP THE FIRST id (the thread root) plus as many
 * recent ids as fit — the IETF guidance is to retain the root for client
 * threading and drop middle nodes.
 */
function buildReferences(chain: string[], parent: string | null): string | null {
  const seen = new Set<string>()
  const wrapped: string[] = []
  for (const id of [...chain, parent].filter((s): s is string => !!s)) {
    const bare = id.trim().replace(/^<|>$/g, '').toLowerCase()
    if (!bare || seen.has(bare)) continue
    seen.add(bare)
    wrapped.push(wrapAngle(id))
  }
  if (wrapped.length === 0) return null

  const joined = wrapped.join(' ')
  if (Buffer.byteLength(joined, 'utf8') <= REFERENCES_MAX_BYTES) return joined

  // Trim middle entries, retaining root + tail.
  const root = wrapped[0]
  const tail: string[] = []
  let bytes = Buffer.byteLength(root, 'utf8')
  for (let i = wrapped.length - 1; i > 0; i--) {
    const candidate = wrapped[i]
    const next = bytes + 1 + Buffer.byteLength(candidate, 'utf8')
    if (next > REFERENCES_MAX_BYTES) break
    tail.unshift(candidate)
    bytes = next
  }
  return [root, ...tail].join(' ')
}
