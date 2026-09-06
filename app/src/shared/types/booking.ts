import type { FlightSource } from './flight'

export interface CreateFlightFromOfpInput {
  companyId: number
  aircraftId: number | null
  flightNumberDigits: string
  callsign: string
  departureIcao: string
  arrivalIcao: string
  alternateIcao: string | null
  scheduledDepartureUtc: string
  scheduledArrivalUtc: string
  route: string | null
  simbriefOfpJson: string | null
  source: FlightSource
}
