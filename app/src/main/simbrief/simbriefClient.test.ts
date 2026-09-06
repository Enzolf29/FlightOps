import { describe, expect, it } from 'vitest'
import { parseSimbriefOfpPayload, SimbriefFetchError } from './simbriefClient'

const validPayload = {
  general: {
    icao_airline: 'AFR',
    flight_number: '1445',
    route: 'DCT LGL DCT'
  },
  atc: {
    callsign: 'AFR42AB'
  },
  origin: { icao_code: 'LFPG' },
  destination: { icao_code: 'LFRB' },
  alternate: { icao_code: 'LFRS' },
  aircraft: { icaocode: 'A20N' },
  times: {
    sched_out: '1785582000',
    sched_in: '1785587400'
  }
}

describe('parseSimbriefOfpPayload', () => {
  it('reprend exactement le callsign ATC présent dans le plan SimBrief', () => {
    const ofp = parseSimbriefOfpPayload(validPayload)

    expect(ofp.callsign).toBe('AFR42AB')
    expect(ofp.flightNumberDigits).toBe('1445')
  })

  it('tolère le marqueur objet vide utilisé par SimBrief pour une valeur absente', () => {
    const ofp = parseSimbriefOfpPayload({
      ...validPayload,
      atc: { callsign: {} }
    })

    expect(ofp.callsign).toBeNull()
  })

  it('rejette une réponse qui ne contient pas les données minimales du vol', () => {
    expect(() => parseSimbriefOfpPayload({ error: 'not found' })).toThrow(SimbriefFetchError)
  })
})
