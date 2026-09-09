import { describe, expect, it } from 'vitest'
import type { FlightWithRelations } from '../types/flight'
import { getCalendarDeparture } from './getCalendarDeparture'

function flight(status: FlightWithRelations['status']): FlightWithRelations {
  return {
    id: 1,
    companyId: 1,
    aircraftId: 1,
    flightNumber: 'KL1234',
    callsign: 'KLM1234',
    callsignDisplay: 'KLM1234',
    departureIcao: 'EDDH',
    arrivalIcao: 'EHAM',
    scheduledDeparture: '2026-09-09 22:30:00',
    scheduledArrival: '2026-09-09 23:35:00',
    status,
    source: 'simbrief',
    route: null,
    alternateIcao: null,
    company: { icaoCode: 'KLM', displayName: 'KLM', logoFilename: 'KLM.png' },
    aircraft: { type: 'B738', registration: 'PH-BXA' }
  }
}

describe('getCalendarDeparture', () => {
  it('classe un vol terminé au jour de son départ réel', () => {
    expect(getCalendarDeparture(flight('completed'), '2026-09-08T22:30:00Z')).toBe('2026-09-08T22:30:00Z')
  })

  it('conserve le planning pour un vol à venir', () => {
    expect(getCalendarDeparture(flight('upcoming'), '2026-09-08T22:30:00Z')).toBe('2026-09-09 22:30:00')
  })

  it('revient au planning si aucun départ réel n’a été enregistré', () => {
    expect(getCalendarDeparture(flight('completed'), null)).toBe('2026-09-09 22:30:00')
  })
})
