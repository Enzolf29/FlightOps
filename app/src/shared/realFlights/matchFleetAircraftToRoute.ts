import { guessIcaoTypeFromModelName } from '../aircraft/guessIcaoTypeFromModelName'
import type { AircraftWithStats } from '../types/aircraft'
import type { RealRoute } from '../types/realFlights'

export type FleetRouteMatch = 'positioned' | 'compatible' | 'incompatible'

function normalizeIcaoType(value: string | null): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  return /^[A-Z0-9]{4}$/.test(normalized) ? normalized : null
}

export function getFleetAircraftIcaoType(aircraft: AircraftWithStats): string | null {
  return normalizeIcaoType(aircraft.simbriefIcaoCode)
    ?? normalizeIcaoType(aircraft.type)
    ?? guessIcaoTypeFromModelName(aircraft.type)
}

export function getFleetRouteMatch(aircraft: AircraftWithStats, route: RealRoute): FleetRouteMatch {
  const fleetType = getFleetAircraftIcaoType(aircraft)
  if (!fleetType || !route.aircraft.some((item) => item.icaoType.trim().toUpperCase() === fleetType)) {
    return 'incompatible'
  }
  return aircraft.lastKnownIcao?.trim().toUpperCase() === route.departureIcao.trim().toUpperCase()
    ? 'positioned'
    : 'compatible'
}

export function rankFleetAircraftForRoute(aircraft: AircraftWithStats[], route: RealRoute): AircraftWithStats[] {
  const rank: Record<FleetRouteMatch, number> = { positioned: 0, compatible: 1, incompatible: 2 }
  return [...aircraft].sort((a, b) => {
    const matchDelta = rank[getFleetRouteMatch(a, route)] - rank[getFleetRouteMatch(b, route)]
    if (matchDelta !== 0) return matchDelta
    return (a.registration ?? a.type).localeCompare(b.registration ?? b.type)
  })
}
