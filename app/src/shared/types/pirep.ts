import type { FlightWithRelations } from './flight'

export type DelayBucket = 'on_time' | 'delayed_10_60' | 'delayed_60_plus'

export interface Pirep {
  id: number
  flightId: number
  actualDepartureTime: string | null
  actualArrivalTime: string | null
  flightTimeMinutes: number | null
  delayMinutes: number | null
  delayBucket: DelayBucket | null
  remarks: string | null
  engineStartTime: string | null
  engineStopTime: string | null
  blockTimeMinutes: number | null
  touchdownVerticalSpeedFpm: number | null
  touchdownGForce: number | null
  touchdownPitchDegrees: number | null
  touchdownBankDegrees: number | null
  touchdownAirspeedKt: number | null
  fuelAtEngineStartKg: number | null
  fuelAtTakeoffKg: number | null
  fuelAtTouchdownKg: number | null
  fuelAtEngineStopKg: number | null
}

export interface PirepWithFlight extends Pirep {
  flight: FlightWithRelations
}

export interface PirepFlightPathPoint {
  lat: number
  lon: number
}

export interface PirepApproachProfilePoint {
  timeIso: string
  altitudeFeet: number
  groundSpeedKt: number
}
