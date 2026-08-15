import { describe, expect, it } from 'vitest'
import { buildDispatchPrefillUrl } from './buildDispatchPrefillUrl'

describe('buildDispatchPrefillUrl', () => {
  it("utilise le type OACI et l'immatriculation", () => {
    const url = new URL(
      buildDispatchPrefillUrl({
        originIcao: 'LFPG',
        destIcao: 'LFRB',
        aircraftIcaoType: 'A20N',
        airlineIcao: 'AFR',
        registration: 'F-HZUK',
        scheduledDeparture: new Date('2026-07-31T10:00:00Z')
      })
    )

    expect(url.searchParams.get('type')).toBe('A20N')
    expect(url.searchParams.get('reg')).toBe('F-HZUK')
  })

  it("ignore l'Internal ID SimBrief (non supporté par ce formulaire, réservé à l'API) sans casser le préremplissage", () => {
    const url = new URL(
      buildDispatchPrefillUrl({
        originIcao: 'LFPG',
        destIcao: 'LFRB',
        aircraftIcaoType: 'A20N',
        airlineIcao: 'AFR',
        registration: 'F-HZUK',
        simbriefFin: '123456_1582090020',
        scheduledDeparture: new Date('2026-07-31T10:00:00Z')
      })
    )

    expect(url.searchParams.get('type')).toBe('A20N')
    expect(url.searchParams.get('reg')).toBe('F-HZUK')
  })
})
