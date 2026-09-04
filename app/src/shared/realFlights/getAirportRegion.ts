import { getAirportCoordinates } from '../airports/airportCoordinates'

export type AirportRegion = 'europe' | 'africa' | 'middle_east' | 'asia' | 'north_america' | 'south_america' | 'oceania' | 'other'

/** Classement géographique volontairement large, destiné au filtrage visuel du réseau connu. */
export function getAirportRegion(icao: string): AirportRegion {
  const coordinates = getAirportCoordinates(icao)
  if (!coordinates) return 'other'
  const { lat, lon } = coordinates

  if (lat >= 34 && lat <= 72 && lon >= -25 && lon <= 45) return 'europe'
  if (lat >= 12 && lat <= 43 && lon > 25 && lon <= 65) return 'middle_east'
  if (lat >= -38 && lat < 37 && lon >= -20 && lon <= 55) return 'africa'
  if (lat >= 5 && lat <= 84 && lon >= -170 && lon <= -50) return 'north_america'
  if (lat >= -60 && lat < 15 && lon >= -92 && lon <= -30) return 'south_america'
  if (lat >= -50 && lat <= 5 && lon >= 105 && lon <= 180) return 'oceania'
  if (lat >= -10 && lat <= 80 && lon > 45 && lon <= 180) return 'asia'
  return 'other'
}
