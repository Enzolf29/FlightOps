import { getDb } from '../index'
import type { Aircraft, AircraftInput, AircraftPatch, AircraftWithStats } from '@shared/types/aircraft'
import { greatCircleDistanceNm } from '@shared/flightStatus/computeFlightDistanceProgress'
import { getAirportCoordinates } from '@shared/airports/airportCoordinates'

interface AircraftStatsRow {
  id: number
  company_id: number
  type: string
  registration: string | null
  simbrief_icao_code: string | null
  simbrief_fin: string | null
  mode_s: string | null
  notes: string | null
  company_icao_code: string
  company_display_name: string
  company_logo_filename: string
  flight_count: number
  total_minutes: number
  last_known_icao: string | null
  last_known_at: string | null
  average_landing_fpm: number | null
  average_fuel_consumption_kg: number | null
  most_visited_icao: string | null
  most_visited_count: number
}

// Position connue = aéroport d'arrivée du PIREP le plus récent de cet avion (l'avion "reste" là où
// il a atterri jusqu'à son prochain vol) — sous-requêtes corrélées plutôt qu'un JOIN supplémentaire,
// pour ne pas fausser flight_count/total_minutes qui agrègent déjà sur pireps.
const SELECT_WITH_STATS = `
  SELECT
    a.id, a.company_id, a.type, a.registration, a.simbrief_icao_code, a.simbrief_fin, a.mode_s, a.notes,
    c.icao_code AS company_icao_code, c.display_name AS company_display_name, c.logo_filename AS company_logo_filename,
    COUNT(p.id) AS flight_count,
    COALESCE(SUM(p.flight_time_minutes), 0) AS total_minutes,
    AVG(p.touchdown_vertical_speed_fpm) AS average_landing_fpm,
    AVG(
      CASE
        WHEN p.fuel_at_engine_start_kg IS NOT NULL AND p.fuel_at_engine_stop_kg IS NOT NULL
          AND p.fuel_at_engine_start_kg >= p.fuel_at_engine_stop_kg
        THEN p.fuel_at_engine_start_kg - p.fuel_at_engine_stop_kg
      END
    ) AS average_fuel_consumption_kg,
    (
      SELECT lf.arrival_icao FROM pireps lp
      JOIN flights lf ON lf.id = lp.flight_id
      WHERE lf.aircraft_id = a.id
      ORDER BY lp.actual_arrival_time DESC LIMIT 1
    ) AS last_known_icao,
    (
      SELECT lp.actual_arrival_time FROM pireps lp
      JOIN flights lf ON lf.id = lp.flight_id
      WHERE lf.aircraft_id = a.id
      ORDER BY lp.actual_arrival_time DESC LIMIT 1
    ) AS last_known_at
    ,(
      SELECT vf.arrival_icao FROM pireps vp
      JOIN flights vf ON vf.id = vp.flight_id
      WHERE vf.aircraft_id = a.id
      GROUP BY vf.arrival_icao
      ORDER BY COUNT(*) DESC, MAX(vp.actual_arrival_time) DESC
      LIMIT 1
    ) AS most_visited_icao
    ,COALESCE((
      SELECT COUNT(*) FROM pireps vp
      JOIN flights vf ON vf.id = vp.flight_id
      WHERE vf.aircraft_id = a.id
        AND vf.arrival_icao = (
          SELECT vf2.arrival_icao FROM pireps vp2
          JOIN flights vf2 ON vf2.id = vp2.flight_id
          WHERE vf2.aircraft_id = a.id
          GROUP BY vf2.arrival_icao
          ORDER BY COUNT(*) DESC, MAX(vp2.actual_arrival_time) DESC
          LIMIT 1
        )
    ), 0) AS most_visited_count
  FROM aircraft a
  JOIN companies c ON c.id = a.company_id
  LEFT JOIN flights f ON f.aircraft_id = a.id
  LEFT JOIN pireps p ON p.flight_id = f.id
`

function computeAverageDistanceNm(aircraftId: number): number | null {
  const rows = getDb()
    .prepare(
      `SELECT p.flight_path_json, f.departure_icao, f.arrival_icao
       FROM pireps p JOIN flights f ON f.id = p.flight_id
       WHERE f.aircraft_id = ?`
    )
    .all(aircraftId) as Array<{ flight_path_json: string | null; departure_icao: string; arrival_icao: string }>

  const distances: number[] = []
  for (const row of rows) {
    let distance = 0
    if (row.flight_path_json) {
      try {
        const path = JSON.parse(row.flight_path_json) as Array<{ lat: number; lon: number }>
        for (let index = 1; index < path.length; index += 1) {
          distance += greatCircleDistanceNm(path[index - 1].lat, path[index - 1].lon, path[index].lat, path[index].lon)
        }
      } catch {
        distance = 0
      }
    }
    if (distance <= 0) {
      const departure = getAirportCoordinates(row.departure_icao)
      const arrival = getAirportCoordinates(row.arrival_icao)
      if (departure && arrival) distance = greatCircleDistanceNm(departure.lat, departure.lon, arrival.lat, arrival.lon)
    }
    if (distance > 0 && Number.isFinite(distance)) distances.push(distance)
  }
  return distances.length > 0 ? distances.reduce((sum, distance) => sum + distance, 0) / distances.length : null
}

function mapAircraft(row: AircraftStatsRow): AircraftWithStats {
  return {
    id: row.id,
    companyId: row.company_id,
    type: row.type,
    registration: row.registration,
    simbriefIcaoCode: row.simbrief_icao_code,
    simbriefFin: row.simbrief_fin,
    modeS: row.mode_s,
    notes: row.notes,
    company: {
      icaoCode: row.company_icao_code,
      displayName: row.company_display_name,
      logoFilename: row.company_logo_filename
    },
    flightCount: row.flight_count,
    cumulativeHours: row.total_minutes / 60,
    lastKnownIcao: row.last_known_icao,
    lastKnownAt: row.last_known_at,
    cycleCount: row.flight_count,
    averageLandingFpm: row.average_landing_fpm,
    averageFuelConsumptionKg: row.average_fuel_consumption_kg,
    averageDistanceNm: computeAverageDistanceNm(row.id),
    mostVisitedIcao: row.most_visited_icao,
    mostVisitedCount: row.most_visited_count
  }
}

export function getAllAircraft(companyId?: number): AircraftWithStats[] {
  const sql = `${SELECT_WITH_STATS}${companyId ? ' WHERE a.company_id = ?' : ''} GROUP BY a.id ORDER BY c.display_name ASC, a.type ASC`
  const rows = (companyId ? getDb().prepare(sql).all(companyId) : getDb().prepare(sql).all()) as AircraftStatsRow[]
  return rows.map(mapAircraft)
}

interface PlainAircraftRow {
  id: number
  company_id: number
  type: string
  registration: string | null
  simbrief_icao_code: string | null
  simbrief_fin: string | null
  mode_s: string | null
  notes: string | null
}

function mapPlainAircraft(row: PlainAircraftRow): Aircraft {
  return {
    id: row.id,
    companyId: row.company_id,
    type: row.type,
    registration: row.registration,
    simbriefIcaoCode: row.simbrief_icao_code,
    simbriefFin: row.simbrief_fin,
    modeS: row.mode_s,
    notes: row.notes
  }
}

export function createAircraft(input: AircraftInput): Aircraft {
  const result = getDb()
    .prepare(
      'INSERT INTO aircraft (company_id, type, registration, simbrief_icao_code, simbrief_fin, mode_s, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      input.companyId,
      input.type,
      input.registration,
      input.simbriefIcaoCode,
      input.simbriefFin,
      input.modeS,
      input.notes
    )

  const row = getDb().prepare('SELECT * FROM aircraft WHERE id = ?').get(result.lastInsertRowid) as PlainAircraftRow
  return mapPlainAircraft(row)
}

export function updateAircraft(id: number, patch: AircraftPatch): Aircraft {
  const current = getDb().prepare('SELECT * FROM aircraft WHERE id = ?').get(id) as PlainAircraftRow | undefined
  if (!current) {
    throw new Error(`Aircraft ${id} not found`)
  }

  const next = {
    company_id: patch.companyId ?? current.company_id,
    type: patch.type ?? current.type,
    registration: patch.registration !== undefined ? patch.registration : current.registration,
    simbrief_icao_code: patch.simbriefIcaoCode !== undefined ? patch.simbriefIcaoCode : current.simbrief_icao_code,
    simbrief_fin: patch.simbriefFin !== undefined ? patch.simbriefFin : current.simbrief_fin,
    mode_s: patch.modeS !== undefined ? patch.modeS : current.mode_s,
    notes: patch.notes !== undefined ? patch.notes : current.notes
  }

  getDb()
    .prepare(
      'UPDATE aircraft SET company_id = ?, type = ?, registration = ?, simbrief_icao_code = ?, simbrief_fin = ?, mode_s = ?, notes = ? WHERE id = ?'
    )
    .run(
      next.company_id,
      next.type,
      next.registration,
      next.simbrief_icao_code,
      next.simbrief_fin,
      next.mode_s,
      next.notes,
      id
    )

  return mapPlainAircraft({ id, ...next })
}

/**
 * Détache l'avion des vols existants (aircraft_id nullable) avant suppression, plutôt que de
 * bloquer sur la contrainte FK : on garde l'historique des vols/PIREPs, seul le lien vers cet
 * avion précis disparaît.
 */
export function deleteAircraft(id: number): void {
  const db = getDb()
  const run = db.transaction(() => {
    db.prepare('UPDATE flights SET aircraft_id = NULL WHERE aircraft_id = ?').run(id)
    db.prepare('DELETE FROM aircraft WHERE id = ?').run(id)
  })
  run()
}
