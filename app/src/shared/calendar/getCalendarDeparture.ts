import type { FlightWithRelations } from '../types/flight'

/**
 * Les vols à venir restent classés selon le planning. Pour un vol terminé, le départ réellement
 * observé est plus fiable : il conserve notamment le bon jour lorsqu'un vol traverse minuit.
 */
export function getCalendarDeparture(
  flight: FlightWithRelations,
  actualDepartureTime?: string | null
): string {
  return flight.status === 'completed' && actualDepartureTime
    ? actualDepartureTime
    : flight.scheduledDeparture
}
