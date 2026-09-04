import { describe, expect, it } from 'vitest'
import type { AircraftWithStats } from '../types/aircraft'
import type { RealRoute } from '../types/realFlights'
import { getFleetAircraftIcaoType, getFleetRouteMatch, rankFleetAircraftForRoute } from './matchFleetAircraftToRoute'

function aircraft(overrides: Partial<AircraftWithStats> = {}): AircraftWithStats {
  return {
    id: 1,
    companyId: 1,
    type: 'A220-300',
    registration: 'F-HZUA',
    simbriefIcaoCode: 'BCS3',
    simbriefFin: null,
    modeS: null,
    notes: null,
    company: { icaoCode: 'AFR', displayName: 'Air France', logoFilename: 'air-france.svg' },
    flightCount: 0,
    cumulativeHours: 0,
    lastKnownIcao: 'LFPG',
    lastKnownAt: null,
    cycleCount: 0,
    averageLandingFpm: null,
    averageFuelConsumptionKg: null,
    averageDistanceNm: null,
    mostVisitedIcao: null,
    mostVisitedCount: 0,
    ...overrides
  }
}

const route: RealRoute = {
  id: 1,
  companyId: 1,
  departureIcao: 'LFPG',
  arrivalIcao: 'LFRS',
  source: 'api',
  typicalDurationMinutes: 65,
  lastFetchedAt: null,
  lastObservedAt: null,
  observationCount: 2,
  aircraft: [{ icaoType: 'BCS3', typeDescription: 'A220-300', observationCount: 2 }]
}

describe('fleet aircraft matching for real routes', () => {
  it('uses the SimBrief ICAO code first', () => {
    expect(getFleetAircraftIcaoType(aircraft())).toBe('BCS3')
  })

  it('falls back to the descriptive aircraft name', () => {
    expect(getFleetAircraftIcaoType(aircraft({ simbriefIcaoCode: null }))).toBe('BCS3')
  })

  it('distinguishes a compatible aircraft already positioned at departure', () => {
    expect(getFleetRouteMatch(aircraft(), route)).toBe('positioned')
    expect(getFleetRouteMatch(aircraft({ lastKnownIcao: 'LFBO' }), route)).toBe('compatible')
    expect(getFleetRouteMatch(aircraft({ simbriefIcaoCode: 'A320' }), route)).toBe('incompatible')
  })

  it('ranks positioned aircraft before compatible aircraft elsewhere and incompatible aircraft', () => {
    const elsewhere = aircraft({ id: 2, registration: 'F-HZUB', lastKnownIcao: 'LFRS' })
    const incompatible = aircraft({ id: 3, registration: 'F-GKXA', simbriefIcaoCode: 'A320' })
    expect(rankFleetAircraftForRoute([incompatible, elsewhere, aircraft()], route).map((item) => item.id)).toEqual([1, 2, 3])
  })
})
