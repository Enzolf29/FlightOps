import { describeAircraftType } from '../aircraft/describeAircraftType'
import { guessIcaoTypeFromModelName } from '../aircraft/guessIcaoTypeFromModelName'

export interface NormalizedRealFlightAircraftFamily {
  icaoType: string
  typeDescription: string
}

const E170_FAMILY = new Set(['E170', 'E175', 'E75L', 'E75S'])
const E190_FAMILY = new Set(['E190', 'E195', 'E290', 'E295'])

function normalizeText(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[-_‐-―]/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Regroupe les variantes commerciales Embraer qui produisaient plusieurs filtres visuellement
 * identiques. Le réseau réel est recherché par famille exploitable : E170 inclut E170/E175, et
 * E190 inclut E190/E195 ainsi que leurs variantes E2.
 */
export function normalizeRealFlightAircraftFamily(
  icaoType: string | null,
  typeDescription: string | null = null
): NormalizedRealFlightAircraftFamily | null {
  const rawType = icaoType?.trim() ?? ''
  const rawDescription = typeDescription?.trim() ?? ''
  if (!rawType && !rawDescription) return null

  const normalizedType = normalizeText(rawType)
  const combined = normalizeText(`${rawType} ${rawDescription}`)
  const inferredType =
    (/^[A-Z0-9]{4}$/.test(normalizedType) ? normalizedType : null) ??
    guessIcaoTypeFromModelName(rawType) ??
    guessIcaoTypeFromModelName(rawDescription)

  if (
    (inferredType && E170_FAMILY.has(inferredType)) ||
    /(?:^|\s)(?:EMBRAER|ERJ|E)?\s*17[05](?:\s|$)/.test(combined)
  ) {
    return { icaoType: 'E170', typeDescription: 'Embraer 170' }
  }

  if (
    (inferredType && E190_FAMILY.has(inferredType)) ||
    /(?:^|\s)(?:EMBRAER|ERJ|E)?\s*19[05](?:\s|$)/.test(combined)
  ) {
    return { icaoType: 'E190', typeDescription: 'Embraer 190' }
  }

  const resolvedType = inferredType ?? (normalizedType || normalizeText(rawDescription))
  return {
    icaoType: resolvedType,
    typeDescription: describeAircraftType(inferredType, rawDescription || rawType)
  }
}
