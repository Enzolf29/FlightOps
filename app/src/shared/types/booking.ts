import type { FlightSource } from './flight'

export interface CreateFlightFromOfpEconomyInput {
  ticketPriceEur: number
  cargoPriceEurPerKg: number
  referenceTicketPriceEur: number
  referenceCargoPriceEurPerKg: number
}

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
  /** Prix résolus au moment de la réservation (voir resolveFlightEconomy) — présent seulement si le
   * mode économie était actif pour ce vol. Le nombre réel de passagers/fret est relu depuis l'OFP
   * importé (simbriefOfpJson), pas depuis cette valeur. */
  economy?: CreateFlightFromOfpEconomyInput | null
}
