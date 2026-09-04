import type { FlightEvent } from '../flightStatus/evaluateFlightEvents'
import type { CabinAnnouncementType } from './cabinAnnouncements'
import type { FlightWithRelations } from './flight'
import type { CabinLoadsheetSnapshot, LoadsheetComparisonRow } from './loadsheet'
import type { PirepFlightPathPoint } from './pirep'
import type { SimConnectStatus, SimTelemetry } from './simconnect'

export interface TabletServerInfo {
  running: boolean
  port: number | null
  pin: string
  /** Adresse HTTPS de la véritable PWA, après installation du certificat local. */
  urls: string[]
  /** Page HTTP utilisée une seule fois pour installer le certificat sur la tablette. */
  setupUrls: string[]
  certificateFingerprint: string | null
  connectedClients: number
}

export interface TabletCabinPlayback {
  type: CabinAnnouncementType
  origin: 'automatic' | 'manual'
}

export interface TabletCabinStatus {
  company: {
    id: number
    icaoCode: string
    displayName: string
  } | null
  automationReady: boolean
  gsxDetected: boolean
  activeVoice: TabletCabinPlayback | null
  activeMusic: TabletCabinPlayback | null
  queuedTypes: CabinAnnouncementType[]
  availableTypes: CabinAnnouncementType[]
  boardingCompleted: boolean
  finalLoadsheet: CabinLoadsheetSnapshot | null
}

export type TabletCabinCommand =
  | { action: 'play'; type: CabinAnnouncementType }
  | { action: 'stop'; type: CabinAnnouncementType }
  | { action: 'stop_all' }

export interface TabletAverageWind {
  dirDegrees: number
  speedKt: number
}

export interface TabletOfpSummary {
  route: string | null
  sidIdent: string | null
  starIdent: string | null
  departureRunway: string | null
  arrivalRunway: string | null
  cruiseAltitudeFeet: number | null
  costIndex: number | null
  distanceNm: number | null
  isaDeviationCelsius: number | null
  climbAvgWind: TabletAverageWind | null
  cruiseAvgWind: TabletAverageWind | null
  descentAvgWind: TabletAverageWind | null
  routePath: Array<{ lat: number; lon: number }>
  alternateIcao: string | null
  alternateRoute: string | null
  alternateCruiseAltitudeFeet: number | null
  alternateDistanceNm: number | null
  alternateEteMinutes: number | null
}

export interface TabletLoadsheet {
  isFinal: boolean
  capturedAt: string | null
  rows: LoadsheetComparisonRow[]
}

export interface TabletCalendarFlight {
  flight: FlightWithRelations
  briefing: TabletOfpSummary | null
}

export interface TabletSnapshot {
  generatedAt: string
  simconnectStatus: SimConnectStatus
  armedFlightId: number | null
  flight: FlightWithRelations | null
  availableFlights: FlightWithRelations[]
  calendarFlights: TabletCalendarFlight[]
  telemetry: SimTelemetry | null
  events: FlightEvent[]
  path: PirepFlightPathPoint[]
  cabin: TabletCabinStatus
  ofp: TabletOfpSummary | null
  loadsheet: TabletLoadsheet | null
}
