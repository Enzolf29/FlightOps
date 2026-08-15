import { describe, expect, it } from 'vitest'
import { computeFlightDistanceProgress, greatCircleDistanceNm } from './computeFlightDistanceProgress'

// LFPG (Paris CDG) and LFBO (Toulouse Blagnac), roughly 328nm apart great-circle.
const LFPG = { lat: 49.009722, lon: 2.547778 }
const LFBO = { lat: 43.629, lon: 1.363889 }

describe('greatCircleDistanceNm', () => {
  it('is zero for the same point', () => {
    expect(greatCircleDistanceNm(LFPG.lat, LFPG.lon, LFPG.lat, LFPG.lon)).toBeCloseTo(0, 3)
  })

  it('matches the known LFPG-LFBO great-circle distance (~328nm)', () => {
    const distance = greatCircleDistanceNm(LFPG.lat, LFPG.lon, LFBO.lat, LFBO.lon)
    expect(distance).toBeGreaterThan(300)
    expect(distance).toBeLessThan(360)
  })
})

describe('computeFlightDistanceProgress', () => {
  it('is 0 while still parked at the origin, regardless of how late the schedule says we are', () => {
    const progress = computeFlightDistanceProgress(LFPG.lat, LFPG.lon, LFBO.lat, LFBO.lon, LFPG.lat, LFPG.lon)
    expect(progress).toBe(0)
  })

  it('is ~1 once at the destination', () => {
    const progress = computeFlightDistanceProgress(LFPG.lat, LFPG.lon, LFBO.lat, LFBO.lon, LFBO.lat, LFBO.lon)
    expect(progress).toBeCloseTo(1, 2)
  })

  it('is ~0.5 at the geographic midpoint', () => {
    const midLat = (LFPG.lat + LFBO.lat) / 2
    const midLon = (LFPG.lon + LFBO.lon) / 2
    const progress = computeFlightDistanceProgress(LFPG.lat, LFPG.lon, LFBO.lat, LFBO.lon, midLat, midLon)
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
  })

  it('clamps to 1 if the aircraft has flown past the destination', () => {
    // Well beyond LFBO, further along the same bearing.
    const progress = computeFlightDistanceProgress(LFPG.lat, LFPG.lon, LFBO.lat, LFBO.lon, 40, -1)
    expect(progress).toBe(1)
  })

  it('returns 0 for a degenerate route (origin equals destination)', () => {
    const progress = computeFlightDistanceProgress(LFPG.lat, LFPG.lon, LFPG.lat, LFPG.lon, LFPG.lat, LFPG.lon)
    expect(progress).toBe(0)
  })
})
