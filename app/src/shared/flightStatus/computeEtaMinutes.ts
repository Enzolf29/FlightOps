import { greatCircleDistanceNm } from './computeFlightDistanceProgress'

/**
 * En dessous de cette vitesse sol (nœuds), une estimation temps-restant n'a pas de sens (division
 * par une vitesse quasi nulle donnerait un temps énorme/infini) — typiquement au sol ou à l'arrêt.
 */
const MIN_MEANINGFUL_GROUND_SPEED_KT = 20

/** Temps restant estimé (minutes) jusqu'à l'arrivée, basé sur la position et la vitesse actuelles. */
export function computeEtaMinutes(
  currentLat: number,
  currentLon: number,
  destLat: number,
  destLon: number,
  groundSpeedKt: number
): number | null {
  if (groundSpeedKt < MIN_MEANINGFUL_GROUND_SPEED_KT) return null

  const remainingNm = greatCircleDistanceNm(currentLat, currentLon, destLat, destLon)
  return (remainingNm / groundSpeedKt) * 60
}
