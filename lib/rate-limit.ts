/**
 * In-memory fixed-window rate limiter (single process — Aegis is single-tenant,
 * one app container). Used for API keys (lib/api-keys.ts) and per-IP buckets on
 * unauthenticated endpoints. Not shared across replicas and resets on restart;
 * it bounds abuse, it is not an accounting system.
 */

export interface FixedWindowLimiter {
  /** Record a hit for `key`. Returns true if ALLOWED, false if over the limit. */
  hit(key: string, max: number, now?: number): boolean
  /** Number of keys currently tracked (for tests / diagnostics). */
  size(): number
}

export function createFixedWindowLimiter(opts: {
  windowMs: number
  /** Cap on tracked keys; expired windows are pruned first, then oldest. */
  maxKeys?: number
}): FixedWindowLimiter {
  const maxKeys = opts.maxKeys ?? 10_000
  const counters = new Map<string, { windowStart: number; count: number }>()

  function prune(now: number) {
    for (const [k, v] of counters) {
      if (now - v.windowStart > opts.windowMs) counters.delete(k)
    }
    // Still full: drop oldest-inserted entries (Map preserves insertion order).
    while (counters.size >= maxKeys) {
      const oldest = counters.keys().next().value
      if (oldest === undefined) break
      counters.delete(oldest)
    }
  }

  return {
    hit(key, max, now = Date.now()) {
      if (max <= 0) return true // 0 = unlimited
      const entry = counters.get(key)
      if (!entry || now - entry.windowStart > opts.windowMs) {
        if (!entry && counters.size >= maxKeys) prune(now)
        counters.set(key, { windowStart: now, count: 1 })
        return true
      }
      if (entry.count >= max) return false
      entry.count += 1
      return true
    },
    size: () => counters.size,
  }
}
