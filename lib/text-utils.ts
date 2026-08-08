/**
 * Text sanitization helpers.
 *
 * Currently used by the MTP pairing API to build a
 * privacy-respecting `body_preview` field for ticket rows —
 * see `msp-poller-extension-sla-triage` spec, requirement
 * "List endpoint returns body preview per ticket."
 *
 * `mtp_recent_tickets` is headlines-only per the apps/mtp
 * privacy commitment; the redaction here keeps that
 * invariant even when the preview is stored.
 */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
// Conservative NANP + international phone number matcher.
// Requires either a country code, standard separator, or common
// area-code parenthesization. Deliberately does NOT match every
// 7+ digit run to avoid stripping ticket IDs or version numbers.
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)[\s.-]?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g
const TAG_RE = /<[^>]*>/g
const WHITESPACE_RE = /\s+/g

const PREVIEW_LIMIT = 200

/**
 * Strip HTML tags, redact emails and phone numbers, collapse
 * whitespace, and truncate to a fixed preview length. The result
 * is safe to store in `mtp_recent_tickets.body_preview` and to
 * expose to any paired MTP without breaking the "headlines
 * only, no PII beyond a name" invariant.
 */
export function bodyPreview(body: string | null | undefined): string | null {
  if (body === null || body === undefined) return null
  const stripped = body
    .replace(TAG_RE, ' ')
    .replace(EMAIL_RE, '***@***')
    .replace(PHONE_RE, '***-***-****')
    .replace(WHITESPACE_RE, ' ')
    .trim()
  if (stripped.length <= PREVIEW_LIMIT) return stripped
  return stripped.slice(0, PREVIEW_LIMIT) + '…'
}
