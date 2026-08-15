import type { AppSettings } from '../types/settings'
import type { HomeDashboard } from '../types/home'
import type { Company, CompanyPatch } from '../types/company'
import type { Aircraft, AircraftInput, AircraftPatch, AircraftWithStats } from '../types/aircraft'
import type { SimbriefOfp } from '../types/simbrief'
import type { AdsbdbAircraftLookup } from '../types/adsbdb'
import type { RealRoute, RealRouteSearchResult } from '../types/realFlights'
import type { CreateFlightFromOfpInput } from '../types/booking'
import type { FlightWithRelations } from '../types/flight'
import type { PirepApproachProfilePoint, PirepFlightPathPoint, PirepWithFlight } from '../types/pirep'
import type { SimConnectStatus, SimTelemetry } from '../types/simconnect'
import type { StatisticsOverview } from '../types/statistics'
import type { FlightEvent } from '../flightStatus/evaluateFlightEvents'

export interface FlightopsApi {
  home: {
    getDashboard: () => Promise<HomeDashboard>
  }
  fleet: {
    companies: {
      list: () => Promise<Company[]>
      update: (id: number, patch: CompanyPatch) => Promise<Company>
    }
    aircraft: {
      list: (companyId?: number) => Promise<AircraftWithStats[]>
      create: (input: AircraftInput) => Promise<Aircraft>
      update: (id: number, patch: AircraftPatch) => Promise<Aircraft>
      delete: (id: number) => Promise<void>
    }
  }
  pilot: {
    getSimbriefUserId: () => Promise<string | null>
    setSimbriefUserId: (simbriefUserId: string | null) => Promise<string | null>
    getAerodataboxApiKey: () => Promise<string | null>
    setAerodataboxApiKey: (apiKey: string | null) => Promise<string | null>
  }
  simbrief: {
    fetchLatestOfp: () => Promise<SimbriefOfp>
  }
  adsbdb: {
    lookupByRegistration: (registration: string) => Promise<AdsbdbAircraftLookup>
  }
  realFlights: {
    searchRoutes: (companyId: number, departureIcao: string, forceRefresh?: boolean) => Promise<RealRouteSearchResult>
    suggestFlightNumber: (routeId: number) => Promise<string | null>
    listKnownRoutes: (companyId: number) => Promise<RealRoute[]>
  }
  booking: {
    createFromOfp: (input: CreateFlightFromOfpInput) => Promise<FlightWithRelations>
  }
  pireps: {
    list: () => Promise<PirepWithFlight[]>
    listByAircraft: (aircraftId: number) => Promise<PirepWithFlight[]>
    getById: (id: number) => Promise<PirepWithFlight | null>
    getFlightPath: (id: number) => Promise<PirepFlightPathPoint[]>
    getApproachProfile: (id: number) => Promise<PirepApproachProfilePoint[]>
    getEvents: (id: number) => Promise<FlightEvent[]>
  }
  flights: {
    list: () => Promise<FlightWithRelations[]>
    cancel: (id: number) => Promise<FlightWithRelations>
    delete: (id: number) => Promise<void>
    getOfpJson: (id: number) => Promise<string | null>
  }
  simconnect: {
    getStatus: () => Promise<SimConnectStatus>
    onStatusChange: (listener: (status: SimConnectStatus) => void) => () => void
    onTelemetry: (listener: (telemetry: SimTelemetry) => void) => () => void
    armFlight: (flightId: number) => Promise<void>
    disarmFlight: () => Promise<void>
    getArmedFlightId: () => Promise<number | null>
    getActualDepartureIso: () => Promise<string | null>
    getLiveFlightPath: () => Promise<PirepFlightPathPoint[]>
    completeManually: () => Promise<void>
    getMetar: (icaoCode: string) => Promise<string>
    getFlightEvents: () => Promise<FlightEvent[]>
    onFlightEvent: (listener: (event: FlightEvent) => void) => () => void
  }
  stats: {
    getOverview: () => Promise<StatisticsOverview>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<AppSettings>
  }
  app: {
    openExternal: (url: string) => Promise<void>
    deleteAllData: () => Promise<boolean>
  }
}
