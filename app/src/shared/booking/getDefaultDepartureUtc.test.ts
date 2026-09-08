import { describe, expect, it } from 'vitest'
import { getDefaultDepartureUtc } from './getDefaultDepartureUtc'

describe('getDefaultDepartureUtc', () => {
  it('propose une heure de départ quarante minutes après maintenant en UTC', () => {
    expect(getDefaultDepartureUtc(new Date('2026-09-08T12:15:42Z'))).toEqual({
      date: '2026-09-08',
      time: '12:55'
    })
  })

  it('change correctement de jour lorsque les quarante minutes dépassent minuit UTC', () => {
    expect(getDefaultDepartureUtc(new Date('2026-12-31T23:35:00Z'))).toEqual({
      date: '2027-01-01',
      time: '00:15'
    })
  })

  it('reste indépendant du fuseau horaire local grâce au format ISO UTC', () => {
    expect(getDefaultDepartureUtc(new Date('2026-07-10T22:30:00+02:00'))).toEqual({
      date: '2026-07-10',
      time: '21:10'
    })
  })
})
