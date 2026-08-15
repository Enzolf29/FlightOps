import { describe, expect, it } from 'vitest'
import { computeEtaMinutes } from './computeEtaMinutes'

describe('computeEtaMinutes', () => {
  it('returns null when ground speed is too low to be meaningful (parked/taxiing)', () => {
    expect(computeEtaMinutes(49, 2.5, 43.6, 1.4, 5)).toBeNull()
  })

  it('estimates minutes remaining from distance and speed', () => {
    // 300nm remaining at 300kt ground speed -> 60 minutes.
    const eta = computeEtaMinutes(0, 0, 5, 0, 300)
    // 5 degrees of latitude ~= 300nm
    expect(eta).not.toBeNull()
    expect(eta!).toBeGreaterThan(55)
    expect(eta!).toBeLessThan(65)
  })

  it('is close to 0 when already at the destination', () => {
    const eta = computeEtaMinutes(43.6, 1.4, 43.6, 1.4, 150)
    expect(eta).toBeCloseTo(0, 1)
  })
})
