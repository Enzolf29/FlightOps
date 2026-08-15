const EARTH_RADIUS_NM = 3440.065

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Distance orthodromique (grand cercle) entre deux points, en milles nautiques. */
export function greatCircleDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const rLat1 = toRadians(lat1)
  const rLat2 = toRadians(lat2)

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_NM * c
}

/**
 * Progression réelle du vol (0 à 1) basée sur la position GPS actuelle plutôt que sur l'horaire —
 * un vol retardé mais toujours au parking ne doit jamais afficher "à mi-chemin". Distance parcourue
 * depuis le départ, rapportée à la distance directe départ-arrivée (grand cercle, pas la route
 * réelle via balises, mais une approximation suffisante pour un repère visuel).
 */
export function computeFlightDistanceProgress(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  currentLat: number,
  currentLon: number
): number {
  const totalDistance = greatCircleDistanceNm(originLat, originLon, destLat, destLon)
  if (totalDistance <= 0) return 0

  const traveled = greatCircleDistanceNm(originLat, originLon, currentLat, currentLon)
  return Math.min(1, Math.max(0, traveled / totalDistance))
}
