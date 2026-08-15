import { z } from 'zod'
import type { AdsbdbAircraftLookup } from '@shared/types/adsbdb'
import { describeAircraftType } from '@shared/aircraft/describeAircraftType'

/**
 * Réponse de https://api.adsbdb.com/v0/aircraft/{registration}, d'après un appel réel de
 * référence. `.passthrough()` pour ne jamais faire planter le parsing sur un champ inconnu/nouveau.
 */
const AircraftSchema = z
  .object({
    type: z.string().nullable().optional(),
    icao_type: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    mode_s: z.string().nullable().optional(),
    registration: z.string().nullable().optional(),
    registered_owner_country_name: z.string().nullable().optional(),
    registered_owner_operator_flag_code: z.string().nullable().optional(),
    registered_owner: z.string().nullable().optional()
  })
  .passthrough()

const SuccessResponseSchema = z
  .object({
    response: z.object({ aircraft: AircraftSchema }).passthrough()
  })
  .passthrough()

export class AdsbdbLookupError extends Error {}

export async function lookupAircraftByRegistration(registration: string): Promise<AdsbdbAircraftLookup> {
  const normalized = registration.trim().toUpperCase()
  if (!normalized) {
    throw new AdsbdbLookupError('Merci de saisir une immatriculation.')
  }

  const url = `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(normalized)}`

  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new AdsbdbLookupError(`Impossible de contacter adsbdb : ${(error as Error).message}`)
  }

  if (response.status === 404) {
    throw new AdsbdbLookupError(`Aucun avion trouvé pour l'immatriculation ${normalized}.`)
  }
  if (!response.ok) {
    throw new AdsbdbLookupError(`adsbdb a répondu avec une erreur (HTTP ${response.status})`)
  }

  const json = await response.json()
  const parsed = SuccessResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new AdsbdbLookupError(`Aucun avion trouvé pour l'immatriculation ${normalized}.`)
  }

  const { aircraft } = parsed.data.response
  const icaoType = aircraft.icao_type?.trim().toUpperCase() || null

  return {
    registration: aircraft.registration?.trim().toUpperCase() || normalized,
    icaoType,
    typeDescription: describeAircraftType(icaoType, aircraft.type ?? null),
    manufacturer: aircraft.manufacturer?.trim() || null,
    modeS: aircraft.mode_s?.trim().toUpperCase() || null,
    registeredOwner: aircraft.registered_owner?.trim() || null,
    registeredOwnerIcaoCode: aircraft.registered_owner_operator_flag_code?.trim().toUpperCase() || null,
    registeredOwnerCountry: aircraft.registered_owner_country_name?.trim() || null
  }
}
