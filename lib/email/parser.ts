/**
 * mailparser wrapper — turns a raw IMAP RFC 822 stream/buffer into a
 * `ParsedEmail` shape that the threading flow can reason about.
 *
 * Returns headers indexed lowercase for predictable lookup. Subject is
 * already RFC 2047-decoded by mailparser, which is what D28's subject-token
 * regex expects (run against the decoded text, never the raw header — that
 * blocks charset-based token confusion).
 *
 * No threading or loop-detection logic lives here. Caller composes:
 *   parseEmail() → detectLoop() → threading()
 */

import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser'

/**
 * Upper bound on the RFC 822 header section we will hand to `simpleParser`.
 *
 * `simpleParser` parses every address header with nodemailer's addressparser,
 * and the cost of that parse has repeatedly turned out to be super-linear in
 * the length of a single header value (nodemailer shipped addressparser
 * complexity fixes in 9.1.0, 10.0.5, 10.0.6 and 10.0.9). The parse is
 * synchronous, so a slow one does not merely delay this call — it blocks the
 * worker's event loop, and a `Promise.race` timeout around `parseEmail` does
 * not help: the timer cannot fire while the loop is blocked.
 *
 * The only guard that works is refusing the input before parsing it, so we
 * bound the header section independently of the pinned nodemailer version.
 * 256 KiB is far above anything legitimate — a long `Received:` chain plus a
 * few hundred `Cc:` recipients lands well under 32 KiB — while keeping the
 * worst case for any future regression bounded by a constant.
 */
export const MAX_HEADER_SECTION_BYTES = 256 * 1024

/**
 * Byte length of the header section: the offset of the blank line that
 * separates headers from body, so the header text without its final line
 * ending. Returns the whole length when there is no body separator, which is
 * itself a malformed message the caller should reject.
 */
export function headerSectionBytes(raw: Buffer | string): number {
  const buf = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw
  // RFC 822 separator is CRLF CRLF; tolerate bare LF LF from lax senders.
  const crlf = buf.indexOf('\r\n\r\n')
  const lf = buf.indexOf('\n\n')
  const ends = [crlf, lf].filter(i => i !== -1)
  return ends.length ? Math.min(...ends) : buf.length
}

export interface ParsedAttachment {
  /** The ContentDisposition filename or generated fallback. */
  filename: string
  contentType: string
  size: number
  /** Raw bytes — caller streams to MinIO; not retained in memory long-term. */
  content: Buffer
  /** RFC-stable identifier within the message (Content-ID). */
  cid: string | null
  /** True for inline parts (e.g., embedded images in HTML body). */
  inline: boolean
}

export interface ParsedEmail {
  /** Lowercased header name → first value. Multi-valued headers as-is. */
  headers: Record<string, string | string[] | undefined>
  messageId: string | null
  inReplyTo: string | null
  /** Full reference chain in order, oldest first. */
  references: string[]
  fromAddress: string | null
  /** Sender display name, if present in the From header. */
  fromName: string | null
  toAddresses: string[]
  ccAddresses: string[]
  subject: string | null
  /** Plain-text body. May be derived from HTML if no text part exists. */
  text: string | null
  html: string | null
  /** RFC 5322 Date header parsed; falls back to null if missing/invalid. */
  date: Date | null
  contentType: string | null
  attachments: ParsedAttachment[]
  /** Total raw bytes, for the size limit check. */
  rawSizeBytes: number
}

function pickAddresses(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return []
  const list = Array.isArray(addr) ? addr : [addr]
  const out: string[] = []
  for (const a of list) {
    for (const v of a.value || []) {
      if (v.address) out.push(v.address)
    }
  }
  return out
}

function pickFirstAddress(
  addr: AddressObject | AddressObject[] | undefined,
): { address: string | null; name: string | null } {
  if (!addr) return { address: null, name: null }
  const first = Array.isArray(addr) ? addr[0] : addr
  const v = first?.value?.[0]
  return {
    address: v?.address ?? null,
    name: v?.name ?? null,
  }
}

function lowercaseHeaders(parsed: ParsedMail): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {}
  parsed.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (typeof value === 'string') {
      out[k] = value
    } else if (Array.isArray(value)) {
      // mailparser returns string[] for repeated headers and StructuredHeader[]
      // for some structured ones (Received, etc.). Flatten to string[] —
      // header inspection doesn't need the structured form.
      out[k] = value.map(v => (typeof v === 'string' ? v : v?.value ?? String(v)))
    } else if (value && typeof value === 'object' && 'text' in value) {
      out[k] = (value as { text?: string }).text ?? String(value)
    } else if (value !== undefined) {
      out[k] = String(value)
    }
  })
  return out
}

/**
 * Parse a raw RFC 822 email (IMAP fetch payload) into the ParsedEmail shape.
 * Throws on malformed MIME, and on a header section over
 * MAX_HEADER_SECTION_BYTES — caller catches both and writes
 * status='failed_parse' to the ingest log.
 */
export async function parseEmail(raw: Buffer | string): Promise<ParsedEmail> {
  const headerBytes = headerSectionBytes(raw)
  if (headerBytes > MAX_HEADER_SECTION_BYTES) {
    throw new Error(
      `header section ${headerBytes} bytes exceeds ${MAX_HEADER_SECTION_BYTES}`,
    )
  }
  const parsed = await simpleParser(raw)
  const rawSize = typeof raw === 'string' ? Buffer.byteLength(raw, 'utf8') : raw.length

  const from = pickFirstAddress(parsed.from)
  const references: string[] = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
    ? [parsed.references]
    : []

  return {
    headers: lowercaseHeaders(parsed),
    messageId: parsed.messageId ?? null,
    inReplyTo: parsed.inReplyTo ?? null,
    references,
    fromAddress: from.address,
    fromName: from.name,
    toAddresses: pickAddresses(parsed.to),
    ccAddresses: pickAddresses(parsed.cc),
    subject: parsed.subject ?? null,
    text: parsed.text ?? null,
    html: typeof parsed.html === 'string' ? parsed.html : null,
    date: parsed.date ?? null,
    contentType: parsed.headers.get('content-type') as string | null,
    attachments: (parsed.attachments || []).map(a => ({
      filename: a.filename || 'attachment',
      contentType: a.contentType,
      size: a.size,
      content: a.content as Buffer,
      cid: a.cid ?? null,
      inline: a.contentDisposition === 'inline',
    })),
    rawSizeBytes: rawSize,
  }
}

/**
 * D28: subject-token fallback regex (Step 4 of the threading flow).
 * Matches `[PREFIX-NUMBER]` where PREFIX is 1-10 uppercase alphanumerics.
 * Always run against the decoded subject (parsed.subject), never the raw
 * header.
 */
const SUBJECT_TOKEN_RE = /\[([A-Z0-9]{1,10})-(\d+)\]/

export function extractSubjectToken(
  decodedSubject: string | null,
): { prefix: string; number: number } | null {
  if (!decodedSubject) return null
  const m = SUBJECT_TOKEN_RE.exec(decodedSubject)
  if (!m) return null
  const num = Number.parseInt(m[2], 10)
  if (!Number.isFinite(num) || num <= 0) return null
  return { prefix: m[1], number: num }
}
