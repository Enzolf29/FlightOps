import { describe, expect, it } from 'vitest'
import { isPlausibleMovement } from './isPlausibleMovement'

const base = {
  latitude: 49.0097,
  longitude: 2.5479,
  groundVelocity: 5,
  onGround: true,
  simZuluIso: '2026-08-31T12:00:00.000Z'
}

describe('isPlausibleMovement', () => {
  it('accepts a normal taxi movement', () => {
    expect(isPlausibleMovement(base, { ...base, longitude: 2.548, simZuluIso: '2026-08-31T12:00:01.000Z' })).toBe(true)
  })

  it('rejects a GSX-style ground teleport', () => {
    expect(isPlausibleMovement(base, { ...base, longitude: 2.57, simZuluIso: '2026-08-31T12:00:01.000Z' })).toBe(false)
  })

  it('accepts normal high-speed airborne movement', () => {
    const airborne = { ...base, groundVelocity: 480, onGround: false }
    expect(
      isPlausibleMovement(airborne, { ...airborne, longitude: 2.5505, simZuluIso: '2026-08-31T12:00:01.000Z' })
    ).toBe(true)
  })
})
