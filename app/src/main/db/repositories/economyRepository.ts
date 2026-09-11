import { getDb } from '../index'
import type { CompanyEconomySummary, FlightEconomy, FlightEconomyInput, RoutePrice, RoutePriceInput } from '@shared/types/economy'
import type { PirepWithFlight } from '@shared/types/pirep'
import { getGsxCostStatsForFlights } from '../../gsx/gsxReceiptsRepository'
import { getAllPireps, getPirepsByAircraft } from './pirepRepository'

const SELECT_ROUTE_PRICE =
  `SELECT id, company_id, departure_icao, arrival_icao, ticket_price_min_eur, ticket_price_max_eur,
    cargo_price_min_eur_per_kg, cargo_price_max_eur_per_kg
   FROM route_prices`

interface RoutePriceRow {
  id: number
  company_id: number
  departure_icao: string
  arrival_icao: string
  ticket_price_min_eur: number
  ticket_price_max_eur: number
  cargo_price_min_eur_per_kg: number
  cargo_price_max_eur_per_kg: number
}

function mapRoutePrice(row: RoutePriceRow): RoutePrice {
  return {
    id: row.id,
    companyId: row.company_id,
    departureIcao: row.departure_icao,
    arrivalIcao: row.arrival_icao,
    ticketPriceMinEur: row.ticket_price_min_eur,
    ticketPriceMaxEur: row.ticket_price_max_eur,
    cargoPriceMinEurPerKg: row.cargo_price_min_eur_per_kg,
    cargoPriceMaxEurPerKg: row.cargo_price_max_eur_per_kg
  }
}

export function listRoutePricesForCompany(companyId: number): RoutePrice[] {
  const rows = getDb()
    .prepare(`${SELECT_ROUTE_PRICE} WHERE company_id = ? ORDER BY departure_icao ASC, arrival_icao ASC`)
    .all(companyId) as RoutePriceRow[]
  return rows.map(mapRoutePrice)
}

export function getRoutePrice(companyId: number, departureIcao: string, arrivalIcao: string): RoutePrice | null {
  const row = getDb()
    .prepare(`${SELECT_ROUTE_PRICE} WHERE company_id = ? AND departure_icao = ? AND arrival_icao = ?`)
    .get(companyId, departureIcao.trim().toUpperCase(), arrivalIcao.trim().toUpperCase()) as RoutePriceRow | undefined
  return row ? mapRoutePrice(row) : null
}

export function upsertRoutePrice(input: RoutePriceInput): RoutePrice {
  const departureIcao = input.departureIcao.trim().toUpperCase()
  const arrivalIcao = input.arrivalIcao.trim().toUpperCase()

  getDb()
    .prepare(
      `INSERT INTO route_prices
        (company_id, departure_icao, arrival_icao, ticket_price_min_eur, ticket_price_max_eur,
         cargo_price_min_eur_per_kg, cargo_price_max_eur_per_kg, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(company_id, departure_icao, arrival_icao) DO UPDATE SET
         ticket_price_min_eur = excluded.ticket_price_min_eur,
         ticket_price_max_eur = excluded.ticket_price_max_eur,
         cargo_price_min_eur_per_kg = excluded.cargo_price_min_eur_per_kg,
         cargo_price_max_eur_per_kg = excluded.cargo_price_max_eur_per_kg,
         updated_at = datetime('now')`
    )
    .run(
      input.companyId,
      departureIcao,
      arrivalIcao,
      input.ticketPriceMinEur,
      input.ticketPriceMaxEur,
      input.cargoPriceMinEurPerKg,
      input.cargoPriceMaxEurPerKg
    )

  return getRoutePrice(input.companyId, departureIcao, arrivalIcao)!
}

export function deleteRoutePrice(id: number): void {
  getDb().prepare('DELETE FROM route_prices WHERE id = ?').run(id)
}

interface FlightEconomyRow {
  flight_id: number
  ticket_price_eur: number
  cargo_price_eur_per_kg: number
  reference_ticket_price_eur: number
  reference_cargo_price_eur_per_kg: number
  cabin_revenue_multiplier: number
  passengers_sold: number | null
  cargo_kg_sold: number | null
  revenue_eur: number | null
}

function mapFlightEconomy(row: FlightEconomyRow): FlightEconomy {
  return {
    flightId: row.flight_id,
    ticketPriceEur: row.ticket_price_eur,
    cargoPriceEurPerKg: row.cargo_price_eur_per_kg,
    referenceTicketPriceEur: row.reference_ticket_price_eur,
    referenceCargoPriceEurPerKg: row.reference_cargo_price_eur_per_kg,
    cabinRevenueMultiplier: row.cabin_revenue_multiplier,
    passengersSold: row.passengers_sold,
    cargoKgSold: row.cargo_kg_sold,
    revenueEur: row.revenue_eur
  }
}

/** Crée l'enregistrement économie d'un vol, une fois le nombre réel de passagers/fret connu (lu
 * depuis l'OFP SimBrief importé) — jamais au moment de la réservation, où seule la demande
 * *attendue* est connue (voir resolveFlightEconomy, injectée dans l'URL SimBrief pax/cargo). */
export function createFlightEconomy(input: FlightEconomyInput): void {
  const revenueEur =
    input.passengersSold !== null && input.cargoKgSold !== null
      ? input.passengersSold * input.ticketPriceEur * input.cabinRevenueMultiplier +
        input.cargoKgSold * input.cargoPriceEurPerKg
      : null

  getDb()
    .prepare(
      `INSERT INTO flight_economy
        (flight_id, ticket_price_eur, cargo_price_eur_per_kg, reference_ticket_price_eur,
         reference_cargo_price_eur_per_kg, cabin_revenue_multiplier, passengers_sold, cargo_kg_sold, revenue_eur)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.flightId,
      input.ticketPriceEur,
      input.cargoPriceEurPerKg,
      input.referenceTicketPriceEur,
      input.referenceCargoPriceEurPerKg,
      input.cabinRevenueMultiplier,
      input.passengersSold,
      input.cargoKgSold,
      revenueEur
    )
}

export function getFlightEconomy(flightId: number): FlightEconomy | null {
  const row = getDb().prepare('SELECT * FROM flight_economy WHERE flight_id = ?').get(flightId) as
    | FlightEconomyRow
    | undefined
  return row ? mapFlightEconomy(row) : null
}

function summarizeEconomy(pireps: PirepWithFlight[]): CompanyEconomySummary {
  let totalRevenueEur = 0
  let flightsWithData = 0
  const pirepsWithRevenue: PirepWithFlight[] = []

  for (const pirep of pireps) {
    const economy = getFlightEconomy(pirep.flightId)
    if (!economy || economy.revenueEur === null) continue
    totalRevenueEur += economy.revenueEur
    flightsWithData += 1
    pirepsWithRevenue.push(pirep)
  }

  const gsxCosts = getGsxCostStatsForFlights(
    pirepsWithRevenue.map((pirep) => ({
      departureIcao: pirep.flight.departureIcao,
      arrivalIcao: pirep.flight.arrivalIcao,
      scheduledDeparture: pirep.flight.scheduledDeparture,
      aircraft: pirep.flight.aircraft,
      referenceEndIso: pirep.engineStopTime
    }))
  )

  return {
    totalRevenueEur,
    totalCostEur: gsxCosts.totalEur,
    profitEur: totalRevenueEur - gsxCosts.totalEur,
    flightsWithData
  }
}

export function getCompanyEconomySummary(companyId: number): CompanyEconomySummary {
  return summarizeEconomy(getAllPireps().filter((pirep) => pirep.flight.companyId === companyId))
}

export function getAircraftEconomySummary(aircraftId: number): CompanyEconomySummary {
  return summarizeEconomy(getPirepsByAircraft(aircraftId))
}

/** Coût GSX moyen déjà observé sur une ligne précise (compagnie + aéroports), pour aider à fixer un
 * prix rentable sur la page Économie — null si la ligne n'a jamais été volée. */
export function getRouteGsxCostHint(
  companyId: number,
  departureIcao: string,
  arrivalIcao: string
): { averageGsxCostEur: number | null; flightsFlown: number } {
  const normalizedDeparture = departureIcao.trim().toUpperCase()
  const normalizedArrival = arrivalIcao.trim().toUpperCase()
  const pireps = getAllPireps().filter(
    (pirep) =>
      pirep.flight.companyId === companyId &&
      pirep.flight.departureIcao === normalizedDeparture &&
      pirep.flight.arrivalIcao === normalizedArrival
  )
  if (pireps.length === 0) return { averageGsxCostEur: null, flightsFlown: 0 }

  const gsxCosts = getGsxCostStatsForFlights(
    pireps.map((pirep) => ({
      departureIcao: pirep.flight.departureIcao,
      arrivalIcao: pirep.flight.arrivalIcao,
      scheduledDeparture: pirep.flight.scheduledDeparture,
      aircraft: pirep.flight.aircraft,
      referenceEndIso: pirep.engineStopTime
    }))
  )

  return {
    averageGsxCostEur: gsxCosts.flightsWithData > 0 ? gsxCosts.totalEur / gsxCosts.flightsWithData : null,
    flightsFlown: pireps.length
  }
}
