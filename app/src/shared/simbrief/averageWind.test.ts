import { describe, expect, it } from 'vitest'
import { averageWind } from './averageWind'

describe('averageWind', () => {
  it('returns null for an empty list', () => {
    expect(averageWind([])).toBeNull()
  })

  it('returns the same wind when averaging a single sample', () => {
    const result = averageWind([{ dirDegrees: 270, speedKt: 40 }])
    expect(result!.dirDegrees).toBeCloseTo(270, 1)
    expect(result!.speedKt).toBeCloseTo(40, 1)
  })

  it('averages identical winds to the same value', () => {
    const result = averageWind([
      { dirDegrees: 250, speedKt: 30 },
      { dirDegrees: 250, speedKt: 30 },
      { dirDegrees: 250, speedKt: 30 }
    ])
    expect(result!.dirDegrees).toBeCloseTo(250, 1)
    expect(result!.speedKt).toBeCloseTo(30, 1)
  })

  it('averages directions circularly across the 0/360 wrap instead of arithmetically', () => {
    // Arithmetic mean of 350 and 10 is 180 (exact opposite) — vector mean must be ~0.
    const result = averageWind([
      { dirDegrees: 350, speedKt: 20 },
      { dirDegrees: 10, speedKt: 20 }
    ])
    expect(result!.dirDegrees).toBeCloseTo(0, 0)
    expect(result!.speedKt).toBeCloseTo(20, 0)
  })
})
