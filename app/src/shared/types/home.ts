import type { PilotProfile } from './pilot'
import type { FlightWithRelations } from './flight'
import type { PirepWithFlight } from './pirep'

export interface HomeDashboard {
  pilot: PilotProfile
  currentFlight: FlightWithRelations | null
  nextFlight: FlightWithRelations | null
  upcomingFlights: FlightWithRelations[]
  recentPireps: PirepWithFlight[]
}
