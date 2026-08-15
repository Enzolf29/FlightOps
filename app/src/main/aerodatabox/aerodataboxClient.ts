import { z } from 'zod'
import { describeAircraftType } from '@shared/aircraft/describeAircraftType'
import { guessIcaoTypeFromModelName } from '@shared/aircraft/guessIcaoTypeFromModelName'

/**
 * Structure de la réponse AeroDataBox "Flights by Airport" (RapidAPI), d'après la documentation
 * publique (non testée avec une vraie clé au moment de l'écriture). `.passthrough()` partout et
 * tous les champs optionnels/nullable pour ne jamais faire planter le parsing sur un champ
 * inconnu/manquant. À vérifier/ajuster contre un vrai compte AeroDataBox au premier test réel.
 */
const AirportRefSchema = z
  .object({
    icao: z.string().nullable().optional(),
    iata: z.string().nullable().optional()
  })
  .passthrough()

const ScheduledTimeSchema = z
  .object({
    utc: z.string().nullable().optional(),
    local: z.string().nullable().optional()
  })
  .passthrough()

const FlightLegSchema = z
  .object({
    airport: AirportRefSchema.optional(),
    scheduledTime: ScheduledTimeSchema.optional()
  })
  .passthrough()

const FlightItemSchema = z
  .object({
    number: z.string().nullable().optional(),
    callSign: z.string().nullable().optional(),
    departure: FlightLegSchema.optional(),
    arrival: FlightLegSchema.optional(),
    aircraft: z
      .object({
        model: z.string().nullable().optional(),
        reg: z.string().nullable().optional(),
        modeS: z.string().nullable().optional()
      })
      .passthrough()
      .optional(),
    airline: z
      .object({
        name: z.string().nullable().optional(),
        iata: z.string().nullable().optional(),
        icao: z.string().nullable().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough()

const ScheduleResponseSchema = z
  .object({
    departures: z.array(FlightItemSchema).optional()
  })
  .passthrough()

export class AerodataboxFetchError extends Error {}

export interface AerodataboxDeparture {
  flightNumber: string | null
  callSign: string | null
  airlineIcao: string | null
  arrivalIcao: string | null
  aircraftIcaoType: string | null
  aircraftTypeDescription: string | null
  /** Immatriculation de l'avion observé, utile pour affiner le type via adsbdb quand le modèle AeroDataBox est trop vague (ex. "Boeing 777" sans variante). */
  aircraftRegistration: string | null
  scheduledDepartureUtc: string | null
  scheduledArrivalUtc: string | null
}

function toLocalWindow(fromDate: Date, hours: number): string {
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000).toISOString().slice(0, 16)
}

/**
 * Récupère les départs programmés d'un aéroport sur une fenêtre de 12h à partir de maintenant.
 * AeroDataBox limite généralement les requêtes "flights by airport" à une fenêtre de 12h par
 * appel sur les offres standards ; les résultats sont mis en cache côté FlightOps (voir
 * realRoutesRepository) pour ne pas avoir à réinterroger l'API à chaque recherche.
 */
export async function getAirportDepartures(apiKey: string, departureIcao: string): Promise<AerodataboxDeparture[]> {
  const normalized = departureIcao.trim().toUpperCase()
  const now = new Date()
  const fromLocal = toLocalWindow(now, 0)
  const toLocal = toLocalWindow(now, 12)

  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${encodeURIComponent(normalized)}/${fromLocal}/${toLocal}` +
    '?withLeg=true&direction=Departure&withCancelled=false&withCodeshared=true&withCargo=false&withPrivate=false'

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      }
    })
  } catch (error) {
    throw new AerodataboxFetchError(`Impossible de contacter AeroDataBox : ${(error as Error).message}`)
  }

  if (response.status === 401 || response.status === 403) {
    throw new AerodataboxFetchError('Clé API AeroDataBox invalide ou manquante.')
  }
  if (response.status === 404) {
    throw new AerodataboxFetchError(`Aucun horaire trouvé pour l'aéroport ${normalized}.`)
  }
  if (!response.ok) {
    throw new AerodataboxFetchError(`AeroDataBox a répondu avec une erreur (HTTP ${response.status})`)
  }

  const json = await response.json()
  const parsed = ScheduleResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new AerodataboxFetchError('Réponse AeroDataBox inattendue.')
  }

  return (parsed.data.departures ?? []).map((item) => {
    const rawModel = item.aircraft?.model?.trim() ?? null
    const modelCandidate = rawModel?.toUpperCase() ?? null
    // AeroDataBox renvoie tantôt un code OACI brut (4 caractères), tantôt un nom descriptif
    // (ex. "Airbus A220-300") : on tente d'abord le code brut, sinon on le devine depuis le texte.
    const icaoType =
      modelCandidate && /^[A-Z0-9]{4}$/.test(modelCandidate)
        ? modelCandidate
        : rawModel
          ? guessIcaoTypeFromModelName(rawModel)
          : null

    return {
      flightNumber: item.number?.trim() || null,
      callSign: item.callSign?.trim() || null,
      airlineIcao: item.airline?.icao?.trim().toUpperCase() || null,
      arrivalIcao: item.arrival?.airport?.icao?.trim().toUpperCase() || null,
      aircraftIcaoType: icaoType,
      aircraftTypeDescription: describeAircraftType(icaoType, item.aircraft?.model ?? null),
      aircraftRegistration: item.aircraft?.reg?.trim().toUpperCase() || null,
      scheduledDepartureUtc: item.departure?.scheduledTime?.utc ?? null,
      scheduledArrivalUtc: item.arrival?.scheduledTime?.utc ?? null
    }
  })
}
