import { z } from 'zod'
import type { SimbriefOfp } from '@shared/types/simbrief'

/**
 * Structure du JSON retourné par l'API OFP fetcher de SimBrief, d'après la documentation
 * communautaire (non officiellement garantie/versionnée par SimBrief/Navigraph). `.passthrough()`
 * partout pour ne jamais faire planter le parsing sur un champ inconnu/nouveau.
 * À vérifier/ajuster contre un vrai compte SimBrief au premier test réel.
 */
const OfpResponseSchema = z
  .object({
    fetch: z
      .object({
        status: z.string().optional()
      })
      .passthrough()
      .optional(),
    general: z
      .object({
        icao_airline: z.string().optional(),
        flight_number: z.string().optional(),
        route: z.string().optional()
      })
      .passthrough()
      .optional(),
    origin: z
      .object({
        icao_code: z.string()
      })
      .passthrough(),
    destination: z
      .object({
        icao_code: z.string()
      })
      .passthrough(),
    alternate: z
      .object({
        icao_code: z.string().optional()
      })
      .passthrough()
      .optional(),
    aircraft: z
      .object({
        icaocode: z.string().optional()
      })
      .passthrough()
      .optional(),
    times: z
      .object({
        sched_out: z.union([z.string(), z.number()]),
        sched_in: z.union([z.string(), z.number()])
      })
      .passthrough()
  })
  .passthrough()

function unixToIso(value: string | number): string {
  const seconds = typeof value === 'string' ? Number(value) : value
  return new Date(seconds * 1000).toISOString()
}

export class SimbriefFetchError extends Error {}

export async function fetchLatestOfp(simbriefUserId: string): Promise<SimbriefOfp> {
  // Accepte aussi bien l'ID numérique SimBrief que le pseudo (pilot ID) choisi par l'utilisateur.
  const param = /^\d+$/.test(simbriefUserId.trim()) ? 'userid' : 'username'
  const url = `https://www.simbrief.com/api/xml.fetcher.php?${param}=${encodeURIComponent(simbriefUserId.trim())}&json=1`

  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new SimbriefFetchError(`Impossible de contacter SimBrief : ${(error as Error).message}`)
  }

  if (!response.ok) {
    throw new SimbriefFetchError(`SimBrief a répondu avec une erreur (HTTP ${response.status})`)
  }

  const json = await response.json()
  const parsed = OfpResponseSchema.safeParse(json)

  if (!parsed.success) {
    throw new SimbriefFetchError(
      'Aucun plan de vol trouvé pour cet ID SimBrief, ou format de réponse inattendu.'
    )
  }

  const { general, origin, destination, alternate, aircraft, times } = parsed.data

  return {
    icaoAirline: general?.icao_airline ?? null,
    flightNumberDigits: general?.flight_number ?? null,
    departureIcao: origin.icao_code,
    arrivalIcao: destination.icao_code,
    alternateIcao: alternate?.icao_code ?? null,
    scheduledDepartureUtc: unixToIso(times.sched_out),
    scheduledArrivalUtc: unixToIso(times.sched_in),
    route: general?.route ?? null,
    aircraftIcaoType: aircraft?.icaocode ?? null,
    rawJson: JSON.stringify(json)
  }
}
