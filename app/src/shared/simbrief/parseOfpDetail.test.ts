import { describe, expect, it } from 'vitest'
import { parseOfpDetail } from './parseOfpDetail'

// Forme réduite mais fidèle à un vrai OFP SimBrief (champs vérifiés sur un export réel).
const SAMPLE_OFP = {
  general: {
    icao_airline: 'AFR',
    flight_number: '5956',
    route: 'LGL6D LGL UT176 ROLEN UZ15 ARDOD A5 VALAX VALA1D',
    sid_ident: 'LGL6D',
    star_ident: 'VALA1D',
    initial_altitude: '27000',
    costindex: '15',
    route_distance: '213',
    avg_temp_dev: '10'
  },
  origin: {
    icao_code: 'LFPG',
    name: 'CHARLES-DE-GAULLE',
    pos_lat: '49.009722',
    pos_long: '2.547778',
    plan_rwy: '27L',
    metar: 'LFPG 301200Z 27005KT 230V310 9999 FEW025 SCT170 23/17 Q1018 NOSIG',
    metar_time: '2026-07-30T12:00:00Z',
    taf: 'LFPG 301100Z 3012/3118 23004KT CAVOK'
  },
  destination: {
    icao_code: 'LFRS',
    name: 'NANTES/ATLANTIQUE',
    pos_lat: '47.156944',
    pos_long: '-1.607778',
    plan_rwy: '21',
    metar: 'LFRS 301200Z AUTO 30008KT 200V360 9999 FEW040 27/16 Q1018 NOSIG',
    metar_time: '2026-07-30T12:00:00Z',
    taf: {}
  },
  alternate: {
    icao_code: 'LFBD',
    name: 'MERIGNAC',
    pos_lat: '44.828611',
    pos_long: '-0.715278',
    plan_rwy: '23',
    cruise_altitude: '18000',
    distance: '147',
    ete: '2339',
    burn: '1152',
    route: 'UMLA1G UMLAT T418 WELIN T420 ELVOS DCT TNT DCT'
  },
  alternate_navlog: {
    fix: [
      {
        ident: 'D257C',
        name: 'D257C',
        type: 'wpt',
        pos_lat: '51.476794',
        pos_long: '-0.544747',
        stage: 'CLB',
        via_airway: 'UMLA1G',
        is_sid_star: '1',
        altitude_feet: '3000',
        wind_dir: '250',
        wind_spd: '15'
      }
    ]
  },
  navlog: {
    fix: [
      {
        ident: 'PG271',
        name: 'PG271',
        type: 'wpt',
        pos_lat: '49.016889',
        pos_long: '2.444111',
        stage: 'CLB',
        via_airway: 'LGL6D',
        is_sid_star: '1',
        altitude_feet: '2800',
        wind_dir: '260',
        wind_spd: '10'
      },
      {
        ident: 'ARDOD',
        name: 'ARDOD',
        type: 'wpt',
        pos_lat: '48.5',
        pos_long: '0.5',
        stage: 'CRZ',
        via_airway: 'A5',
        is_sid_star: '0',
        altitude_feet: '27000',
        wind_dir: '240',
        wind_spd: '40'
      },
      {
        ident: 'VALAX',
        name: 'VALAX',
        type: 'wpt',
        pos_lat: '47.562778',
        pos_long: '-1.110556',
        stage: 'DSC',
        via_airway: 'A5',
        is_sid_star: '0',
        altitude_feet: '11200',
        wind_dir: '230',
        wind_spd: '20'
      },
      {
        ident: 'LFRS',
        name: 'NANTES/ATLANTIQUE',
        type: 'apt',
        pos_lat: '47.156944',
        pos_long: '-1.607778',
        stage: 'DSC',
        via_airway: 'VALA1D',
        is_sid_star: '1',
        altitude_feet: '2600',
        wind_dir: '230',
        wind_spd: '20'
      }
    ]
  },
  weights: {
    oew: '37081',
    pax_count: '140',
    cargo: '3493',
    payload: '14606',
    est_zfw: '51687',
    max_zfw: '52439',
    est_tow: '58658',
    max_tow: '62657',
    est_ldw: '57009',
    max_ldw: '61008',
    est_ramp: '58740'
  },
  fuel: {
    taxi: '82',
    plan_takeoff: '6971',
    plan_landing: '5322',
    reserve: '1277',
    contingency: '558',
    extra: '2263',
    plan_ramp: '7053'
  },
  aircraft: {
    icaocode: 'BCS3',
    reg: 'F-HZUF',
    fin: '220'
  },
  params: {
    units: 'kgs'
  },
  fms_downloads: {
    directory: 'https://www.simbrief.com/ofp/flightplans/',
    pdf: {
      link: 'LFPG_LFRS_PDF_1788123456.pdf'
    }
  }
}

describe('parseOfpDetail', () => {
  it('extracts route, SID/STAR and cruise info', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail).not.toBeNull()
    expect(detail!.route).toBe('LGL6D LGL UT176 ROLEN UZ15 ARDOD A5 VALAX VALA1D')
    expect(detail!.sidIdent).toBe('LGL6D')
    expect(detail!.starIdent).toBe('VALA1D')
    expect(detail!.cruiseAltitudeFeet).toBe(27000)
    expect(detail!.costIndex).toBe(15)
    expect(detail!.routeDistanceNm).toBe(213)
    expect(detail!.isaDeviationCelsius).toBe(10)
  })

  it('extracts origin/destination/alternate with coordinates and METAR', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.origin).toEqual({
      icaoCode: 'LFPG',
      name: 'CHARLES-DE-GAULLE',
      lat: 49.009722,
      lon: 2.547778,
      planRunway: '27L',
      metar: 'LFPG 301200Z 27005KT 230V310 9999 FEW025 SCT170 23/17 Q1018 NOSIG',
      metarTime: '2026-07-30T12:00:00Z',
      taf: 'LFPG 301100Z 3012/3118 23004KT CAVOK'
    })
    // destination.taf was an empty object in the raw payload (SimBrief's XML->JSON quirk) — must not throw.
    expect(detail!.destination?.taf).toBeNull()
    expect(detail!.alternate?.icaoCode).toBe('LFBD')
  })

  it('classifies navlog fixes as SID/STAR vs enroute using is_sid_star', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.navlog).toHaveLength(4)
    expect(detail!.navlog[0]).toMatchObject({ ident: 'PG271', isSidStar: true, viaAirway: 'LGL6D', stage: 'CLB' })
    expect(detail!.navlog[2]).toMatchObject({ ident: 'VALAX', isSidStar: false, viaAirway: 'A5' })
    expect(detail!.navlog[3]).toMatchObject({ ident: 'LFRS', isSidStar: true, viaAirway: 'VALA1D', stage: 'DSC' })
  })

  it('computes per-phase average wind (vector average) from navlog fixes', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.climbAvgWind!.dirDegrees).toBeCloseTo(260, 1)
    expect(detail!.climbAvgWind!.speedKt).toBeCloseTo(10, 1)
    expect(detail!.cruiseAvgWind!.dirDegrees).toBeCloseTo(240, 1)
    expect(detail!.cruiseAvgWind!.speedKt).toBeCloseTo(40, 1)
    expect(detail!.descentAvgWind!.dirDegrees).toBeCloseTo(230, 1)
    expect(detail!.descentAvgWind!.speedKt).toBeCloseTo(20, 1)
  })

  it('extracts loadsheet figures with the correct units', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.loadsheet).toMatchObject({
      units: 'kgs',
      oew: 37081,
      estZfw: 51687,
      estTow: 58658,
      fuelExtra: 2263,
      fuelRamp: 7053
    })
  })

  it('extracts the aircraft registration', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.aircraftRegistration).toBe('F-HZUF')
  })

  it('builds the complete SimBrief briefing PDF URL', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.briefingPdfUrl).toBe('https://www.simbrief.com/ofp/flightplans/LFPG_LFRS_PDF_1788123456.pdf')
  })

  it('rejects a PDF link outside SimBrief', () => {
    const detail = parseOfpDetail(JSON.stringify({
      ...SAMPLE_OFP,
      fms_downloads: {
        directory: 'https://malicious.example/',
        pdf: { link: 'briefing.pdf' }
      }
    }))
    expect(detail!.briefingPdfUrl).toBeNull()
  })

  it('extracts the separate alternate route/cruise plan (own SimBrief-computed leg, not a diversion from destination)', () => {
    const detail = parseOfpDetail(JSON.stringify(SAMPLE_OFP))
    expect(detail!.alternateRoute).toBe('UMLA1G UMLAT T418 WELIN T420 ELVOS DCT TNT DCT')
    expect(detail!.alternateCruiseAltitudeFeet).toBe(18000)
    expect(detail!.alternateDistanceNm).toBe(147)
    expect(detail!.alternateEteMinutes).toBe(39)
    expect(detail!.alternateBurn).toBe(1152)
    expect(detail!.alternateNavlog).toHaveLength(1)
    expect(detail!.alternateNavlog[0]).toMatchObject({ ident: 'D257C', viaAirway: 'UMLA1G', isSidStar: true })
  })

  it('returns null on invalid JSON rather than throwing', () => {
    expect(parseOfpDetail('not json')).toBeNull()
  })

  it('degrades gracefully when whole sections are missing', () => {
    const detail = parseOfpDetail(JSON.stringify({ general: {} }))
    expect(detail).not.toBeNull()
    expect(detail!.origin).toBeNull()
    expect(detail!.navlog).toEqual([])
    expect(detail!.loadsheet).toBeNull()
    expect(detail!.alternateRoute).toBeNull()
    expect(detail!.alternateNavlog).toEqual([])
    expect(detail!.briefingPdfUrl).toBeNull()
  })
})
