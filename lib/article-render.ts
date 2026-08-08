/**
 * Server-side article rendering — the single sanitization choke point.
 *
 * Every route that returns a KB article's body MUST pass it through `toSafeHtml`
 * so the client receives only sanitized HTML and its `dangerouslySetInnerHTML`
 * is defensible (design §10.4). Sanitizing here — once, server-side — beats
 * sanitizing in six components, and it is the SAME pipeline the PDF path uses, so
 * the web view and the evidence artifact can never diverge.
 *
 * Do NOT sanitize in the browser and do NOT return raw `kb_articles.content`.
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
