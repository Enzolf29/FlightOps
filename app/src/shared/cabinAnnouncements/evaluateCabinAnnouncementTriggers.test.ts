import { describe, expect, it } from 'vitest'
import type { SimTelemetry } from '../types/simconnect'
import {
  evaluateCabinAnnouncementTriggers,
  INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE,
  type CabinAnnouncementTriggerState
} from './evaluateCabinAnnouncementTriggers'

function telemetry(overrides: Partial<SimTelemetry> = {}): SimTelemetry {
  return {
    latitude: 48,
    longitude: 2,
    altitude: 400,
    altitudeAboveGround: 0,
    headingTrue: 0,
    bankDegrees: 0,
    pitchDegrees: 0,
    gForce: 1,
    enginesRunning: false,
    engine1Running: false,
    engine2Running: false,
    engine3Running: false,
    engine4Running: false,
    landingLightsOn: false,
    taxiLightsOn: false,
    strobeLightsOn: false,
    beaconLightsOn: false,
    navLightsOn: false,
    wingLightsOn: false,
    logoLightsOn: false,
    gsxBoardingState: 0,
    gsxDepartureState: 0,
    gsxPushbackFrozen: false,
    timeOfDay: 2,
    airspeedIndicated: 0,
    groundVelocity: 0,
    verticalSpeed: 0,
    onGround: true,
    parkingBrakeSet: true,
    gearHandleDown: true,
    flapsPercent: 0,
    flapsHandleIndex: 0,
    flapsNumHandlePositions: 4,
    fuelTotalWeight: 5000,
    title: 'Test',
    atcId: 'TEST',
    simZuluIso: '2026-01-01T12:00:00.000Z',
    ...overrides
  }
}

function step(
  previous: SimTelemetry | null,
  current: SimTelemetry,
  state: CabinAnnouncementTriggerState,
  nowMs = 0
) {
  return evaluateCabinAnnouncementTriggers(previous, current, state, nowMs)
}

describe('evaluateCabinAnnouncementTriggers', () => {
  it('starts music and welcome on GSX boarding, repeats welcome after five minutes, then completes', () => {
    const idle = telemetry()
    const initialized = step(null, idle, INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE).nextState
    const boarding = telemetry({ gsxBoardingState: 5 })
    const started = step(idle, boarding, initialized, 1_000)
    expect(started.actions).toEqual([
      { kind: 'start_boarding_music' },
      { kind: 'enqueue', types: ['boarding_welcome'] }
    ])

    const repeated = step(boarding, boarding, started.nextState, 301_000)
    expect(repeated.actions).toEqual([{ kind: 'enqueue', types: ['boarding_welcome'] }])

    const complete = telemetry({ gsxBoardingState: 6 })
    expect(step(boarding, complete, repeated.nextState, 302_000).actions).toEqual([
      { kind: 'stop_boarding_music' },
      { kind: 'enqueue', types: ['boarding_complete'] }
    ])
  })

  it('queues the complete night safety sequence at first engine start', () => {
    const stopped = telemetry({ timeOfDay: 4 })
    const initialized = step(null, stopped, INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE).nextState
    const running = telemetry({ enginesRunning: true, engine1Running: true, timeOfDay: 4 })
    expect(step(stopped, running, initialized).actions).toEqual([
      {
        kind: 'enqueue',
        types: ['arm_doors', 'presafety_briefing', 'safety_briefing', 'cabin_dim_takeoff', 'crew_seat_takeoff']
      }
    ])
  })

  it('does not trigger arm doors when GSX pushback starts before the engines', () => {
    const idle = telemetry()
    const initialized = step(null, idle, INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE).nextState
    const pushback = telemetry({ gsxPushbackFrozen: true, gsxDepartureState: 5 })
    expect(step(idle, pushback, initialized).actions).toEqual([])
  })

  it('queues arm doors before both safety briefings at first engine start', () => {
    const stopped = telemetry()
    const initialized = step(null, stopped, INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE).nextState
    const running = telemetry({ enginesRunning: true, engine1Running: true })
    const first = step(stopped, running, initialized)
    expect(first.actions).toEqual([{
      kind: 'enqueue',
      types: ['arm_doors', 'presafety_briefing', 'safety_briefing', 'crew_seat_takeoff']
    }])
    expect(first.nextState.armDoorsTriggered).toBe(true)
    expect(step(running, running, first.nextState).actions).toEqual([])
  })

  it('triggers climb, confirmed descent and 5000 ft announcements in sequence', () => {
    const ground = telemetry()
    let state = step(null, ground, INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE).nextState
    let previous = ground
    const airborne = telemetry({ onGround: false, altitude: 1_000, altitudeAboveGround: 600, verticalSpeed: 1_500 })
    state = step(previous, airborne, state).nextState
    previous = airborne
    const at9000 = telemetry({ onGround: false, altitude: 9_100, altitudeAboveGround: 8_700, verticalSpeed: 1_000 })
    const climb = step(previous, at9000, state)
    expect(climb.actions).toEqual([{ kind: 'enqueue', types: ['after_takeoff_9000'] }])
    state = climb.nextState
    previous = at9000

    for (let index = 0; index < 4; index += 1) {
      const descending = telemetry({ onGround: false, altitude: 12_000 - index * 100, altitudeAboveGround: 11_600, verticalSpeed: -800 })
      const result = step(previous, descending, state)
      expect(result.actions).toEqual([])
      state = result.nextState
      previous = descending
    }
    const descent = telemetry({ onGround: false, altitude: 11_500, altitudeAboveGround: 11_100, verticalSpeed: -800 })
    const confirmed = step(previous, descent, state)
    expect(confirmed.actions).toEqual([{ kind: 'enqueue', types: ['descent_seatbelt'] }])

    const at5000 = telemetry({ onGround: false, altitude: 5_300, altitudeAboveGround: 4_900, verticalSpeed: -700 })
    expect(step(descent, at5000, confirmed.nextState).actions).toEqual([
      { kind: 'enqueue', types: ['crew_seat_landing'] }
    ])
  })

  it('waits for a real flight before the after-landing, doors and disembark announcements', () => {
    const ground = telemetry({ enginesRunning: true, landingLightsOn: true, taxiLightsOn: true, beaconLightsOn: true })
    let state = step(null, ground, INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE).nextState
    const airborne = telemetry({
      enginesRunning: true,
      onGround: false,
      altitude: 2_000,
      altitudeAboveGround: 1_500,
      landingLightsOn: true,
      taxiLightsOn: true,
      beaconLightsOn: true
    })
    state = step(ground, airborne, state).nextState
    const landed = telemetry({
      enginesRunning: true,
      onGround: true,
      landingLightsOn: true,
      taxiLightsOn: true,
      beaconLightsOn: true,
      flapsHandleIndex: 2
    })
    state = step(airborne, landed, state).nextState
    const secured = telemetry({ enginesRunning: false, onGround: true, flapsHandleIndex: 0 })
    expect(step(landed, secured, state).actions).toEqual([
      { kind: 'enqueue', types: ['after_landing'] },
      { kind: 'enqueue', types: ['disarm_doors'] },
      { kind: 'enqueue', types: ['disembark_started'] }
    ])
  })
})
