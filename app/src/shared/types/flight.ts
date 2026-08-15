export type FlightStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
export type FlightSource = 'manual' | 'simbrief' | 'real_world_api'

export interface Flight {
  id: number
  companyId: number
  aircraftId: number | null
  flightNumber: string
  callsign: string
  callsignDisplay: string
  departureIcao: string
  arrivalIcao: string
  scheduledDeparture: string
  scheduledArrival: string
  status: FlightStatus
  source: FlightSource
  route: string | null
  alternateIcao: string | null
}

export interface FlightCompanySummary {
  icaoCode: string
  displayName: string
  logoFilename: string
}

export interface FlightAircraftSummary {
  type: string
  registration: string | null
}

export interface FlightWithRelations extends Flight {
  company: FlightCompanySummary
  aircraft: FlightAircraftSummary | null
}
