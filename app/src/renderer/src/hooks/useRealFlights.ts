import { useMutation } from '@tanstack/react-query'
import type { RealRoute, RealRouteSearchResult } from '@shared/types/realFlights'

interface SearchRealRoutesInput {
  companyId: number
  departureIcao: string
  forceRefresh: boolean
}

export function useSearchRealRoutes() {
  return useMutation<RealRouteSearchResult, Error, SearchRealRoutesInput>({
    mutationFn: ({ companyId, departureIcao, forceRefresh }) =>
      window.flightops.realFlights.searchRoutes(companyId, departureIcao, forceRefresh)
  })
}

export function useSuggestFlightNumber() {
  return useMutation<string | null, Error, number>({
    mutationFn: (routeId) => window.flightops.realFlights.suggestFlightNumber(routeId)
  })
}

/** Parcourt le cache local (real_routes) pour une compagnie sans passer par l'API — utilisé pour
 * afficher tous les vols déjà connus même sans indiquer d'aéroport de départ. */
export function useListKnownRoutes() {
  return useMutation<RealRoute[], Error, number>({
    mutationFn: (companyId) => window.flightops.realFlights.listKnownRoutes(companyId)
  })
}
