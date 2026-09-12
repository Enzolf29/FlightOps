import { describe, expect, it } from 'vitest'
import { resolveCheckedBagsSold } from './resolveCheckedBaggage'
import { BAGGAGE_CHECK_SHARE_MAX, BAGGAGE_CHECK_SHARE_MIN } from '../types/economy'

describe('resolveCheckedBagsSold', () => {
  it('stays within the configured share range of the passenger count', () => {
    const min = resolveCheckedBagsSold(200, () => 0)
    const max = resolveCheckedBagsSold(200, () => 1)
    expect(min).toBe(Math.round(200 * BAGGAGE_CHECK_SHARE_MIN))
    expect(max).toBe(Math.round(200 * BAGGAGE_CHECK_SHARE_MAX))
  })

  it('never exceeds the number of passengers sold', () => {
    expect(resolveCheckedBagsSold(50, () => 1)).toBeLessThanOrEqual(50)
  })

  it('returns 0 when no passengers were sold', () => {
    expect(resolveCheckedBagsSold(0, () => 0.5)).toBe(0)
  })
})
