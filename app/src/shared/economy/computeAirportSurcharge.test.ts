import { describe, expect, it } from 'vitest'
import { computeAirportSurcharge } from './computeAirportSurcharge'

describe('computeAirportSurcharge', () => {
  it('applies no surcharge when the airport has never been searched (null)', () => {
    expect(computeAirportSurcharge(null)).toBe(0)
  })

  it('applies the maximum surcharge when no destination is known', () => {
    expect(computeAirportSurcharge(0)).toBeCloseTo(0.4, 5)
  })

  it('decreases continuously (no jump) as the known destination count grows', () => {
    const zero = computeAirportSurcharge(0)
    const two = computeAirportSurcharge(2)
    const four = computeAirportSurcharge(4)
    expect(two).toBeLessThan(zero)
    expect(four).toBeLessThan(two)
  })

  it('reaches the floor at the threshold and never drops below it beyond that', () => {
    expect(computeAirportSurcharge(6)).toBeCloseTo(0.1, 5)
    expect(computeAirportSurcharge(50)).toBeCloseTo(0.1, 5)
  })
})
