import { getDb } from '../index'
import type { RealRoute, RealRouteAircraft, RealRouteSource } from '@shared/types/realFlights'

interface RealRouteRow {
  id: number
  company_id: number
  departure_icao: string
  arrival_icao: string
  source: RealRouteSource
  typical_duration_minutes: number | null
  last_fetched_at: string | null
}

const SELECT_ROUTE = `
  SELECT r.id, r.company_id, r.departure_icao, r.arrival_icao, r.source, r.typical_duration_minutes, r.last_fetched_at
  FROM real_routes r
`

function getAircraftForRoute(routeId: number): RealRouteAircraft[] {
  const rows = getDb()
    .prepare(
      'SELECT icao_type, type_description FROM real_route_aircraft WHERE real_route_id = ? ORDER BY type_description ASC'
    )
    .all(routeId) as Array<{ icao_type: string; type_description: string }>
  return rows.map((row) => ({ icaoType: row.icao_type, typeDescription: row.type_description }))
}

function mapRoute(row: RealRouteRow): RealRoute {
  return {
    id: row.id,
    companyId: row.company_id,
    departureIcao: row.departure_icao,
    arrivalIcao: row.arrival_icao,
    source: row.source,
    typicalDurationMinutes: row.typical_duration_minutes,
    lastFetchedAt: row.last_fetched_at,
    aircraft: getAircraftForRoute(row.id)
  }
}

export function getCachedRoutes(companyId: number, departureIcao: string): RealRoute[] {
  const rows = getDb()
    .prepare(`${SELECT_ROUTE} WHERE r.company_id = ? AND r.departure_icao = ? ORDER BY r.arrival_icao ASC`)
    .all(companyId, departureIcao) as RealRouteRow[]
  return rows.map(mapRoute)
}

/** Toutes les routes déjà en cache pour cette compagnie, tous aéroports de départ confondus — pour
 * parcourir le réseau connu sans avoir à interroger l'API pour chaque aéroport un par un. */
export function getAllRoutesForCompany(companyId: number): RealRoute[] {
  const rows = getDb()
    .prepare(`${SELECT_ROUTE} WHERE r.company_id = ? ORDER BY r.departure_icao ASC, r.arrival_icao ASC`)
    .all(companyId) as RealRouteRow[]
  return rows.map(mapRoute)
}

export function getRouteById(id: number): RealRoute | null {
  const row = getDb().prepare(`${SELECT_ROUTE} WHERE r.id = ?`).get(id) as RealRouteRow | undefined
  return row ? mapRoute(row) : null
}

function findRouteId(companyId: number, departureIcao: string, arrivalIcao: string): number | undefined {
  const row = getDb()
    .prepare('SELECT id FROM real_routes WHERE company_id = ? AND departure_icao = ? AND arrival_icao = ?')
    .get(companyId, departureIcao, arrivalIcao) as { id: number } | undefined
  return row?.id
}

/**
 * Remplace entièrement la liste d'avions d'une route (plutôt que d'accumuler) : chaque
 * rafraîchissement doit refléter exactement ce que le dernier passage a observé, pas une union
 * qui grossit indéfiniment (et qui garderait d'anciennes entrées erronées après correction d'un bug
 * de détection de type, par exemple).
 */
function replaceAircraft(routeId: number, aircraft: RealRouteAircraft[]): void {
  const db = getDb()
  const run = db.transaction(() => {
    db.prepare('DELETE FROM real_route_aircraft WHERE real_route_id = ?').run(routeId)
    const stmt = db.prepare('INSERT INTO real_route_aircraft (real_route_id, icao_type, type_description) VALUES (?, ?, ?)')
    for (const item of aircraft) {
      stmt.run(routeId, item.icaoType, item.typeDescription)
    }
  })
  run()
}

/** Écrit/rafraîchit une route confirmée par l'API : source toujours forcée à 'api'. */
export function upsertRouteFromApi(
  companyId: number,
  departureIcao: string,
  arrivalIcao: string,
  aircraft: RealRouteAircraft[],
  typicalDurationMinutes: number | null
): number {
  const db = getDb()
  db.prepare(
    `INSERT INTO real_routes (company_id, departure_icao, arrival_icao, source, typical_duration_minutes, last_fetched_at)
     VALUES (?, ?, ?, 'api', ?, datetime('now'))
     ON CONFLICT(company_id, departure_icao, arrival_icao)
     DO UPDATE SET source = 'api', typical_duration_minutes = excluded.typical_duration_minutes, last_fetched_at = excluded.last_fetched_at`
  ).run(companyId, departureIcao, arrivalIcao, typicalDurationMinutes)

  const routeId = findRouteId(companyId, departureIcao, arrivalIcao)!
  replaceAircraft(routeId, aircraft)
  return routeId
}

/**
 * Comble le trajet retour avec les mêmes avions, uniquement si aucune donnée n'existe déjà pour
 * ce sens. Ne remplace jamais une route confirmée par l'API ('api') avec une déduction ('reciprocal').
 */
export function ensureReciprocalRoute(
  companyId: number,
  departureIcao: string,
  arrivalIcao: string,
  aircraft: RealRouteAircraft[],
  typicalDurationMinutes: number | null
): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT id, source FROM real_routes WHERE company_id = ? AND departure_icao = ? AND arrival_icao = ?')
    .get(companyId, departureIcao, arrivalIcao) as { id: number; source: RealRouteSource } | undefined

  if (existing) {
    if (existing.source === 'reciprocal') {
      replaceAircraft(existing.id, aircraft)
    }
    return
  }

  db.prepare(
    `INSERT INTO real_routes (company_id, departure_icao, arrival_icao, source, typical_duration_minutes, last_fetched_at)
     VALUES (?, ?, ?, 'reciprocal', ?, datetime('now'))`
  ).run(companyId, departureIcao, arrivalIcao, typicalDurationMinutes)

  const routeId = findRouteId(companyId, departureIcao, arrivalIcao)!
  replaceAircraft(routeId, aircraft)
}

export function addFlightNumberObservation(routeId: number, flightNumber: string): void {
  getDb()
    .prepare(
      `INSERT INTO real_route_flight_numbers (real_route_id, flight_number, observed_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(real_route_id, flight_number) DO UPDATE SET observed_at = excluded.observed_at`
    )
    .run(routeId, flightNumber)
}

export function getFlightNumbersForRoute(routeId: number): string[] {
  const rows = getDb()
    .prepare('SELECT flight_number FROM real_route_flight_numbers WHERE real_route_id = ? ORDER BY observed_at DESC')
    .all(routeId) as Array<{ flight_number: string }>
  return rows.map((row) => row.flight_number)
}
