'use client'

import { useMemo } from 'react'
import { toSafeHtml } from '@/lib/article-render'

/**
 * THE only place in the app that may use `dangerouslySetInnerHTML`.
 *
 * Every rich-text field (ticket descriptions, replies, backlog comments,
 * documents, KB articles) renders through this component, which passes the
 * value through `toSafeHtml` — the same sanitizer the server applies on write
 * and in API responses. Sanitizing again at render is idempotent and keeps the
 * render path safe even for rows stored before sanitize-on-write existed.
 *
 * `lib/safe-html-usage.test.ts` fails CI if `dangerouslySetInnerHTML` appears
 * anywhere else.
 */
export function SafeHtml({
  html,
  format,
  fallback,
  className,
}: {
  html: string | null | undefined
  format?: string | null
  /** Plain text shown (escaped) when `html` is empty. */
  fallback?: string
  className?: string
}) {
  const safe = useMemo(() => toSafeHtml(html, format), [html, format])
  if (!safe && fallback !== undefined) {
    return <div className={className}>{fallback}</div>
  }
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />
}
