import { describe, expect, it } from 'vitest'
import { createFixedWindowLimiter } from './rate-limit'

describe('createFixedWindowLimiter', () => {
  it('allows up to max hits per window, then refuses', () => {
    const l = createFixedWindowLimiter({ windowMs: 1000 })
    expect([1, 2, 3].map(() => l.hit('a', 3, 0))).toEqual([true, true, true])
    expect(l.hit('a', 3, 10)).toBe(false)
  })

  it('opens a new window after windowMs', () => {
    const l = createFixedWindowLimiter({ windowMs: 1000 })
    l.hit('a', 1, 0)
    expect(l.hit('a', 1, 500)).toBe(false)
    expect(l.hit('a', 1, 1001)).toBe(true)
  })

  it('tracks keys independently', () => {
    const l = createFixedWindowLimiter({ windowMs: 1000 })
    l.hit('a', 1, 0)
    expect(l.hit('b', 1, 0)).toBe(true)
  })

  it('treats max <= 0 as unlimited', () => {
    const l = createFixedWindowLimiter({ windowMs: 1000 })
    for (let i = 0; i < 50; i++) expect(l.hit('a', 0, 0)).toBe(true)
  })

  it('bounds memory by pruning when maxKeys is reached', () => {
    const l = createFixedWindowLimiter({ windowMs: 1000, maxKeys: 100 })
    for (let i = 0; i < 1000; i++) l.hit(`ip-${i}`, 5, 0)
    expect(l.size()).toBeLessThanOrEqual(100)
  })
})
