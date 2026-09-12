import { getDb } from '../index'
import type {
  AircraftTypeFlightCount,
  CompanyFlightCount,
  CompanyProfitBreakdown,
  LandingRateCategoryCount,
  LandingRateStats,
  MonthlyHoursPoint,
  ProfitStats,
  PunctualityBreakdown,
  PunctualityExtremeFlight,
  PunctualityExtremes,
  RouteFlightCount,
  StatisticsOverview
} from '@shared/types/statistics'
import { HARD_LANDING_VS_FPM } from '@shared/flightStatus/evaluateFlightEvents'
import {
  categorizeLandingRate,
  LANDING_RATE_CATEGORY_LABEL,
  type LandingRateCategory
} from '@shared/flightStatus/categorizeLandingRate'
import type { GsxCostStats } from '@shared/types/gsxReceipt'
import { getGsxCostStatsForFlights } from '../../gsx/gsxReceiptsRepository'
import { getAllPireps, getCumulativeStats, getPirepsByAircraft } from './pirepRepository'
import { getAllCompanies } from './companyRepository'
import { getCompanyEconomySummary } from './economyRepository'

const TOP_ROUTES_LIMIT = 10
const LANDING_RATE_CATEGORY_ORDER: LandingRateCategory[] = ['very_smooth', 'smooth', 'normal', 'firm', 'hard', 'very_hard']

function getMonthlyHours(): MonthlyHoursPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT substr(actual_arrival_time, 1, 7) AS month, SUM(flight_time_minutes) AS total_minutes
       FROM pireps
       GROUP BY month
       ORDER BY month ASC`
    )
    .all() as Array<{ month: string; total_minutes: number }>

  return rows.map((row) => ({ month: row.month, hours: row.total_minutes / 60 }))
}

function getFlightsByCompany(): CompanyFlightCount[] {
  const rows = getDb()
    .prepare(
      `SELECT c.icao_code AS company_icao, c.display_name AS company_name, COUNT(*) AS count
       FROM pireps p
       JOIN flights f ON f.id = p.flight_id
       JOIN companies c ON c.id = f.company_id
       GROUP BY c.id
       ORDER BY count DESC`
    )
    .all() as Array<{ company_icao: string; company_name: string; count: number }>

  return rows.map((row) => ({ companyIcao: row.company_icao, companyName: row.company_name, count: row.count }))
}

function getFlightsByAircraftType(): AircraftTypeFlightCount[] {
  const rows = getDb()
    .prepare(
      `SELECT a.type AS type, COUNT(*) AS count
       FROM pireps p
       JOIN flights f ON f.id = p.flight_id
       JOIN aircraft a ON a.id = f.aircraft_id
       GROUP BY a.type
       ORDER BY count DESC`
    )
    .all() as Array<{ type: string; count: number }>

  return rows.map((row) => ({ type: row.type, count: row.count }))
}

function getTopRoutes(limit: number): RouteFlightCount[] {
  const rows = getDb()
    .prepare(
      `SELECT f.departure_icao AS departure_icao, f.arrival_icao AS arrival_icao, COUNT(*) AS count
       FROM pireps p
       JOIN flights f ON f.id = p.flight_id
       GROUP BY f.departure_icao, f.arrival_icao
       ORDER BY count DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ departure_icao: string; arrival_icao: string; count: number }>

  return rows.map((row) => ({ departureIcao: row.departure_icao, arrivalIcao: row.arrival_icao, count: row.count }))
}

function getPunctualityBreakdown(): PunctualityBreakdown {
  const rows = getDb().prepare('SELECT delay_bucket, COUNT(*) AS count FROM pireps GROUP BY delay_bucket').all() as Array<{
    delay_bucket: string | null
    count: number
  }>

  const cancelledRow = getDb().prepare("SELECT COUNT(*) AS count FROM flights WHERE status = 'cancelled'").get() as {
    count: number
  }

  const breakdown: PunctualityBreakdown = { onTime: 0, delayed10to60: 0, delayed60Plus: 0, cancelled: cancelledRow.count }
  for (const row of rows) {
    if (row.delay_bucket === 'on_time') breakdown.onTime = row.count
    else if (row.delay_bucket === 'delayed_10_60') breakdown.delayed10to60 = row.count
    else if (row.delay_bucket === 'delayed_60_plus') breakdown.delayed60Plus = row.count
  }
  return breakdown
}

interface PunctualityExtremeRow {
  flight_id: number
  flight_number: string
  departure_icao: string
  arrival_icao: string
  delay_minutes: number
  arrival_time: string | null
}

function mapPunctualityExtreme(row: PunctualityExtremeRow): PunctualityExtremeFlight {
  return {
    flightId: row.flight_id,
    flightNumber: row.flight_number,
    departureIcao: row.departure_icao,
    arrivalIcao: row.arrival_icao,
    delayMinutes: row.delay_minutes,
    arrivalTime: row.arrival_time
  }
}

function getPunctualityExtremes(): PunctualityExtremes {
  const EXTREME_SELECT = `
    SELECT p.flight_id AS flight_id, f.flight_number AS flight_number,
           f.departure_icao AS departure_icao, f.arrival_icao AS arrival_icao,
           p.delay_minutes AS delay_minutes, p.actual_arrival_time AS arrival_time
    FROM pireps p
    JOIN flights f ON f.id = p.flight_id
    WHERE p.delay_minutes IS NOT NULL
  `

  const avgRow = getDb()
    .prepare('SELECT AVG(delay_minutes) AS avg_delay FROM pireps WHERE delay_minutes IS NOT NULL')
    .get() as { avg_delay: number | null }

  const mostDelayedRow = getDb()
    .prepare(`${EXTREME_SELECT} AND p.delay_minutes > 0 ORDER BY p.delay_minutes DESC LIMIT 1`)
    .get() as PunctualityExtremeRow | undefined

  const mostEarlyRow = getDb()
    .prepare(`${EXTREME_SELECT} AND p.delay_minutes < 0 ORDER BY p.delay_minutes ASC LIMIT 1`)
    .get() as PunctualityExtremeRow | undefined

  return {
    averageDelayMinutes: avgRow.avg_delay,
    mostDelayed: mostDelayedRow ? mapPunctualityExtreme(mostDelayedRow) : null,
    mostEarly: mostEarlyRow ? mapPunctualityExtreme(mostEarlyRow) : null
  }
}

function getLandingRateStats(): LandingRateStats {
  const summary = getDb()
    .prepare(
      `SELECT AVG(touchdown_vertical_speed_fpm) AS avg_fpm,
              MAX(touchdown_vertical_speed_fpm) AS smoothest_fpm,
              MIN(touchdown_vertical_speed_fpm) AS hardest_fpm,
              COUNT(*) AS recorded_count
       FROM pireps
       WHERE touchdown_vertical_speed_fpm IS NOT NULL`
    )
    .get() as { avg_fpm: number | null; smoothest_fpm: number | null; hardest_fpm: number | null; recorded_count: number }

  const hardLandingRow = getDb()
    .prepare('SELECT COUNT(*) AS count FROM pireps WHERE touchdown_vertical_speed_fpm <= ?')
    .get(HARD_LANDING_VS_FPM) as { count: number }

  const history = getDb()
    .prepare(
      `SELECT touchdown_vertical_speed_fpm AS vs
       FROM pireps
       WHERE touchdown_vertical_speed_fpm IS NOT NULL`
    )
    .all() as Array<{ vs: number }>

  const categoryTally: Record<LandingRateCategory, number> = {
    very_smooth: 0,
    smooth: 0,
    normal: 0,
    firm: 0,
    hard: 0,
    very_hard: 0
  }
  for (const row of history) {
    categoryTally[categorizeLandingRate(row.vs)] += 1
  }
  const categoryBreakdown: LandingRateCategoryCount[] = LANDING_RATE_CATEGORY_ORDER.map((category) => ({
    category,
    label: LANDING_RATE_CATEGORY_LABEL[category],
    count: categoryTally[category]
  }))

  // Moyenne mensuelle plutôt que le détail vol par vol : au-delà de quelques dizaines de vols, une
  // courbe par vol devient illisible (voir getMonthlyHours pour le même principe de regroupement).
  const monthlyRows = getDb()
    .prepare(
      `SELECT substr(actual_arrival_time, 1, 7) AS month,
              AVG(touchdown_vertical_speed_fpm) AS avg_fpm,
              COUNT(*) AS count
       FROM pireps
       WHERE touchdown_vertical_speed_fpm IS NOT NULL
       GROUP BY month
       ORDER BY month ASC`
    )
    .all() as Array<{ month: string; avg_fpm: number; count: number }>

  return {
    averageFpm: summary.avg_fpm,
    smoothestFpm: summary.smoothest_fpm,
    hardestFpm: summary.hardest_fpm,
    hardLandingCount: hardLandingRow.count,
    recordedCount: summary.recorded_count,
    monthlyAverages: monthlyRows.map((row) => ({ month: row.month, averageFpm: row.avg_fpm, count: row.count })),
    categoryBreakdown
  }
}

function gsxCostStatsForPireps(pireps: ReturnType<typeof getAllPireps>): GsxCostStats {
  return getGsxCostStatsForFlights(
    pireps.map((pirep) => ({
      departureIcao: pirep.flight.departureIcao,
      arrivalIcao: pirep.flight.arrivalIcao,
      scheduledDeparture: pirep.flight.scheduledDeparture,
      aircraft: pirep.flight.aircraft,
      referenceEndIso: pirep.engineStopTime
    }))
  )
}

/** Frais GSX rattachés aux vols terminés d'un avion précis (fiche avion) — même logique de
 * rapprochement que les statistiques globales, mais restreinte à cet avion. */
export function getGsxCostStatsForAircraft(aircraftId: number): GsxCostStats {
  return gsxCostStatsForPireps(getPirepsByAircraft(aircraftId))
}

/** Revenu, coût GSX et bénéfice agrégés sur toutes les compagnies — réutilise
 * getCompanyEconomySummary (même calcul que la page Économie) plutôt que de le recalculer ici. */
function getProfitStats(): ProfitStats {
  const byCompany: CompanyProfitBreakdown[] = []
  let totalRevenueEur = 0
  let totalCostEur = 0
  let flightsWithRevenue = 0

  for (const company of getAllCompanies()) {
    const summary = getCompanyEconomySummary(company.id)
    if (summary.flightsWithData === 0) continue
    totalRevenueEur += summary.totalRevenueEur
    totalCostEur += summary.totalCostEur
    flightsWithRevenue += summary.flightsWithData
    byCompany.push({
      companyIcao: company.icaoCode,
      companyName: company.displayName,
      revenueEur: summary.totalRevenueEur,
      costEur: summary.totalCostEur,
      profitEur: summary.profitEur
    })
  }

  byCompany.sort((a, b) => b.profitEur - a.profitEur)

  return {
    totalRevenueEur,
    totalCostEur,
    totalProfitEur: totalRevenueEur - totalCostEur,
    flightsWithRevenue,
    byCompany
  }
}

export function getStatisticsOverview(): StatisticsOverview {
  const { cumulativeHours, totalFlights } = getCumulativeStats()

  return {
    totalFlights,
    cumulativeHours,
    monthlyHours: getMonthlyHours(),
    byCompany: getFlightsByCompany(),
    byAircraftType: getFlightsByAircraftType(),
    topRoutes: getTopRoutes(TOP_ROUTES_LIMIT),
    punctuality: getPunctualityBreakdown(),
    punctualityExtremes: getPunctualityExtremes(),
    landingRate: getLandingRateStats(),
    gsxCosts: gsxCostStatsForPireps(getAllPireps()),
    profit: getProfitStats()
  }
}
