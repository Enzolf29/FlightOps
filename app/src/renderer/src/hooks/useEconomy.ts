import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompanyEconomySummary, FlightEconomy, RoutePrice, RoutePriceInput } from '@shared/types/economy'

export function useFlightEconomy(flightId: number | null) {
  return useQuery<FlightEconomy | null>({
    queryKey: ['economy', 'flightEconomy', flightId],
    queryFn: () => window.flightops.economy.getFlightEconomy(flightId as number),
    enabled: flightId !== null
  })
}

export function useRoutePrice(
  companyId: number | null,
  departureIcao: string,
  arrivalIcao: string,
  enabled: boolean
) {
  return useQuery<RoutePrice | null>({
    queryKey: ['economy', 'routePrice', companyId, departureIcao, arrivalIcao],
    queryFn: () => window.flightops.economy.getRoutePrice(companyId as number, departureIcao, arrivalIcao),
    enabled: enabled && companyId !== null && departureIcao.trim().length >= 3 && arrivalIcao.trim().length >= 3
  })
}

export function useRoutePricesForCompany(companyId: number | null) {
  return useQuery<RoutePrice[]>({
    queryKey: ['economy', 'routePrices', companyId],
    queryFn: () => window.flightops.economy.listRoutePrices(companyId as number),
    enabled: companyId !== null
  })
}

export function useRouteGsxCostHint(
  companyId: number | null,
  departureIcao: string,
  arrivalIcao: string,
  enabled: boolean
) {
  return useQuery<{ averageGsxCostEur: number | null; flightsFlown: number }>({
    queryKey: ['economy', 'routeGsxCostHint', companyId, departureIcao, arrivalIcao],
    queryFn: () => window.flightops.economy.getRouteGsxCostHint(companyId as number, departureIcao, arrivalIcao),
    enabled: enabled && companyId !== null && departureIcao.trim().length >= 3 && arrivalIcao.trim().length >= 3
  })
}

export function useCompanyEconomySummary(companyId: number | null) {
  return useQuery<CompanyEconomySummary>({
    queryKey: ['economy', 'companySummary', companyId],
    queryFn: () => window.flightops.economy.getCompanyEconomySummary(companyId as number),
    enabled: companyId !== null
  })
}

export function useAircraftEconomySummary(aircraftId: number | null) {
  return useQuery<CompanyEconomySummary>({
    queryKey: ['economy', 'aircraftSummary', aircraftId],
    queryFn: () => window.flightops.economy.getAircraftEconomySummary(aircraftId as number),
    enabled: aircraftId !== null
  })
}

/** Surtaxe "petit aéroport" (voir computeAirportSurcharge), basée sur le nombre de destinations
 * réelles connues (Vols réels) pour cette compagnie au départ de cet aéroport. */
export function useAirportSurcharge(companyId: number | null, departureIcao: string, enabled: boolean) {
  return useQuery<number>({
    queryKey: ['economy', 'airportSurcharge', companyId, departureIcao],
    queryFn: () => window.flightops.economy.getAirportSurcharge(companyId as number, departureIcao),
    enabled: enabled && companyId !== null && departureIcao.trim().length >= 3
  })
}

/** Surtaxe propre à cette ligne précise (voir computeRouteSurcharge), basée sur sa part
 * d'observations par rapport aux autres lignes connues au départ du même aéroport. */
export function useRouteSurcharge(
  companyId: number | null,
  departureIcao: string,
  arrivalIcao: string,
  enabled: boolean
) {
  return useQuery<number>({
    queryKey: ['economy', 'routeSurcharge', companyId, departureIcao, arrivalIcao],
    queryFn: () => window.flightops.economy.getRouteSurcharge(companyId as number, departureIcao, arrivalIcao),
    enabled: enabled && companyId !== null && departureIcao.trim().length >= 3 && arrivalIcao.trim().length >= 3
  })
}

export function useUpsertRoutePrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RoutePriceInput) => window.flightops.economy.upsertRoutePrice(input),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['economy', 'routePrices', input.companyId] })
      queryClient.invalidateQueries({ queryKey: ['economy', 'routePrice'] })
    }
  })
}

export function useDeleteRoutePrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.flightops.economy.deleteRoutePrice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['economy', 'routePrices'] })
      queryClient.invalidateQueries({ queryKey: ['economy', 'routePrice'] })
    }
  })
}
