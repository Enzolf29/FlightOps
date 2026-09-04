import { describe, expect, it } from 'vitest'
import { shouldAutoCancelFlight } from './shouldAutoCancelFlight'

describe('shouldAutoCancelFlight', () => {
  it('does not cancel before three hours have elapsed', () => {
    expect(shouldAutoCancelFlight('2026-08-31T12:00:00.000Z', '2026-08-31T14:59:59.000Z')).toBe(false)
  })

  it('does not cancel at exactly three hours', () => {
    expect(shouldAutoCancelFlight('2026-08-31 12:00:00', '2026-08-31T15:00:00.000Z')).toBe(false)
  })

  it('cancels as soon as the three-hour threshold is exceeded', () => {
    expect(shouldAutoCancelFlight('2026-08-31 12:00:00', '2026-08-31T15:00:01.000Z')).toBe(true)
  })

  it('compares in UTC even when the current timestamp has an offset', () => {
    expect(shouldAutoCancelFlight('2026-08-31T12:00:00.000Z', '2026-08-31T17:00:01+02:00')).toBe(true)
  })
})
