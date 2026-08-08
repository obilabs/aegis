import { describe, expect, it } from 'vitest'
import { computeSlaStatus } from './sla'

const now = new Date('2026-07-18T12:00:00Z')

function baseInput(overrides: Partial<Parameters<typeof computeSlaStatus>[0]> = {}) {
  return {
    effectiveStartAt: new Date('2026-07-18T08:00:00Z'),
    firstResponseDueAt: null,
    firstResponseAt: null,
    resolutionDueAt: null,
    resolvedAt: null,
    targetResponseMinutes: null,
    targetResolutionMinutes: null,
    ...overrides,
  }
}

describe('computeSlaStatus', () => {
  it("returns 'on-track' when no SLA policy applies", () => {
    expect(computeSlaStatus(baseInput(), now)).toBe('on-track')
  })

  it("returns 'on-track' when the first-response deadline is far in the future", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T14:00:00Z'), // 2h future, 4h window
          targetResponseMinutes: 240,
        }),
        now,
      ),
    ).toBe('on-track')
  })

  it("returns 'at-risk' when the first-response deadline is within the 25% threshold", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T12:45:00Z'), // 45m remaining
          targetResponseMinutes: 240, // 25% of 4h = 60m; 45m < 60m
        }),
        now,
      ),
    ).toBe('at-risk')
  })

  it("returns 'breached' when the first-response deadline is in the past without a response", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T11:00:00Z'), // 1h past
          firstResponseAt: null,
          targetResponseMinutes: 240,
        }),
        now,
      ),
    ).toBe('breached')
  })

  it("returns 'on-track' when a past first-response deadline was met before it fired", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T11:00:00Z'),
          firstResponseAt: new Date('2026-07-18T10:00:00Z'), // met before deadline
          targetResponseMinutes: 240,
        }),
        now,
      ),
    ).toBe('on-track')
  })

  it("returns 'breached' when the resolution deadline is past even if first response was met", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T10:00:00Z'),
          firstResponseAt: new Date('2026-07-18T09:30:00Z'),
          resolutionDueAt: new Date('2026-07-18T11:30:00Z'), // 30m past
          resolvedAt: null,
          targetResponseMinutes: 60,
          targetResolutionMinutes: 210,
        }),
        now,
      ),
    ).toBe('breached')
  })

  it("returns 'on-track' when both deadlines are met before firing", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T10:00:00Z'),
          firstResponseAt: new Date('2026-07-18T09:30:00Z'),
          resolutionDueAt: new Date('2026-07-18T11:00:00Z'),
          resolvedAt: new Date('2026-07-18T10:45:00Z'),
          targetResponseMinutes: 60,
          targetResolutionMinutes: 180,
        }),
        now,
      ),
    ).toBe('on-track')
  })

  it("uses the tighter of two active deadlines when computing 'at-risk'", () => {
    // First-response 3h remaining of 24h window (12.5%, at-risk).
    // Resolution 20h remaining of 48h window (41%, on-track).
    // Result should be at-risk because first-response is tighter.
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T15:00:00Z'),
          firstResponseAt: null,
          resolutionDueAt: new Date('2026-07-19T08:00:00Z'),
          resolvedAt: null,
          targetResponseMinutes: 1440, // 24h
          targetResolutionMinutes: 2880, // 48h
        }),
        now,
      ),
    ).toBe('at-risk')
  })

  it("returns 'on-track' at exactly the 25% threshold", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T13:00:00Z'), // exactly 60m remaining
          targetResponseMinutes: 240, // 25% = 60m
        }),
        now,
      ),
    ).toBe('on-track')
  })

  it("returns 'at-risk' just past the threshold", () => {
    expect(
      computeSlaStatus(
        baseInput({
          firstResponseDueAt: new Date('2026-07-18T12:59:00Z'), // 59m remaining
          targetResponseMinutes: 240,
        }),
        now,
      ),
    ).toBe('at-risk')
  })
})
