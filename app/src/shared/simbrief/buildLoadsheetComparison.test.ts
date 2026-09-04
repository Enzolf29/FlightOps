import { describe, expect, it } from 'vitest'
import { buildLoadsheetComparison, toKilograms } from './buildLoadsheetComparison'
import type { OfpLoadsheet } from './parseOfpDetail'
import type { CabinLoadsheetSnapshot } from '../types/loadsheet'

const plan: OfpLoadsheet = {
  units: 'kgs', oew: 20_000, paxCount: 100, cargo: 2_000, payload: 10_000,
  estZfw: 30_000, maxZfw: 34_000, estTow: 36_000, maxTow: 40_000,
  estLdw: 33_000, maxLdw: 38_000, estRamp: 36_200, fuelTaxi: 200,
  fuelTakeoff: 6_000, fuelLanding: 3_000, fuelReserve: 1_200,
  fuelContingency: 300, fuelExtra: 500, fuelRamp: 6_200
}

const actual: CabinLoadsheetSnapshot = {
  capturedAt: '2026-09-01T18:00:00.000Z', captureSource: 'gsx', passengersTarget: 98, passengersBoarded: 97,
  cargoBoardingPercent: 100, totalWeightKg: 35_800, emptyWeightKg: 20_000,
  fuelWeightKg: 6_000, maxGrossWeightKg: 40_500, maxZeroFuelWeightKg: 34_500,
  maxTakeoffWeightKg: 40_000, maxLandingWeightKg: 38_000
}

describe('buildLoadsheetComparison', () => {
  it('converts SimBrief pounds to kilograms', () => {
    expect(toKilograms(2204.6226218, 'lbs')).toBeCloseTo(1000)
  })

  it('keeps the final column pending before boarding completion', () => {
    const rows = buildLoadsheetComparison(plan, null)
    expect(rows.every((row) => row.final === null && row.source === 'pending')).toBe(true)
  })

  it('uses GSX/MSFS values and derives payload, ZFW and takeoff values', () => {
    const rows = buildLoadsheetComparison(plan, actual)
    expect(rows.find((row) => row.key === 'pax')).toMatchObject({ final: 97, source: 'gsx' })
    expect(rows.find((row) => row.key === 'payload')).toMatchObject({ final: 9800, source: 'calculated' })
    expect(rows.find((row) => row.key === 'zfw')).toMatchObject({ final: 29_800, limit: 34_500 })
    expect(rows.find((row) => row.key === 'tow')).toMatchObject({ final: 35_600, source: 'calculated' })
    expect(rows.find((row) => row.key === 'takeoffFuel')).toMatchObject({ final: 5_800 })
  })

  it('labels unavailable real values as SimBrief fallbacks', () => {
    const rows = buildLoadsheetComparison(plan, actual)
    expect(rows.find((row) => row.key === 'cargo')).toMatchObject({ final: 2000, source: 'simbrief_fallback' })
    expect(rows.find((row) => row.key === 'ldw')).toMatchObject({ final: 33_000, source: 'simbrief_fallback' })
  })

  it('rejects internally inconsistent MSFS masses instead of publishing a false ZFW', () => {
    const a220Snapshot: CabinLoadsheetSnapshot = {
      ...actual,
      totalWeightKg: 29_107,
      emptyWeightKg: 27_452,
      fuelWeightKg: 1_564
    }

    const rows = buildLoadsheetComparison(plan, a220Snapshot)
    expect(rows.find((row) => row.key === 'payload')).toMatchObject({ final: 10_000, source: 'simbrief_fallback' })
    expect(rows.find((row) => row.key === 'zfw')).toMatchObject({ final: 30_000, source: 'simbrief_fallback' })
    expect(rows.find((row) => row.key === 'ramp')).toMatchObject({ final: 36_200, source: 'simbrief_fallback' })
    expect(rows.find((row) => row.key === 'blockFuel')).toMatchObject({ final: 6_200, source: 'simbrief_fallback' })
  })
})
