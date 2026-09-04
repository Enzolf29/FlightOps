import type { SimTelemetry } from '../types/simconnect'
import type { CabinAnnouncementType } from '../types/cabinAnnouncements'

export type CabinAnnouncementAction =
  | { kind: 'start_boarding_music' }
  | { kind: 'stop_boarding_music' }
  | { kind: 'enqueue'; types: CabinAnnouncementType[] }

export interface CabinAnnouncementTriggerState {
  initialized: boolean
  boardingActive: boolean
  lastBoardingWelcomeAtMs: number | null
  armDoorsTriggered: boolean
  engineSequenceTriggered: boolean
  hasTakenOff: boolean
  reachedMinimumAirborneHeight: boolean
  afterTakeoffTriggered: boolean
  descentStreak: number
  descentTriggered: boolean
  crewSeatLandingTriggered: boolean
  landed: boolean
  afterLandingTriggered: boolean
  disarmDoorsTriggered: boolean
  disembarkTriggered: boolean
}

export const INITIAL_CABIN_ANNOUNCEMENT_TRIGGER_STATE: CabinAnnouncementTriggerState = {
  initialized: false,
  boardingActive: false,
  lastBoardingWelcomeAtMs: null,
  armDoorsTriggered: false,
  engineSequenceTriggered: false,
  hasTakenOff: false,
  reachedMinimumAirborneHeight: false,
  afterTakeoffTriggered: false,
  descentStreak: 0,
  descentTriggered: false,
  crewSeatLandingTriggered: false,
  landed: false,
  afterLandingTriggered: false,
  disarmDoorsTriggered: false,
  disembarkTriggered: false
}

const GSX_SERVICE_ACTIVE = 5
const GSX_SERVICE_COMPLETE = 6
const BOARDING_WELCOME_INTERVAL_MS = 5 * 60 * 1000
const DESCENT_CONFIRM_TICKS = 5
const DESCENT_VERTICAL_SPEED_FPM = -500
const TAKEOFF_ANNOUNCEMENT_ALTITUDE_FEET = 9_000
const LANDING_CREW_ALTITUDE_AGL_FEET = 5_000
const MINIMUM_REAL_FLIGHT_AGL_FEET = 200

function isNight(timeOfDay: number | undefined): boolean {
  // SimConnect TIME OF DAY : 1 aube, 2 jour, 3 crépuscule, 4 nuit.
  return timeOfDay === 3 || timeOfDay === 4
}

export function evaluateCabinAnnouncementTriggers(
  previous: SimTelemetry | null,
  current: SimTelemetry,
  state: CabinAnnouncementTriggerState,
  nowMs: number
): { actions: CabinAnnouncementAction[]; nextState: CabinAnnouncementTriggerState } {
  const actions: CabinAnnouncementAction[] = []
  let next = { ...state }
  const boardingActive = current.gsxBoardingState === GSX_SERVICE_ACTIVE

  if (!state.initialized) {
    next.initialized = true
    next.boardingActive = boardingActive
    next.hasTakenOff = !current.onGround
    next.reachedMinimumAirborneHeight = !current.onGround && (current.altitudeAboveGround ?? 0) >= MINIMUM_REAL_FLIGHT_AGL_FEET
    next.afterTakeoffTriggered = !current.onGround && current.altitude >= TAKEOFF_ANNOUNCEMENT_ALTITUDE_FEET
    next.engineSequenceTriggered = !current.onGround
    next.landed = false

    if (boardingActive) {
      actions.push({ kind: 'start_boarding_music' })
      actions.push({ kind: 'enqueue', types: ['boarding_welcome'] })
      next.lastBoardingWelcomeAtMs = nowMs
    }
    if (current.enginesRunning && current.onGround) {
      const sequence: CabinAnnouncementType[] = ['arm_doors', 'presafety_briefing', 'safety_briefing']
      if (isNight(current.timeOfDay)) sequence.push('cabin_dim_takeoff')
      sequence.push('crew_seat_takeoff')
      actions.push({ kind: 'enqueue', types: sequence })
      next.armDoorsTriggered = true
      next.engineSequenceTriggered = true
    }
    return { actions, nextState: next }
  }

  if (!state.boardingActive && boardingActive) {
    actions.push({ kind: 'start_boarding_music' })
    actions.push({ kind: 'enqueue', types: ['boarding_welcome'] })
    next.lastBoardingWelcomeAtMs = nowMs
  } else if (state.boardingActive && !boardingActive) {
    actions.push({ kind: 'stop_boarding_music' })
  }
  if (
    boardingActive &&
    next.lastBoardingWelcomeAtMs !== null &&
    nowMs - next.lastBoardingWelcomeAtMs >= BOARDING_WELCOME_INTERVAL_MS
  ) {
    actions.push({ kind: 'enqueue', types: ['boarding_welcome'] })
    next.lastBoardingWelcomeAtMs = nowMs
  }
  if (previous?.gsxBoardingState !== GSX_SERVICE_COMPLETE && current.gsxBoardingState === GSX_SERVICE_COMPLETE) {
    actions.push({ kind: 'enqueue', types: ['boarding_complete'] })
  }
  next.boardingActive = boardingActive

  if (!state.engineSequenceTriggered && !previous?.enginesRunning && current.enginesRunning) {
    const sequence: CabinAnnouncementType[] = ['arm_doors', 'presafety_briefing', 'safety_briefing']
    if (isNight(current.timeOfDay)) sequence.push('cabin_dim_takeoff')
    sequence.push('crew_seat_takeoff')
    actions.push({ kind: 'enqueue', types: sequence })
    next.armDoorsTriggered = true
    next.engineSequenceTriggered = true
  }

  if (previous?.onGround && !current.onGround) next.hasTakenOff = true
  if (!current.onGround && (current.altitudeAboveGround ?? 0) >= MINIMUM_REAL_FLIGHT_AGL_FEET) {
    next.reachedMinimumAirborneHeight = true
  }
  if (
    next.hasTakenOff &&
    !state.afterTakeoffTriggered &&
    (previous?.altitude ?? current.altitude) < TAKEOFF_ANNOUNCEMENT_ALTITUDE_FEET &&
    current.altitude >= TAKEOFF_ANNOUNCEMENT_ALTITUDE_FEET
  ) {
    actions.push({ kind: 'enqueue', types: ['after_takeoff_9000'] })
    next.afterTakeoffTriggered = true
  }

  const descending = next.afterTakeoffTriggered && !current.onGround && current.verticalSpeed < DESCENT_VERTICAL_SPEED_FPM
  next.descentStreak = descending ? state.descentStreak + 1 : 0
  if (!state.descentTriggered && next.descentStreak >= DESCENT_CONFIRM_TICKS) {
    actions.push({ kind: 'enqueue', types: ['descent_seatbelt'] })
    next.descentTriggered = true
  }
  if (
    next.descentTriggered &&
    !state.crewSeatLandingTriggered &&
    !current.onGround &&
    (current.altitudeAboveGround ?? Number.POSITIVE_INFINITY) <= LANDING_CREW_ALTITUDE_AGL_FEET
  ) {
    actions.push({ kind: 'enqueue', types: ['crew_seat_landing'] })
    next.crewSeatLandingTriggered = true
  }

  if (
    next.reachedMinimumAirborneHeight &&
    previous &&
    !previous.onGround &&
    current.onGround
  ) {
    next.landed = true
  }
  const landingLightsSwitchedOff = Boolean(previous?.landingLightsOn && !current.landingLightsOn)
  const flapsRetracted = Boolean(previous && previous.flapsHandleIndex > 0 && current.flapsHandleIndex === 0)
  if (next.landed && !state.afterLandingTriggered && (landingLightsSwitchedOff || flapsRetracted)) {
    actions.push({ kind: 'enqueue', types: ['after_landing'] })
    next.afterLandingTriggered = true
  }
  const beaconSwitchedOff = Boolean(previous?.beaconLightsOn && !current.beaconLightsOn)
  const taxiSwitchedOff = Boolean(previous?.taxiLightsOn && !current.taxiLightsOn)
  if (next.landed && !state.disarmDoorsTriggered && (beaconSwitchedOff || taxiSwitchedOff)) {
    actions.push({ kind: 'enqueue', types: ['disarm_doors'] })
    next.disarmDoorsTriggered = true
  }
  if (next.landed && !state.disembarkTriggered && previous?.enginesRunning && !current.enginesRunning) {
    actions.push({ kind: 'enqueue', types: ['disembark_started'] })
    next.disembarkTriggered = true
  }

  return { actions, nextState: next }
}
