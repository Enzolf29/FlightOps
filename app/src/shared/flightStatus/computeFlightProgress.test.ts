import { describe, expect, it } from 'vitest'
import { computeFlightProgress } from './computeFlightProgress'

describe('computeFlightProgress', () => {
  it('is 0 before departure', () => {
    expect(computeFlightProgress('2026-08-01T12:00:00.000Z', '2026-08-01T14:00:00.000Z', '2026-08-01T11:00:00.000Z')).toBe(0)
  })

  it('is 0.5 at the midpoint', () => {
    expect(computeFlightProgress('2026-08-01T12:00:00.000Z', '2026-08-01T14:00:00.000Z', '2026-08-01T13:00:00.000Z')).toBe(0.5)
  })

  it('is 1 at or after arrival', () => {
    expect(computeFlightProgress('2026-08-01T12:00:00.000Z', '2026-08-01T14:00:00.000Z', '2026-08-01T14:00:00.000Z')).toBe(1)
    expect(computeFlightProgress('2026-08-01T12:00:00.000Z', '2026-08-01T14:00:00.000Z', '2026-08-01T20:00:00.000Z')).toBe(1)
  })

  it('returns 0 for a degenerate schedule (arrival not after departure)', () => {
    expect(computeFlightProgress('2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z')).toBe(0)
  })
})
