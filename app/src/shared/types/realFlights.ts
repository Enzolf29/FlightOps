export interface RealRouteAircraft {
  icaoType: string
  typeDescription: string
  observationCount: number
}

export type RealRouteSource = 'api' | 'reciprocal'

export interface RealRoute {
  id: number
  companyId: number
  departureIcao: string
  arrivalIcao: string
  source: RealRouteSource
  typicalDurationMinutes: number | null
  lastFetchedAt: string | null
  lastObservedAt: string | null
  observationCount: number
  aircraft: RealRouteAircraft[]
}

export interface RealRouteSearchResult {
  routes: RealRoute[]
  fetchedFromApi: boolean
  refreshedAirports: string[]
}
