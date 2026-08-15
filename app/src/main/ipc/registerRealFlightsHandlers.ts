import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { RealRoute, RealRouteSearchResult } from '@shared/types/realFlights'
import { extractFlightNumberFromCallsign } from '@shared/aviation/extractFlightNumberFromCallsign'
import { describeAircraftType } from '@shared/aircraft/describeAircraftType'
import { getCompanyById } from '../db/repositories/companyRepository'
import { getPilot } from '../db/repositories/pilotRepository'
import {
  addFlightNumberObservation,
  ensureReciprocalRoute,
  getAllRoutesForCompany,
  getCachedRoutes,
  getFlightNumbersForRoute,
  getRouteById,
  upsertRouteFromApi
} from '../db/repositories/realRoutesRepository'
import { getAirportDepartures, type AerodataboxDeparture } from '../aerodatabox/aerodataboxClient'
import { lookupAircraftByRegistration } from '../adsbdb/adsbdbClient'

/**
 * AeroDataBox donne parfois un modèle trop vague pour être rattaché à un code OACI précis
 * (ex. "Boeing 777" sans variante) — dans ce cas, on précise via adsbdb en cherchant l'avion par
 * son immatriculation (déjà fourni par AeroDataBox). Une immatriculation n'est interrogée qu'une
 * fois même si elle apparaît sur plusieurs vols de la recherche.
 */
async function resolveAmbiguousAircraftTypes(departures: AerodataboxDeparture[]): Promise<void> {
  const resolved = new Map<string, string | null>()

  for (const departure of departures) {
    if (departure.aircraftIcaoType || !departure.aircraftRegistration) continue
    const registration = departure.aircraftRegistration

    if (!resolved.has(registration)) {
      try {
        const lookup = await lookupAircraftByRegistration(registration)
        resolved.set(registration, lookup.icaoType)
      } catch {
        resolved.set(registration, null)
      }
    }

    const icaoType = resolved.get(registration) ?? null
    if (icaoType) {
      departure.aircraftIcaoType = icaoType
      departure.aircraftTypeDescription = describeAircraftType(icaoType, departure.aircraftTypeDescription)
    }
  }
}

async function searchRealRoutes(
  companyId: number,
  departureIcao: string,
  forceRefresh: boolean
): Promise<RealRouteSearchResult> {
  const company = getCompanyById(companyId)
  if (!company) {
    throw new Error('Compagnie introuvable.')
  }

  const normalizedDep = departureIcao.trim().toUpperCase()
  const cached = getCachedRoutes(companyId, normalizedDep)
  const hasApiCache = cached.some((route) => route.source === 'api')

  if (hasApiCache && !forceRefresh) {
    return { routes: cached, fetchedFromApi: false }
  }

  const apiKey = getPilot().aerodatabox_api_key
  if (!apiKey) {
    if (cached.length > 0) {
      return { routes: cached, fetchedFromApi: false }
    }
    throw new Error("Aucune clé API AeroDataBox configurée (Paramètres) et aucune donnée en cache pour cet aéroport.")
  }

  const departures = await getAirportDepartures(apiKey, normalizedDep)
  const companyDepartures = departures.filter((item) => item.airlineIcao === company.icaoCode)
  await resolveAmbiguousAircraftTypes(companyDepartures)

  interface RouteAccumulator {
    aircraft: Map<string, string>
    durations: number[]
    flightNumbers: Set<string>
  }

  const byArrival = new Map<string, RouteAccumulator>()
  for (const departure of companyDepartures) {
    if (!departure.arrivalIcao) continue
    const entry: RouteAccumulator =
      byArrival.get(departure.arrivalIcao) ?? { aircraft: new Map(), durations: [], flightNumbers: new Set() }
    if (departure.aircraftTypeDescription) {
      entry.aircraft.set(departure.aircraftIcaoType ?? departure.aircraftTypeDescription, departure.aircraftTypeDescription)
    }
    if (departure.scheduledDepartureUtc && departure.scheduledArrivalUtc) {
      const minutes = (Date.parse(departure.scheduledArrivalUtc) - Date.parse(departure.scheduledDepartureUtc)) / 60000
      if (minutes > 0) entry.durations.push(minutes)
    }
    // Le numéro de vol AeroDataBox est généralement au format IATA (ex. "AF1445") : on n'en garde
    // que le suffixe, cohérent avec CreateFlightFromOfpInput.flightNumberDigits.
    if (departure.flightNumber) {
      const digits = extractFlightNumberFromCallsign(departure.flightNumber, company.iataCode)
      if (digits) entry.flightNumbers.add(digits)
    }
    byArrival.set(departure.arrivalIcao, entry)
  }

  for (const [arrivalIcao, entry] of byArrival) {
    const aircraft = [...entry.aircraft.entries()].map(([icaoType, typeDescription]) => ({ icaoType, typeDescription }))
    const typicalDurationMinutes =
      entry.durations.length > 0 ? entry.durations.reduce((sum, value) => sum + value, 0) / entry.durations.length : null

    const routeId = upsertRouteFromApi(companyId, normalizedDep, arrivalIcao, aircraft, typicalDurationMinutes)
    for (const digits of entry.flightNumbers) {
      addFlightNumberObservation(routeId, digits)
    }
    ensureReciprocalRoute(companyId, arrivalIcao, normalizedDep, aircraft, typicalDurationMinutes)
  }

  return {
    routes: getCachedRoutes(companyId, normalizedDep),
    fetchedFromApi: true
  }
}

function suggestFlightNumber(routeId: number): string | null {
  const route = getRouteById(routeId)
  if (!route) return null
  return getFlightNumbersForRoute(routeId)[0] ?? null
}

function listKnownRoutes(companyId: number): RealRoute[] {
  return getAllRoutesForCompany(companyId)
}

export function registerRealFlightsHandlers(): void {
  ipcMain.handle(IPC.realFlights.searchRoutes, (_event, companyId: number, departureIcao: string, forceRefresh?: boolean) =>
    searchRealRoutes(companyId, departureIcao, forceRefresh ?? false)
  )

  ipcMain.handle(IPC.realFlights.suggestFlightNumber, (_event, routeId: number) => suggestFlightNumber(routeId))

  ipcMain.handle(IPC.realFlights.listKnownRoutes, (_event, companyId: number) => listKnownRoutes(companyId))
}
