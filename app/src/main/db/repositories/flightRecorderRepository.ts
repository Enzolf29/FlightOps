import { getDb } from '../index'
import type { SimTelemetry } from '@shared/types/simconnect'

export interface StoredFlightSession {
  flightId: number
  stateJson: string
  startedAt: string
  lastSavedAt: string
  recoveredCount: number
}

export function saveFlightSession(flightId: number, state: unknown, startedAt: string, savedAt: string): void {
  getDb()
    .prepare(
      `INSERT INTO flight_tracking_sessions (flight_id, state_json, started_at, last_saved_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(flight_id) DO UPDATE SET
         state_json = excluded.state_json,
         last_saved_at = excluded.last_saved_at`
    )
    .run(flightId, JSON.stringify(state), startedAt, savedAt)
}

export function loadLatestFlightSession(): StoredFlightSession | null {
  const row = getDb()
    .prepare(
      `SELECT s.flight_id, s.state_json, s.started_at, s.last_saved_at, s.recovered_count
       FROM flight_tracking_sessions s
       JOIN flights f ON f.id = s.flight_id
       WHERE f.status IN ('upcoming', 'in_progress')
       ORDER BY s.last_saved_at DESC
       LIMIT 1`
    )
    .get() as
    | { flight_id: number; state_json: string; started_at: string; last_saved_at: string; recovered_count: number }
    | undefined

  return row
    ? {
        flightId: row.flight_id,
        stateJson: row.state_json,
        startedAt: row.started_at,
        lastSavedAt: row.last_saved_at,
        recoveredCount: row.recovered_count
      }
    : null
}

export function markFlightSessionRecovered(flightId: number): void {
  getDb()
    .prepare('UPDATE flight_tracking_sessions SET recovered_count = recovered_count + 1 WHERE flight_id = ?')
    .run(flightId)
}

export function deleteFlightSession(flightId: number): void {
  getDb().prepare('DELETE FROM flight_tracking_sessions WHERE flight_id = ?').run(flightId)
}

export function insertTelemetrySample(flightId: number, telemetry: SimTelemetry, phase: string): void {
  getDb()
    .prepare(
      `INSERT INTO flight_telemetry_samples (
         flight_id, sim_time_iso, latitude, longitude, altitude_feet, altitude_agl_feet,
         heading_true, indicated_airspeed_kt, ground_speed_kt, vertical_speed_fpm,
         fuel_kg, on_ground, phase, bank_degrees, pitch_degrees, gear_down, flaps_index, landing_lights_on
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      flightId,
      telemetry.simZuluIso,
      telemetry.latitude,
      telemetry.longitude,
      telemetry.altitude,
      telemetry.altitudeAboveGround ?? 0,
      telemetry.headingTrue,
      telemetry.airspeedIndicated,
      telemetry.groundVelocity,
      telemetry.verticalSpeed,
      telemetry.fuelTotalWeight,
      telemetry.onGround ? 1 : 0,
      phase,
      telemetry.bankDegrees,
      telemetry.pitchDegrees,
      telemetry.gearHandleDown ? 1 : 0,
      telemetry.flapsHandleIndex,
      telemetry.landingLightsOn ? 1 : 0
    )
}

export function countTelemetrySamples(flightId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM flight_telemetry_samples WHERE flight_id = ?')
    .get(flightId) as { count: number }
  return row.count
}
