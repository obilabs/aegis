/**
 * Translate legacy api-key permission strings to canonical scopes.
 *
 * Spec: openspec/changes/api-keys-typed-scoped/design.md (D7)
 *
 * The Settings → API Keys page shipped with a hand-rolled four-string
 * permission enum that was stored into `api_keys.permissions` JSONB but
 * never read by `lib/api-auth.ts` (which consults the separate
 * `api_keys.scopes` text[] column populated against the canonical
 * `@obilabs/api-scopes` vocabulary). This helper bridges them: takes
 * any mix of legacy strings + canonical scopes + unknowns, returns the
 * canonical equivalents + warnings for anything it couldn't place.
 *
 * The same mapping is hard-coded into migration 091's pure-SQL pass so
 * the database doesn't depend on this module being available; this TS
 * version is for runtime use in the legacy-rewrite admin flow (when an
 * admin clicks "Verify and dismiss" on the migration banner after
 * checking each key's scopes) and for tests.
 */

import { isValidScope } from '@obilabs/api-scopes'

export const LEGACY_TO_CANONICAL: Record<string, string> = {
  ai_chat: 'ai:chat',
  kb_search: 'kb:read',
  ticket_read: 'tickets:read',
  ticket_create: 'tickets:write',
}

export interface TranslationResult {
  /** Final canonical scope set (deduplicated). */
  scopes: string[]
  /** Strings that couldn't be translated and aren't already canonical. */
  warnings: string[]
}

/**
 * Translate an array of legacy / canonical / unknown permission strings
 * into a clean canonical scope array. Unknowns are dropped from the
 * scope list AND reported in `warnings` so the caller can surface them.
 */
export function translateLegacyPermissions(input: unknown): TranslationResult {
  if (!Array.isArray(input)) {
    return { scopes: [], warnings: [] }
  }

  const out = new Set<string>()
  const warnings: string[] = []

  for (const raw of input) {
    if (typeof raw !== 'string') {
      warnings.push(String(raw))
      continue
    }
    const value = raw.trim()
    if (!value) continue

    if (value in LEGACY_TO_CANONICAL) {
      out.add(LEGACY_TO_CANONICAL[value])
      continue
    }
    if (isValidScope(value)) {
      out.add(value)
      continue
    }
    warnings.push(value)
  }

  return {
    scopes: Array.from(out).sort(),
    warnings,
  }
}
