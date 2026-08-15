import { describe, expect, it } from 'vitest'
import { parseMetar } from './parseMetar'

describe('parseMetar', () => {
  it('parses a clear-sky CAVOK METAR', () => {
    const result = parseMetar('LFPG 311830Z 25010KT 210V280 CAVOK 18/12 Q1015 NOSIG')

    expect(result.icao).toBe('LFPG')
    expect(result.dayOfMonth).toBe(31)
    expect(result.hourUtc).toBe(18)
    expect(result.minuteUtc).toBe(30)
    expect(result.wind).toEqual({ directionDeg: 250, variable: false, speedKt: 10, gustKt: null })
    expect(result.windVariableRange).toEqual({ fromDeg: 210, toDeg: 280 })
    expect(result.cavok).toBe(true)
    expect(result.visibilityMeters).toBe(9999)
    expect(result.temperatureC).toBe(18)
    expect(result.dewpointC).toBe(12)
    expect(result.altimeterHpa).toBe(1015)
    expect(result.flightCategory).toBe('VFR')
  })

  it('parses wind gusts, negative temperatures and cloud layers', () => {
    const result = parseMetar('EGLL 311820Z AUTO 24012G22KT 9000 -RA BKN008 OVC015 M03/M06 Q0998')

    expect(result.auto).toBe(true)
    expect(result.wind).toEqual({ directionDeg: 240, variable: false, speedKt: 12, gustKt: 22 })
    expect(result.visibilityMeters).toBe(9000)
    expect(result.weather).toHaveLength(1)
    expect(result.weather[0].icon).toBe('rain')
    expect(result.weather[0].description).toBe('Pluie légère')
    expect(result.clouds).toEqual([
      { coverage: 'BKN', heightFt: 800, towering: false },
      { coverage: 'OVC', heightFt: 1500, towering: false }
    ])
    expect(result.temperatureC).toBe(-3)
    expect(result.dewpointC).toBe(-6)
    expect(result.altimeterHpa).toBe(998)
    expect(result.flightCategory).toBe('IFR')
  })

  it('detects a thunderstorm with heavy rain and classifies LIFR on low visibility', () => {
    const result = parseMetar('KJFK 311955Z 18015G25KT 1/2SM +TSRA BKN004 OVC008CB 24/23 Q1002')

    expect(result.weather[0].icon).toBe('storm')
    expect(result.weather[0].description).toContain('Orage avec pluie')
    expect(result.clouds[1].towering).toBe(true)
    expect(result.flightCategory).toBe('LIFR')
  })

  it('recognizes variable wind (VRB) and a clear sky token', () => {
    const result = parseMetar('LFPO 311900Z VRB03KT 9999 NCD 20/10 Q1018')

    expect(result.wind).toEqual({ directionDeg: null, variable: true, speedKt: 3, gustKt: null })
    expect(result.skyClear).toBe(true)
    expect(result.clouds).toEqual([])
    expect(result.flightCategory).toBe('VFR')
  })

  it('handles fog with vertical visibility (LIFR)', () => {
    const result = parseMetar('LFOK 311600Z 00000KT 0300 FG VV002 08/08 Q1020')

    expect(result.weather[0].icon).toBe('fog')
    expect(result.clouds).toEqual([{ coverage: 'VV', heightFt: 200, towering: false }])
    expect(result.flightCategory).toBe('LIFR')
  })

  it('returns null flight category when neither visibility nor ceiling is known', () => {
    const result = parseMetar('LFPG 311830Z 25010KT Q1015')

    expect(result.visibilityMeters).toBeNull()
    expect(result.clouds).toEqual([])
    expect(result.flightCategory).toBeNull()
  })
})
