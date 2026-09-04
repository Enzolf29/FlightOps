import { describe, expect, it } from 'vitest'
import type { PirepTelemetrySample } from '../types/pirep'
import { analyzePirepTelemetry, scoreFuel, scoreLanding, scorePunctuality } from './analyzePirepTelemetry'

function sample(overrides: Partial<PirepTelemetrySample>): PirepTelemetrySample {
  return {
    timeIso: '2026-08-31T12:00:00Z', latitude: 48, longitude: 2, altitudeFeet: 2000,
    altitudeAglFeet: 1000, headingTrue: 0, indicatedAirspeedKt: 140, groundSpeedKt: 135,
    verticalSpeedFpm: -700, fuelKg: 2000, onGround: false, phase: 'descent', bankDegrees: 5,
    pitchDegrees: 2, gearDown: true, flapsIndex: 2, landingLightsOn: true, ...overrides
  }
}

describe('analyzePirepTelemetry', () => {
  it('assesses stable and unstable approach gates', () => {
    const analysis = analyzePirepTelemetry([
      sample({ altitudeAglFeet: 1000 }),
      sample({ altitudeAglFeet: 500, verticalSpeedFpm: -1400, gearDown: false })
    ])
    expect(analysis.approach1000.stable).toBe(true)
    expect(analysis.approach500.stable).toBe(false)
    expect(analysis.approach500.reasons).toContain('train')
  })

  it('produces independent scores without a global score', () => {
    expect(scorePunctuality(5)).toBe(100)
    expect(scoreLanding(-220)).toBe(85)
    expect(scoreFuel(5100, 5000)).toBe(98)
  })
})
