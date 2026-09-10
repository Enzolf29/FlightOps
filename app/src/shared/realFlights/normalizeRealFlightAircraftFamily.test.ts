import { describe, expect, it } from 'vitest'
import { normalizeRealFlightAircraftFamily } from './normalizeRealFlightAircraftFamily'

describe('normalizeRealFlightAircraftFamily', () => {
  it.each(['E170', 'E175', 'E75L', 'E75S'])(
    'regroupe %s dans la famille Embraer 170',
    (icaoType) => {
      expect(normalizeRealFlightAircraftFamily(icaoType, null)).toEqual({
        icaoType: 'E170',
        typeDescription: 'Embraer 170'
      })
    }
  )

  it.each(['E190', 'E195', 'E290', 'E295'])(
    'regroupe %s dans la famille Embraer 190',
    (icaoType) => {
      expect(normalizeRealFlightAircraftFamily(icaoType, null)).toEqual({
        icaoType: 'E190',
        typeDescription: 'Embraer 190'
      })
    }
  )

  it('reconnaît aussi les anciens libellés utilisés comme clés', () => {
    expect(normalizeRealFlightAircraftFamily('Embraer 175', 'Embraer 175')).toEqual({
      icaoType: 'E170',
      typeDescription: 'Embraer 170'
    })
    expect(normalizeRealFlightAircraftFamily('Embraer E195-E2', 'Embraer E195-E2')).toEqual({
      icaoType: 'E190',
      typeDescription: 'Embraer 190'
    })
  })

  it('laisse les autres familles inchangées', () => {
    expect(normalizeRealFlightAircraftFamily('BCS3', 'Airbus A220-300')).toEqual({
      icaoType: 'BCS3',
      typeDescription: 'A220-300'
    })
  })
})

