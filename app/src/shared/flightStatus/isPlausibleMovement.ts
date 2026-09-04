import { greatCircleDistanceNm } from './computeFlightDistanceProgress'

export interface MovementPoint {
  latitude: number
  longitude: number
  groundVelocity: number
  onGround: boolean
  simZuluIso: string
}

/** Rejette les téléportations courtes de GSX et les sauts de position impossibles. */
export function isPlausibleMovement(previous: MovementPoint | null, current: MovementPoint): boolean {
  if (!previous) return true
  const elapsedSeconds = Math.max(
    0.1,
    (new Date(current.simZuluIso).getTime() - new Date(previous.simZuluIso).getTime()) / 1000
  )
  const distanceNm = greatCircleDistanceNm(previous.latitude, previous.longitude, current.latitude, current.longitude)
  const maximumNm = Math.max(
    current.onGround ? 0.08 : 0.25,
    (Math.max(previous.groundVelocity, current.groundVelocity) * elapsedSeconds * 4) / 3600
  )
  return distanceNm <= maximumNm
}
