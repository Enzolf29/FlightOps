import { describe, expect, it } from 'vitest'
import { parseIvaoAtisPayload, parseVatsimAtisPayload } from './onlineAtisClient'

describe('online ATIS parsing', () => {
  it('keeps all VATSIM ATIS variants for the requested airport', () => {
    const stations = parseVatsimAtisPayload({
      atis: [
        { callsign: 'LFPG_D_ATIS', frequency: '126.650', atis_code: 'C', text_atis: ['DEPARTURE INFORMATION CHARLIE'] },
        { callsign: 'LFPG_A_ATIS', frequency: '127.125', atis_code: 'D', text_atis: ['ARRIVAL INFORMATION DELTA'] },
        { callsign: 'LFPO_ATIS', frequency: '126.500', atis_code: 'A', text_atis: ['ORLY'] }
      ],
      controllers: []
    }, 'lfpg')

    expect(stations).toEqual([
      { callsign: 'LFPG_A_ATIS', frequency: '127.125', information: 'D', lines: ['ARRIVAL INFORMATION DELTA'] },
      { callsign: 'LFPG_D_ATIS', frequency: '126.650', information: 'C', lines: ['DEPARTURE INFORMATION CHARLIE'] }
    ])
  })

  it('uses a connected VATSIM controller information when no dedicated ATIS is online', () => {
    const stations = parseVatsimAtisPayload({
      atis: [],
      controllers: [
        { callsign: 'KJFK_TWR', frequency: '119.100', text_atis: ['JFK TOWER INFORMATION', 'LANDING 22L'] },
        { callsign: 'JFK_GND', frequency: '121.900', text_atis: ['GROUND INFORMATION'] },
        { callsign: 'KLAX_TWR', frequency: '120.950', text_atis: ['LOS ANGELES'] }
      ]
    }, 'KJFK')

    expect(stations.map((station) => station.callsign)).toEqual(['KJFK_TWR', 'JFK_GND'])
  })

  it('reads IVAO frequency and text from the Whazzup ATC structure', () => {
    const stations = parseIvaoAtisPayload({
      clients: {
        atcs: [
          {
            callsign: 'LFMN_ATIS',
            atcSession: { frequency: '129.600' },
            atis: { revision: 'B', lines: ['NICE INFORMATION BRAVO', 'LANDING RUNWAY 04L'] }
          },
          { callsign: 'LFMN_TWR', atcSession: { frequency: '118.700' }, atis: { lines: ['TOWER TEXT'] } }
        ]
      }
    }, 'LFMN')

    expect(stations).toEqual([
      {
        callsign: 'LFMN_ATIS',
        frequency: '129.600',
        information: 'B',
        lines: ['NICE INFORMATION BRAVO', 'LANDING RUNWAY 04L']
      },
      {
        callsign: 'LFMN_TWR',
        frequency: '118.700',
        information: null,
        lines: ['TOWER TEXT']
      }
    ])
  })

  it('returns an empty list when no online ATIS is active', () => {
    expect(parseVatsimAtisPayload({}, 'LFPG')).toEqual([])
    expect(parseIvaoAtisPayload({ clients: { atcs: [] } }, 'LFPG')).toEqual([])
  })
})
