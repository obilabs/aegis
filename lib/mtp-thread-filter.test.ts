import { describe, expect, it } from 'vitest'
import { filterThreadForCaller, type ThreadFilterFields } from './mtp-thread-filter'

const CALLER = 'pairing-caller'
const OTHER = 'pairing-other'

function entry(overrides: Partial<ThreadFilterFields> & { id: string }) {
  return {
    kind: 'comment' as const,
    is_internal_note: false,
    via_pairing_key_id: null,
    shares_activity_with_pairing_ids: [] as string[],
    ...overrides,
  }
}

describe('filterThreadForCaller (D8)', () => {
  it('keeps an internal note authored via the caller’s own pairing key', () => {
    const thread = [
      entry({ id: 'a', kind: 'internal_note', is_internal_note: true, via_pairing_key_id: CALLER }),
    ]
    expect(filterThreadForCaller(thread, CALLER).map((e) => e.id)).toEqual(['a'])
  })

  it('hides another MSP’s internal note by default (D8 default CLOSED)', () => {
    const thread = [
      entry({ id: 'a', kind: 'internal_note', is_internal_note: true, via_pairing_key_id: OTHER }),
    ]
    expect(filterThreadForCaller(thread, CALLER)).toEqual([])
  })

  it('shows another MSP’s internal note when the customer shared activity with the caller', () => {
    const thread = [
      entry({
        id: 'a',
        kind: 'internal_note',
        is_internal_note: true,
        via_pairing_key_id: OTHER,
        shares_activity_with_pairing_ids: [CALLER],
      }),
    ]
    expect(filterThreadForCaller(thread, CALLER).map((e) => e.id)).toEqual(['a'])
  })

  it('always shows public comments regardless of authoring pairing', () => {
    const thread = [
      entry({ id: 'a', kind: 'comment', is_internal_note: false, via_pairing_key_id: OTHER }),
    ]
    expect(filterThreadForCaller(thread, CALLER).map((e) => e.id)).toEqual(['a'])
  })

  it('always shows structural system events (status/assignment/queue changes)', () => {
    const thread = [
      entry({ id: 's', kind: 'status_change', is_internal_note: false, via_pairing_key_id: OTHER }),
      entry({ id: 'a', kind: 'assignment_change', is_internal_note: false, via_pairing_key_id: OTHER }),
      entry({ id: 'q', kind: 'queue_change', is_internal_note: false, via_pairing_key_id: OTHER }),
    ]
    expect(filterThreadForCaller(thread, CALLER).map((e) => e.id)).toEqual(['s', 'a', 'q'])
  })

  it('treats a customer-side internal note (no pairing attribution) as always visible', () => {
    const thread = [
      entry({ id: 'a', kind: 'internal_note', is_internal_note: true, via_pairing_key_id: null }),
    ]
    expect(filterThreadForCaller(thread, CALLER).map((e) => e.id)).toEqual(['a'])
  })

  it('preserves order and mixes visible + hidden entries correctly', () => {
    const thread = [
      entry({ id: 'public', is_internal_note: false, via_pairing_key_id: OTHER }),
      entry({ id: 'mine', kind: 'internal_note', is_internal_note: true, via_pairing_key_id: CALLER }),
      entry({ id: 'theirs', kind: 'internal_note', is_internal_note: true, via_pairing_key_id: OTHER }),
      entry({ id: 'shared', kind: 'internal_note', is_internal_note: true, via_pairing_key_id: OTHER, shares_activity_with_pairing_ids: [CALLER] }),
    ]
    expect(filterThreadForCaller(thread, CALLER).map((e) => e.id)).toEqual(['public', 'mine', 'shared'])
  })
})
