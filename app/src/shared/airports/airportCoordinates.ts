import rawCoordinates from './airportCoordinates.json'

/**
 * Coordonnées [latitude, longitude] par code OACI, extraites hors-ligne du jeu de données public
 * OurAirports (CC0), filtré aux aéroports avec service programmé ou code IATA. ~8400 aéroports,
 * couvre en pratique tout aéroport commercial qu'une recherche de vols réels peut renvoyer —
 * pas d'appel réseau, donc pas de dépendance à la fiabilité d'un endpoint externe pour la carte.
 */
const AIRPORT_COORDINATES = rawCoordinates as unknown as Record<string, [number, number]>

export interface AirportLatLon {
  lat: number
  lon: number
}

export function getAirportCoordinates(icaoCode: string): AirportLatLon | null {
  const entry = AIRPORT_COORDINATES[icaoCode.trim().toUpperCase()]
  return entry ? { lat: entry[0], lon: entry[1] } : null
}
