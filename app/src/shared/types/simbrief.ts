export interface SimbriefOfp {
  /** Code compagnie tel que renseigné dans SimBrief (souvent ICAO, ex. "AFR") — à recouper avec nos compagnies. */
  icaoAirline: string | null
  /** Numéro de vol brut (chiffres uniquement), ex. "1445". */
  flightNumberDigits: string | null
  departureIcao: string
  arrivalIcao: string
  alternateIcao: string | null
  scheduledDepartureUtc: string
  scheduledArrivalUtc: string
  route: string | null
  aircraftIcaoType: string | null
  /** OFP complet tel que reçu, conservé pour référence/debug. */
  rawJson: string
}
