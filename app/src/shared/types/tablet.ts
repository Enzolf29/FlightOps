import type { FlightEvent } from '../flightStatus/evaluateFlightEvents'
import type { CabinAnnouncementType } from './cabinAnnouncements'
import type { FlightWithRelations } from './flight'
import type { PirepFlightPathPoint } from './pirep'
import type { SimConnectStatus, SimTelemetry } from './simconnect'

export interface TabletServerInfo {
  running: boolean
  port: number | null
  pin: string
  urls: string[]
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
}

export type TabletCabinCommand =
  | { action: 'play'; type: CabinAnnouncementType }
  | { action: 'stop'; type: CabinAnnouncementType }
  | { action: 'stop_all' }

export interface TabletSnapshot {
  generatedAt: string
  simconnectStatus: SimConnectStatus
  armedFlightId: number | null
  flight: FlightWithRelations | null
  availableFlights: FlightWithRelations[]
  telemetry: SimTelemetry | null
  events: FlightEvent[]
  path: PirepFlightPathPoint[]
  cabin: TabletCabinStatus
}
