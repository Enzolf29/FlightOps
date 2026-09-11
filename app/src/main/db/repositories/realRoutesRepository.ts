import { getDb } from '../index'
import type { RealRoute, RealRouteAircraft, RealRouteSource } from '@shared/types/realFlights'
import { normalizeRealFlightAircraftFamily } from '@shared/realFlights/normalizeRealFlightAircraftFamily'

interface RealRouteRow {
  id: number
  company_id: number
  departure_icao: string
  arrival_icao: string
  source: RealRouteSource
  typical_duration_minutes: number | null
  last_fetched_at: string | null
  last_observed_at: string | null
  observation_count: number
}

export interface RealRouteObservationInput {
  key: string
  aircraftIcaoType: string | null
  observedAt: string
}

const SELECT_ROUTE = `
  SELECT r.id, r.company_id, r.departure_icao, r.arrival_icao, r.source,
    r.typical_duration_minutes, r.last_fetched_at,
    MAX(o.observed_at) AS last_observed_at,
    COUNT(o.id) AS observation_count
  FROM real_routes r
  LEFT JOIN real_route_observations o ON o.real_route_id = r.id
`

function getAircraftForRoute(routeId: number): RealRouteAircraft[] {
  const rows = getDb()
    .prepare(
      `SELECT a.icao_type, a.type_description, COUNT(o.id) AS observation_count
       FROM real_route_aircraft a
       LEFT JOIN real_route_observations o
         ON o.real_route_id = a.real_route_id AND o.aircraft_icao_type = a.icao_type
       WHERE a.real_route_id = ?
       GROUP BY a.id
       ORDER BY observation_count DESC, a.type_description ASC`
    )
    .all(routeId) as Array<{ icao_type: string; type_description: string; observation_count: number }>
  const grouped = new Map<string, RealRouteAircraft>()
  for (const row of rows) {
    const normalized = normalizeRealFlightAircraftFamily(row.icao_type, row.type_description)
    if (!normalized) continue
    const current = grouped.get(normalized.icaoType)
    grouped.set(normalized.icaoType, {
      ...normalized,
      observationCount: (current?.observationCount ?? 0) + row.observation_count
    })
  }
  return [...grouped.values()].sort(
    (a, b) => b.observationCount - a.observationCount || a.typeDescription.localeCompare(b.typeDescription)
  )
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
    lastObservedAt: row.last_observed_at,
    observationCount: row.observation_count,
    aircraft: getAircraftForRoute(row.id)
  }
}

export function getCachedRoutes(companyId: number, departureIcao: string): RealRoute[] {
  const rows = getDb()
    .prepare(`${SELECT_ROUTE} WHERE r.company_id = ? AND r.departure_icao = ? GROUP BY r.id ORDER BY r.arrival_icao ASC`)
    .all(companyId, departureIcao) as RealRouteRow[]
  return rows.map(mapRoute)
}

/** Toutes les routes déjà en cache pour cette compagnie, tous aéroports de départ confondus — pour
 * parcourir le réseau connu sans avoir à interroger l'API pour chaque aéroport un par un. */
export function getAllRoutesForCompany(companyId: number): RealRoute[] {
  const rows = getDb()
    .prepare(`${SELECT_ROUTE} WHERE r.company_id = ? GROUP BY r.id ORDER BY r.departure_icao ASC, r.arrival_icao ASC`)
    .all(companyId) as RealRouteRow[]
  return rows.map(mapRoute)
}

export function getRouteById(id: number): RealRoute | null {
  const row = getDb().prepare(`${SELECT_ROUTE} WHERE r.id = ? GROUP BY r.id`).get(id) as RealRouteRow | undefined
  return row ? mapRoute(row) : null
}

function findRouteId(companyId: number, departureIcao: string, arrivalIcao: string): number | undefined {
  const row = getDb()
    .prepare('SELECT id FROM real_routes WHERE company_id = ? AND departure_icao = ? AND arrival_icao = ?')
    .get(companyId, departureIcao, arrivalIcao) as { id: number } | undefined
  return row?.id
}

/** Conserve tous les types déjà observés sur la route sans dupliquer une même variante OACI. */
function mergeAircraft(routeId: number, aircraft: Array<Pick<RealRouteAircraft, 'icaoType' | 'typeDescription'>>): void {
  const db = getDb()
  const run = db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO real_route_aircraft (real_route_id, icao_type, type_description) VALUES (?, ?, ?)
       ON CONFLICT(real_route_id, icao_type) DO UPDATE SET type_description = excluded.type_description`
    )
    for (const item of aircraft) {
      const normalized = normalizeRealFlightAircraftFamily(item.icaoType, item.typeDescription)
      if (normalized) stmt.run(routeId, normalized.icaoType, normalized.typeDescription)
    }
  })
  run()
}

function addObservations(routeId: number, observations: RealRouteObservationInput[], inferred: boolean): void {
  const insert = getDb().prepare(
    `INSERT OR IGNORE INTO real_route_observations
       (real_route_id, observation_key, aircraft_icao_type, observed_at, inferred)
     VALUES (?, ?, ?, ?, ?)`
  )
  const run = getDb().transaction(() => {
    for (const observation of observations) {
      const normalizedType = normalizeRealFlightAircraftFamily(observation.aircraftIcaoType)?.icaoType ?? null
      insert.run(routeId, observation.key, normalizedType, observation.observedAt, inferred ? 1 : 0)
    }
  })
  run()
}

/** Écrit/rafraîchit une route confirmée par l'API : source toujours forcée à 'api'. */
export function upsertRouteFromApi(
  companyId: number,
  departureIcao: string,
  arrivalIcao: string,
  aircraft: Array<Pick<RealRouteAircraft, 'icaoType' | 'typeDescription'>>,
  typicalDurationMinutes: number | null,
  observations: RealRouteObservationInput[]
): number {
  const db = getDb()
  db.prepare(
    `INSERT INTO real_routes (company_id, departure_icao, arrival_icao, source, typical_duration_minutes, last_fetched_at)
     VALUES (?, ?, ?, 'api', ?, datetime('now'))
     ON CONFLICT(company_id, departure_icao, arrival_icao)
     DO UPDATE SET source = 'api', typical_duration_minutes = excluded.typical_duration_minutes, last_fetched_at = excluded.last_fetched_at`
  ).run(companyId, departureIcao, arrivalIcao, typicalDurationMinutes)

  const routeId = findRouteId(companyId, departureIcao, arrivalIcao)!
  mergeAircraft(routeId, aircraft)
  addObservations(routeId, observations, false)
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
  aircraft: Array<Pick<RealRouteAircraft, 'icaoType' | 'typeDescription'>>,
  typicalDurationMinutes: number | null,
  observations: RealRouteObservationInput[]
): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT id, source FROM real_routes WHERE company_id = ? AND departure_icao = ? AND arrival_icao = ?')
    .get(companyId, departureIcao, arrivalIcao) as { id: number; source: RealRouteSource } | undefined

  if (existing) {
    if (existing.source === 'reciprocal') {
      getDb().prepare(
        `UPDATE real_routes SET typical_duration_minutes = ?, last_fetched_at = datetime('now') WHERE id = ?`
      ).run(typicalDurationMinutes, existing.id)
      mergeAircraft(existing.id, aircraft)
      addObservations(
        existing.id,
        observations.map((observation) => ({ ...observation, key: `reciprocal:${observation.key}` })),
        true
      )
    }
    return
  }

  db.prepare(
    `INSERT INTO real_routes (company_id, departure_icao, arrival_icao, source, typical_duration_minutes, last_fetched_at)
     VALUES (?, ?, ?, 'reciprocal', ?, datetime('now'))`
  ).run(companyId, departureIcao, arrivalIcao, typicalDurationMinutes)

  const routeId = findRouteId(companyId, departureIcao, arrivalIcao)!
  mergeAircraft(routeId, aircraft)
  addObservations(
    routeId,
    observations.map((observation) => ({ ...observation, key: `reciprocal:${observation.key}` })),
    true
  )
}

export function getKnownDepartureAirports(companyId: number): Array<{ icao: string; lastFetchedAt: string | null }> {
  return getDb()
    .prepare(
      `SELECT departure_icao AS icao, MAX(last_fetched_at) AS lastFetchedAt
       FROM real_routes WHERE company_id = ? AND source = 'api'
       GROUP BY departure_icao ORDER BY lastFetchedAt ASC`
    )
    .all(companyId) as Array<{ icao: string; lastFetchedAt: string | null }>
}

/** Au-delà de ce nombre d'observations, une même route ne pèse pas plus lourd dans le score
 * d'activité — sans ça, une seule route revérifiée à chaque recherche gonflerait le score d'un
 * aéroport par ailleurs très peu desservi, à tort perçu comme un vrai hub. */
const OBSERVATION_SCORE_CAP_PER_ROUTE = 5

/**
 * Activité réelle connue (Vols réels/AeroDataBox) pour cette compagnie au départ de cet aéroport —
 * sert de proxy "taille d'aéroport" pour le mode économie (voir computeAirportSurcharge). Somme,
 * route par route, le nombre d'observations plafonné à OBSERVATION_SCORE_CAP_PER_ROUTE — un simple
 * cumul "nombre de destinations + observations" surestimerait un aéroport dont beaucoup de
 * destinations n'ont été vues qu'une seule fois (une grosse recherche AeroDataBox déclare d'un coup
 * des dizaines de routes distinctes) : seules des routes confirmées à plusieurs reprises comptent
 * vraiment pour beaucoup, ce qui distingue un vrai hub souvent revérifié d'un aéroport moyen
 * simplement balayé une fois en largeur.
 *
 * Null si cet aéroport n'a jamais été recherché pour cette compagnie, distinct de 0 (recherché mais
 * aucune destination trouvée).
 */
export function getKnownAirportActivityScore(companyId: number, departureIcao: string): number | null {
  const normalized = departureIcao.trim().toUpperCase()
  const searched = getKnownDepartureAirports(companyId).some((entry) => entry.icao === normalized)
  if (!searched) return null

  const row = getDb()
    .prepare(
      `SELECT SUM(capped) AS score FROM (
         SELECT MIN(obs_count, ?) AS capped FROM (
           SELECT COUNT(o.id) AS obs_count
           FROM real_routes r
           LEFT JOIN real_route_observations o ON o.real_route_id = r.id
           WHERE r.company_id = ? AND r.departure_icao = ?
           GROUP BY r.id
         )
       )`
    )
    .get(OBSERVATION_SCORE_CAP_PER_ROUTE, companyId, normalized) as { score: number | null }

  return row.score ?? 0
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
