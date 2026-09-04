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
  getKnownDepartureAirports,
  getRouteById,
  upsertRouteFromApi,
  type RealRouteObservationInput
} from '../db/repositories/realRoutesRepository'
import { getAirportDepartures, type AerodataboxDeparture } from '../aerodatabox/aerodataboxClient'
import { lookupAircraftByRegistration } from '../adsbdb/adsbdbClient'

const MAX_COMPANY_REFRESH_AIRPORTS = 5

function makeObservation(departure: AerodataboxDeparture): RealRouteObservationInput {
  const observedAt = departure.scheduledDepartureUtc ?? departure.scheduledArrivalUtc ?? new Date().toISOString()
  const identity = departure.flightNumber ?? departure.callSign ?? departure.aircraftRegistration ?? 'vol-inconnu'
  return {
    key: `${identity}|${departure.arrivalIcao ?? '----'}|${observedAt}`,
    aircraftIcaoType: departure.aircraftIcaoType,
    observedAt
  }
}

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
    return {
      routes: cached,
      fetchedFromApi: false,
      refreshedAirports: []
    }
  }

  const apiKey = getPilot().aerodatabox_api_key
  if (!apiKey) {
    if (cached.length > 0) {
      return { routes: cached, fetchedFromApi: false, refreshedAirports: [] }
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
    observations: RealRouteObservationInput[]
  }

  const byArrival = new Map<string, RouteAccumulator>()
  for (const departure of companyDepartures) {
    if (!departure.arrivalIcao) continue
    const entry: RouteAccumulator =
      byArrival.get(departure.arrivalIcao) ?? {
        aircraft: new Map(),
        durations: [],
        flightNumbers: new Set(),
        observations: []
      }
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
    entry.observations.push(makeObservation(departure))
    byArrival.set(departure.arrivalIcao, entry)
  }

  for (const [arrivalIcao, entry] of byArrival) {
    const aircraft = [...entry.aircraft.entries()].map(([icaoType, typeDescription]) => ({ icaoType, typeDescription }))
    const typicalDurationMinutes =
      entry.durations.length > 0 ? entry.durations.reduce((sum, value) => sum + value, 0) / entry.durations.length : null

    const routeId = upsertRouteFromApi(
      companyId,
      normalizedDep,
      arrivalIcao,
      aircraft,
      typicalDurationMinutes,
      entry.observations
    )
    for (const digits of entry.flightNumbers) {
      addFlightNumberObservation(routeId, digits)
    }
    ensureReciprocalRoute(companyId, arrivalIcao, normalizedDep, aircraft, typicalDurationMinutes, entry.observations)
  }

  return {
    routes: getCachedRoutes(companyId, normalizedDep),
    fetchedFromApi: true,
    refreshedAirports: [normalizedDep]
  }
}

async function refreshCompanyRoutes(companyId: number): Promise<RealRouteSearchResult> {
  const company = getCompanyById(companyId)
  if (!company) throw new Error('Compagnie introuvable.')
  const knownAirports = getKnownDepartureAirports(companyId)
  if (knownAirports.length === 0) {
    return {
      routes: getAllRoutesForCompany(companyId),
      fetchedFromApi: false,
      refreshedAirports: []
    }
  }

  // Aucun cooldown : chaque clic interroge immédiatement l'API. La requête compagnie reste
  // limitée à cinq aéroports et le dépôt les classe du cache le plus ancien au plus récent ; des
  // clics successifs font donc tourner progressivement l'ensemble du réseau connu.
  const eligible = knownAirports.slice(0, MAX_COMPANY_REFRESH_AIRPORTS)

  const refreshedAirports: string[] = []
  for (const airport of eligible) {
    const result = await searchRealRoutes(companyId, airport.icao, true)
    refreshedAirports.push(...result.refreshedAirports)
  }

  return {
    routes: getAllRoutesForCompany(companyId),
    fetchedFromApi: refreshedAirports.length > 0,
    refreshedAirports
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
  ipcMain.handle(IPC.realFlights.refreshCompanyRoutes, (_event, companyId: number) => refreshCompanyRoutes(companyId))
}
