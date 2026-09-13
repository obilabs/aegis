/**
 * Server-side article rendering — the single sanitization choke point.
 *
 * Every route that returns a KB article's body MUST pass it through `toSafeHtml`
 * so the client receives only sanitized HTML and its `dangerouslySetInnerHTML`
 * is defensible (design §10.4). Sanitizing here — once, server-side — beats
 * sanitizing in six components, and it is the SAME pipeline the PDF path uses, so
 * the web view and the evidence artifact can never diverge.
 *
 * Do NOT return raw `kb_articles.content`.
 *
 * This is also the ONE sanitizer for every other rich-text field in the app
 * (ticket descriptions and replies, backlog comments, documents, inbound email
 * HTML): those are sanitized on write with it, and `components/SafeHtml.tsx` —
 * the only permitted `dangerouslySetInnerHTML` site, enforced by
 * `lib/safe-html-usage.test.ts` — applies it again at render. Sanitizing is
 * idempotent, so the second pass only matters for rows stored before
 * sanitize-on-write existed or written by another path.
 */

import { sanitizeArticleHtml, renderMarkdown } from '@obilabs/documents';

/**
 * Convert stored article source to safe HTML for display.
 *   - `markdown` → renderMarkdown (unsafe) → sanitize
 *   - `html` (or anything else) → sanitize
 * Always returns sanitized HTML; `null`/empty content returns `''`.
 */
export function toSafeHtml(
  content: string | null | undefined,
  format?: string | null,
): string {
  if (!content) return '';
  const raw = format === 'markdown' ? renderMarkdown(content) : content;
  return sanitizeArticleHtml(raw);
}
