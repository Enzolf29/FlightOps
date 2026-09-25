import { greatCircleDistanceNm } from './computeFlightDistanceProgress'

export const EARTH_CIRCUMFERENCE_NM = 21639

interface LatLon {
  lat: number
  lon: number
}

/**
 * Distance réellement parcourue : somme de la trace enregistrée, à défaut le grand cercle entre
 * les deux aéroports. Renvoie 0 si aucune des deux n'est exploitable.
 */
export function computePirepDistanceNm(
  flightPathJson: string | null,
  departure: LatLon | null,
  arrival: LatLon | null
): number {
  let distance = 0
  if (flightPathJson) {
    try {
      const path = JSON.parse(flightPathJson) as LatLon[]
      for (let index = 1; index < path.length; index += 1) {
        distance += greatCircleDistanceNm(path[index - 1].lat, path[index - 1].lon, path[index].lat, path[index].lon)
      }
    } catch {
      distance = 0
    }
  }
  if (!(distance > 0) && departure && arrival) {
    distance = greatCircleDistanceNm(departure.lat, departure.lon, arrival.lat, arrival.lon)
  }
  return distance > 0 && Number.isFinite(distance) ? distance : 0
}

/**
 * Carburant réellement brûlé (kg) : démarrage moteurs → arrêt moteurs, ce qui exclut le carburant
 * embarqué mais non utilisé. À défaut d'arrêt moteurs enregistré, on s'arrête à l'atterrissage.
 */
export function computeFuelBurnedKg(
  fuelAtEngineStartKg: number | null,
  fuelAtEngineStopKg: number | null,
  fuelAtTouchdownKg: number | null
): number {
  const end = fuelAtEngineStopKg ?? fuelAtTouchdownKg
  if (fuelAtEngineStartKg === null || end === null) return 0
  const burned = fuelAtEngineStartKg - end
  return burned > 0 && Number.isFinite(burned) ? burned : 0
}
