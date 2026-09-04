import { getDb } from '../index'
import type { Flight, FlightSource, FlightStatus, FlightWithRelations } from '@shared/types/flight'
import { shouldAutoCancelFlight } from '@shared/flightStatus/shouldAutoCancelFlight'

interface FlightJoinRow {
  id: number
  company_id: number
  aircraft_id: number | null
  flight_number: string
  callsign: string
  callsign_display: string
  departure_icao: string
  arrival_icao: string
  scheduled_departure: string
  scheduled_arrival: string
  status: FlightStatus
  source: FlightSource
  route: string | null
  alternate_icao: string | null
  company_icao_code: string
  company_display_name: string
  company_logo_filename: string
  aircraft_type: string | null
  aircraft_registration: string | null
}

const SELECT_WITH_RELATIONS = `
  SELECT
    f.id, f.company_id, f.aircraft_id, f.flight_number, f.callsign, f.callsign_display,
    f.departure_icao, f.arrival_icao, f.scheduled_departure, f.scheduled_arrival, f.status, f.source, f.route,
    f.alternate_icao,
    c.icao_code AS company_icao_code, c.display_name AS company_display_name, c.logo_filename AS company_logo_filename,
    a.type AS aircraft_type, a.registration AS aircraft_registration
  FROM flights f
  JOIN companies c ON c.id = f.company_id
  LEFT JOIN aircraft a ON a.id = f.aircraft_id
`

/** Met à jour en base tous les vols jamais démarrés dont le départ prévu est dépassé de plus de 3 h. */
export function cancelExpiredUpcomingFlights(nowIso = new Date().toISOString()): number {
  const candidates = getDb()
    .prepare("SELECT id, scheduled_departure FROM flights WHERE status = 'upcoming'")
    .all() as Array<{ id: number; scheduled_departure: string }>
  const expiredIds = candidates
    .filter((flight) => shouldAutoCancelFlight(flight.scheduled_departure, nowIso))
    .map((flight) => flight.id)
  if (expiredIds.length === 0) return 0

  const update = getDb().prepare("UPDATE flights SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'upcoming'")
  const apply = getDb().transaction((ids: number[]) => {
    let changed = 0
    for (const id of ids) changed += update.run(id).changes
    return changed
  })
  return apply(expiredIds)
}

function mapFlight(row: FlightJoinRow): FlightWithRelations {
  const flight: Flight = {
    id: row.id,
    companyId: row.company_id,
    aircraftId: row.aircraft_id,
    flightNumber: row.flight_number,
    callsign: row.callsign,
    callsignDisplay: row.callsign_display,
    departureIcao: row.departure_icao,
    arrivalIcao: row.arrival_icao,
    scheduledDeparture: row.scheduled_departure,
    scheduledArrival: row.scheduled_arrival,
    status: row.status,
    source: row.source,
    route: row.route,
    alternateIcao: row.alternate_icao
  }

  return {
    ...flight,
    company: {
      icaoCode: row.company_icao_code,
      displayName: row.company_display_name,
      logoFilename: row.company_logo_filename
    },
    aircraft: row.aircraft_type ? { type: row.aircraft_type, registration: row.aircraft_registration } : null
  }
}

export function getCurrentFlight(): FlightWithRelations | null {
  const row = getDb()
    .prepare(`${SELECT_WITH_RELATIONS} WHERE f.status = 'in_progress' ORDER BY f.scheduled_departure ASC LIMIT 1`)
    .get() as FlightJoinRow | undefined
  return row ? mapFlight(row) : null
}

export function getNextFlight(): FlightWithRelations | null {
  cancelExpiredUpcomingFlights()
  const row = getDb()
    .prepare(`${SELECT_WITH_RELATIONS} WHERE f.status = 'upcoming' ORDER BY f.scheduled_departure ASC LIMIT 1`)
    .get() as FlightJoinRow | undefined
  return row ? mapFlight(row) : null
}

export function getUpcomingFlights(excludeFlightId: number | null, limit: number): FlightWithRelations[] {
  cancelExpiredUpcomingFlights()
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_RELATIONS} WHERE f.status = 'upcoming' AND f.id != ? ORDER BY f.scheduled_departure ASC LIMIT ?`
    )
    .all(excludeFlightId ?? -1, limit) as FlightJoinRow[]
  return rows.map(mapFlight)
}

export function getFlightWithRelationsById(id: number): FlightWithRelations | null {
  const row = getDb().prepare(`${SELECT_WITH_RELATIONS} WHERE f.id = ?`).get(id) as FlightJoinRow | undefined
  return row ? mapFlight(row) : null
}

export function getAllFlights(): FlightWithRelations[] {
  cancelExpiredUpcomingFlights()
  const rows = getDb().prepare(`${SELECT_WITH_RELATIONS} ORDER BY f.scheduled_departure DESC`).all() as FlightJoinRow[]
  return rows.map(mapFlight)
}

export function setFlightStatus(id: number, status: FlightStatus): void {
  getDb().prepare('UPDATE flights SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id)
}

export function deleteFlight(id: number): void {
  getDb().prepare('DELETE FROM flights WHERE id = ?').run(id)
}

export function getAllCallsigns(): string[] {
  const rows = getDb().prepare('SELECT callsign FROM flights').all() as Array<{ callsign: string }>
  return rows.map((row) => row.callsign)
}

/** Le JSON complet de l'OFP peut être volumineux : jamais inclus dans les listes, seulement à la demande. */
export function getFlightOfpJson(id: number): string | null {
  const row = getDb().prepare('SELECT simbrief_ofp_json FROM flights WHERE id = ?').get(id) as
    | { simbrief_ofp_json: string | null }
    | undefined
  return row?.simbrief_ofp_json ?? null
}

export interface CreateFlightRow {
  companyId: number
  aircraftId: number | null
  flightNumber: string
  callsign: string
  callsignDisplay: string
  departureIcao: string
  arrivalIcao: string
  scheduledDeparture: string
  scheduledArrival: string
  status: FlightStatus
  source: FlightSource
  route: string | null
  alternateIcao: string | null
  simbriefOfpJson: string | null
}

export function createFlight(input: CreateFlightRow): number {
  const result = getDb()
    .prepare(
      `INSERT INTO flights (
        company_id, aircraft_id, flight_number, callsign, callsign_display,
        departure_icao, arrival_icao, scheduled_departure, scheduled_arrival, status, source,
        route, alternate_icao, simbrief_ofp_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.companyId,
      input.aircraftId,
      input.flightNumber,
      input.callsign,
      input.callsignDisplay,
      input.departureIcao,
      input.arrivalIcao,
      input.scheduledDeparture,
      input.scheduledArrival,
      input.status,
      input.source,
      input.route,
      input.alternateIcao,
      input.simbriefOfpJson
    )
  return Number(result.lastInsertRowid)
}
