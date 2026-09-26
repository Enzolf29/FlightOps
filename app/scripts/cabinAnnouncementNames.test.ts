import { describe, expect, it } from 'vitest'
import { parseAnnouncementFilename } from './cabinAnnouncementNames'

describe('parseAnnouncementFilename', () => {
  it('reads the plain type name', () => {
    expect(parseAnnouncementFilename('AfterLanding.wav')).toEqual({ type: 'after_landing', variant: 'any', index: null })
  })

  it('reads bracketed numbers and day/night tags', () => {
    expect(parseAnnouncementFilename('AfterLanding[Afternoon][2].ogg')).toEqual({ type: 'after_landing', variant: 'day', index: 2 })
    expect(parseAnnouncementFilename('CabinDimTakeoff[Night][1].ogg')).toEqual({ type: 'cabin_dim_takeoff', variant: 'night', index: 1 })
    expect(parseAnnouncementFilename('ArmDoors[1].ogg')).toEqual({ type: 'arm_doors', variant: 'any', index: 1 })
  })

  it('treats evening like night and morning like day', () => {
    expect(parseAnnouncementFilename('BoardingWelcome[Evening][1].ogg').variant).toBe('night')
    expect(parseAnnouncementFilename('BoardingWelcome[Morning].ogg').variant).toBe('day')
  })

  it('makes every cabin dim announcement night-only', () => {
    expect(parseAnnouncementFilename('CabinDimTakeoff.wav')).toEqual({ type: 'cabin_dim_takeoff', variant: 'night', index: null })
    expect(parseAnnouncementFilename('CabinDim.wav').variant).toBe('night')
  })

  it('accepts spelling differences found in the source packs', () => {
    expect(parseAnnouncementFilename('Boarding Complete.wav').type).toBe('boarding_complete')
    expect(parseAnnouncementFilename('Boarding-Music.wav').type).toBe('boarding_music')
    expect(parseAnnouncementFilename('AfterTakeOff[1].ogg').type).toBe('after_takeoff_9000')
    expect(parseAnnouncementFilename('CreawSeatTakeoff.wav').type).toBe('crew_seat_takeoff')
    expect(parseAnnouncementFilename('CrewSeatsLanding.wav').type).toBe('crew_seat_landing')
    expect(parseAnnouncementFilename('CabinDim.wav').type).toBe('cabin_dim_takeoff')
    expect(parseAnnouncementFilename('DescentSeatbelts.wav').type).toBe('descent_seatbelt')
  })

  it('treats a trailing number as the variant index', () => {
    expect(parseAnnouncementFilename('BordingWelcome1.ogg')).toEqual({ type: 'boarding_welcome', variant: 'any', index: 1 })
    expect(parseAnnouncementFilename('BoardingWelcome2.ogg')).toEqual({ type: 'boarding_welcome', variant: 'any', index: 2 })
  })

  it('returns a null type for announcements the app has no slot for', () => {
    expect(parseAnnouncementFilename('Turbulence.wav').type).toBeNull()
    expect(parseAnnouncementFilename('CaptainWelcome1.ogg').type).toBeNull()
    expect(parseAnnouncementFilename('Cruise.ogg').type).toBeNull()
  })
})
