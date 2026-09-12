import { describe, expect, it } from 'vitest'
import { computeRouteSurcharge } from './computeRouteSurcharge'

describe('computeRouteSurcharge', () => {
  it('applies no surcharge when the route has never been observed (null)', () => {
    expect(computeRouteSurcharge(null)).toBe(0)
  })

  it('applies the maximum surcharge when the route has zero relative observations', () => {
    expect(computeRouteSurcharge(0)).toBeCloseTo(0.15, 5)
  })

  it('decreases continuously as the relative observation share grows', () => {
    const zero = computeRouteSurcharge(0)
    const quarter = computeRouteSurcharge(0.25)
    const half = computeRouteSurcharge(0.5)
    expect(quarter).toBeLessThan(zero)
    expect(half).toBeLessThan(quarter)
  })

  it('applies no surcharge once the route is observed at least as often as the airport average', () => {
    expect(computeRouteSurcharge(1)).toBe(0)
    expect(computeRouteSurcharge(3)).toBe(0)
  })

  it('reflects a real asymmetric example: the less-confirmed direction pays a higher surcharge', () => {
    // LFPG -> LFRB observée 5 fois, LFRB -> LFPG observée 2 fois, moyenne des lignes de l'aéroport ~3.5
    const lfpgToLfrbShare = 5 / 3.5
    const lfrbToLfpgShare = 2 / 3.5
    expect(computeRouteSurcharge(lfpgToLfrbShare)).toBeLessThan(computeRouteSurcharge(lfrbToLfpgShare))
  })
})
