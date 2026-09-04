import { getDb } from '../index'
import type { Flight, FlightSource, FlightStatus } from '@shared/types/flight'
import type { DelayBucket, PirepApproachProfilePoint, PirepFlightPathPoint, PirepTelemetrySample, PirepWithFlight } from '@shared/types/pirep'
import type { FlightEvent } from '@shared/flightStatus/evaluateFlightEvents'

interface PirepJoinRow {
  id: number
  flight_id: number
  actual_departure_time: string | null
  actual_arrival_time: string | null
  flight_time_minutes: number | null
  delay_minutes: number | null
  delay_bucket: DelayBucket | null
  remarks: string | null
  engine_start_time: string | null
  engine_stop_time: string | null
  block_time_minutes: number | null
  touchdown_vertical_speed_fpm: number | null
  touchdown_g_force: number | null
  touchdown_pitch_degrees: number | null
  touchdown_bank_degrees: number | null
  touchdown_airspeed_kt: number | null
  fuel_at_engine_start_kg: number | null
  fuel_at_takeoff_kg: number | null
  fuel_at_touchdown_kg: number | null
  fuel_at_engine_stop_kg: number | null
  f_id: number
  f_company_id: number
  f_aircraft_id: number | null
  f_flight_number: string
  f_callsign: string
  f_callsign_display: string
  f_departure_icao: string
  f_arrival_icao: string
  f_scheduled_departure: string
  f_scheduled_arrival: string
  f_status: FlightStatus
  f_source: FlightSource
  f_route: string | null
  f_alternate_icao: string | null
  company_icao_code: string
  company_display_name: string
  company_logo_filename: string
  aircraft_type: string | null
  aircraft_registration: string | null
}

const SELECT_PIREPS = `
  SELECT
    p.id, p.flight_id, p.actual_departure_time, p.actual_arrival_time, p.flight_time_minutes,
    p.delay_minutes, p.delay_bucket, p.remarks,
    p.engine_start_time, p.engine_stop_time, p.block_time_minutes,
    p.touchdown_vertical_speed_fpm, p.touchdown_g_force, p.touchdown_pitch_degrees, p.touchdown_bank_degrees,
    p.touchdown_airspeed_kt,
    p.fuel_at_engine_start_kg, p.fuel_at_takeoff_kg, p.fuel_at_touchdown_kg, p.fuel_at_engine_stop_kg,
    f.id AS f_id, f.company_id AS f_company_id, f.aircraft_id AS f_aircraft_id,
    f.flight_number AS f_flight_number, f.callsign AS f_callsign, f.callsign_display AS f_callsign_display,
    f.departure_icao AS f_departure_icao, f.arrival_icao AS f_arrival_icao,
    f.scheduled_departure AS f_scheduled_departure, f.scheduled_arrival AS f_scheduled_arrival,
    f.status AS f_status, f.source AS f_source, f.route AS f_route, f.alternate_icao AS f_alternate_icao,
    c.icao_code AS company_icao_code, c.display_name AS company_display_name, c.logo_filename AS company_logo_filename,
    a.type AS aircraft_type, a.registration AS aircraft_registration
  FROM pireps p
  JOIN flights f ON f.id = p.flight_id
  JOIN companies c ON c.id = f.company_id
  LEFT JOIN aircraft a ON a.id = f.aircraft_id
`

function mapPirep(row: PirepJoinRow): PirepWithFlight {
  const flight: Flight = {
    id: row.f_id,
    companyId: row.f_company_id,
    aircraftId: row.f_aircraft_id,
    flightNumber: row.f_flight_number,
    callsign: row.f_callsign,
    callsignDisplay: row.f_callsign_display,
    departureIcao: row.f_departure_icao,
    arrivalIcao: row.f_arrival_icao,
    scheduledDeparture: row.f_scheduled_departure,
    scheduledArrival: row.f_scheduled_arrival,
    status: row.f_status,
    source: row.f_source,
    route: row.f_route,
    alternateIcao: row.f_alternate_icao
  }

  return {
    id: row.id,
    flightId: row.flight_id,
    actualDepartureTime: row.actual_departure_time,
    actualArrivalTime: row.actual_arrival_time,
    flightTimeMinutes: row.flight_time_minutes,
    delayMinutes: row.delay_minutes,
    delayBucket: row.delay_bucket,
    remarks: row.remarks,
    engineStartTime: row.engine_start_time,
    engineStopTime: row.engine_stop_time,
    blockTimeMinutes: row.block_time_minutes,
    touchdownVerticalSpeedFpm: row.touchdown_vertical_speed_fpm,
    touchdownGForce: row.touchdown_g_force,
    touchdownPitchDegrees: row.touchdown_pitch_degrees,
    touchdownBankDegrees: row.touchdown_bank_degrees,
    touchdownAirspeedKt: row.touchdown_airspeed_kt,
    fuelAtEngineStartKg: row.fuel_at_engine_start_kg,
    fuelAtTakeoffKg: row.fuel_at_takeoff_kg,
    fuelAtTouchdownKg: row.fuel_at_touchdown_kg,
    fuelAtEngineStopKg: row.fuel_at_engine_stop_kg,
    flight: {
      ...flight,
      company: {
        icaoCode: row.company_icao_code,
        displayName: row.company_display_name,
        logoFilename: row.company_logo_filename
      },
      aircraft: row.aircraft_type ? { type: row.aircraft_type, registration: row.aircraft_registration } : null
    }
  }
}

export function getRecentPireps(limit: number): PirepWithFlight[] {
  const rows = getDb().prepare(`${SELECT_PIREPS} ORDER BY p.actual_arrival_time DESC LIMIT ?`).all(limit) as PirepJoinRow[]
  return rows.map(mapPirep)
}

export function getAllPireps(): PirepWithFlight[] {
  const rows = getDb().prepare(`${SELECT_PIREPS} ORDER BY p.actual_arrival_time DESC`).all() as PirepJoinRow[]
  return rows.map(mapPirep)
}

export function getPirepById(id: number): PirepWithFlight | null {
  const row = getDb().prepare(`${SELECT_PIREPS} WHERE p.id = ?`).get(id) as PirepJoinRow | undefined
  return row ? mapPirep(row) : null
}

export function getPirepsByAircraft(aircraftId: number): PirepWithFlight[] {
  const rows = getDb()
    .prepare(`${SELECT_PIREPS} WHERE f.aircraft_id = ? ORDER BY p.actual_arrival_time DESC`)
    .all(aircraftId) as PirepJoinRow[]
  return rows.map(mapPirep)
}

/** Blobs volumineux volontairement exclus des requêtes ci-dessus, chargés à la demande sur la page de détail. */
export function getPirepFlightPath(id: number): PirepFlightPathPoint[] {
  const row = getDb().prepare('SELECT flight_path_json FROM pireps WHERE id = ?').get(id) as
    | { flight_path_json: string | null }
    | undefined
  if (!row?.flight_path_json) return []
  try {
    return JSON.parse(row.flight_path_json) as PirepFlightPathPoint[]
  } catch {
    return []
  }
}

export function getPirepApproachProfile(id: number): PirepApproachProfilePoint[] {
  const row = getDb().prepare('SELECT approach_profile_json FROM pireps WHERE id = ?').get(id) as
    | { approach_profile_json: string | null }
    | undefined
  if (!row?.approach_profile_json) return []
  try {
    return JSON.parse(row.approach_profile_json) as PirepApproachProfilePoint[]
  } catch {
    return []
  }
}

export function getPirepEvents(id: number): FlightEvent[] {
  const row = getDb().prepare('SELECT events_json FROM pireps WHERE id = ?').get(id) as
    | { events_json: string | null }
    | undefined
  if (!row?.events_json) return []
  try {
    return JSON.parse(row.events_json) as FlightEvent[]
  } catch {
    return []
  }
}

export function getPirepTelemetrySamples(id: number): PirepTelemetrySample[] {
  const rows = getDb()
    .prepare(
      `SELECT s.* FROM flight_telemetry_samples s
       JOIN pireps p ON p.flight_id = s.flight_id
       WHERE p.id = ? ORDER BY s.sim_time_iso ASC`
    )
    .all(id) as Array<Record<string, number | string>>
  return rows.map((row) => ({
    timeIso: String(row.sim_time_iso),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    altitudeFeet: Number(row.altitude_feet),
    altitudeAglFeet: Number(row.altitude_agl_feet),
    headingTrue: Number(row.heading_true),
    indicatedAirspeedKt: Number(row.indicated_airspeed_kt),
    groundSpeedKt: Number(row.ground_speed_kt),
    verticalSpeedFpm: Number(row.vertical_speed_fpm),
    fuelKg: Number(row.fuel_kg),
    onGround: Number(row.on_ground) === 1,
    phase: String(row.phase),
    bankDegrees: Number(row.bank_degrees),
    pitchDegrees: Number(row.pitch_degrees),
    gearDown: Number(row.gear_down) === 1,
    flapsIndex: Number(row.flaps_index),
    landingLightsOn: Number(row.landing_lights_on) === 1
  }))
}

export interface CreatePirepInput {
  flightId: number
  actualDepartureTime: string
  actualArrivalTime: string
  flightTimeMinutes: number
  delayMinutes: number
  delayBucket: DelayBucket | null
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
  flightPath: PirepFlightPathPoint[]
  approachProfile: PirepApproachProfilePoint[]
  events: FlightEvent[]
}

export function createPirep(input: CreatePirepInput): number {
  const result = getDb()
    .prepare(
      `INSERT INTO pireps (
         flight_id, actual_departure_time, actual_arrival_time, flight_time_minutes, delay_minutes, delay_bucket,
         engine_start_time, engine_stop_time, block_time_minutes,
         touchdown_vertical_speed_fpm, touchdown_g_force, touchdown_pitch_degrees, touchdown_bank_degrees,
         touchdown_airspeed_kt,
         fuel_at_engine_start_kg, fuel_at_takeoff_kg, fuel_at_touchdown_kg, fuel_at_engine_stop_kg,
         flight_path_json, approach_profile_json, events_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.flightId,
      input.actualDepartureTime,
      input.actualArrivalTime,
      input.flightTimeMinutes,
      input.delayMinutes,
      input.delayBucket,
      input.engineStartTime,
      input.engineStopTime,
      input.blockTimeMinutes,
      input.touchdownVerticalSpeedFpm,
      input.touchdownGForce,
      input.touchdownPitchDegrees,
      input.touchdownBankDegrees,
      input.touchdownAirspeedKt,
      input.fuelAtEngineStartKg,
      input.fuelAtTakeoffKg,
      input.fuelAtTouchdownKg,
      input.fuelAtEngineStopKg,
      JSON.stringify(input.flightPath),
      JSON.stringify(input.approachProfile),
      JSON.stringify(input.events)
    )
  return Number(result.lastInsertRowid)
}

/**
 * Le vol est marqué "terminé" dès l'arrivée au parking (frein mis, quasi à l'arrêt) — le pilote
 * coupe souvent les moteurs après coup, une fois le PIREP déjà créé. Cette mise à jour tardive
 * complète les champs moteurs/carburant dès que la coupure est enfin observée (voir
 * flightStatusDetector.handleTelemetryTick, capture "en attente" après clôture du vol).
 */
export function updatePirepEngineStop(
  id: number,
  engineStopTime: string,
  fuelAtEngineStopKg: number | null,
  blockTimeMinutes: number | null
): void {
  getDb()
    .prepare('UPDATE pireps SET engine_stop_time = ?, fuel_at_engine_stop_kg = ?, block_time_minutes = ? WHERE id = ?')
    .run(engineStopTime, fuelAtEngineStopKg, blockTimeMinutes, id)
}

/**
 * Complète le journal d'évènements après coup (voir updatePirepEngineStop) : les coupures moteur
 * observées après la clôture du vol (arrivée au parking) n'ont sinon jamais l'occasion d'être
 * loguées, alors que la capture de l'heure de coupure elle-même continue de fonctionner.
 */
export function appendPirepEvents(id: number, newEvents: FlightEvent[]): void {
  if (newEvents.length === 0) return
  const row = getDb().prepare('SELECT events_json FROM pireps WHERE id = ?').get(id) as
    | { events_json: string | null }
    | undefined
  if (!row) return

  let existing: FlightEvent[] = []
  try {
    existing = row.events_json ? (JSON.parse(row.events_json) as FlightEvent[]) : []
  } catch {
    existing = []
  }

  getDb()
    .prepare('UPDATE pireps SET events_json = ? WHERE id = ?')
    .run(JSON.stringify([...existing, ...newEvents]), id)
}

export function getCumulativeStats(): { cumulativeHours: number; totalFlights: number } {
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(flight_time_minutes), 0) AS total_minutes, COUNT(*) AS total_flights FROM pireps')
    .get() as { total_minutes: number; total_flights: number }

  return { cumulativeHours: row.total_minutes / 60, totalFlights: row.total_flights }
}
