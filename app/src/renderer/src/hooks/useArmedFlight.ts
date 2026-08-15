import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useArmedFlightId() {
  return useQuery({
    queryKey: ['simconnect', 'armedFlightId'],
    queryFn: () => window.flightops.simconnect.getArmedFlightId()
  })
}

/**
 * Heure de départ réelle (off-blocks) du vol suivi, une fois observée — null tant qu'il n'a pas
 * encore quitté le parking. Poll à intervalle modéré : ne change qu'une seule fois par vol (au
 * décollage), pas besoin d'un flux temps réel dédié.
 */
export function useActualDepartureIso(enabled: boolean) {
  return useQuery({
    queryKey: ['simconnect', 'actualDepartureIso'],
    queryFn: () => window.flightops.simconnect.getActualDepartureIso(),
    enabled,
    refetchInterval: 5000
  })
}

/**
 * Trajectoire déjà accumulée côté main process pour le vol armé en cours — chargée une fois au
 * montage pour redessiner le tracé déjà volé quand on revient sur la page après l'avoir quittée
 * (sinon la carte repartait d'un tracé vide, alors que le suivi n'a jamais été interrompu).
 */
export function useLiveFlightPath(enabled: boolean) {
  return useQuery({
    queryKey: ['simconnect', 'liveFlightPath'],
    queryFn: () => window.flightops.simconnect.getLiveFlightPath(),
    enabled
  })
}

function useInvalidateArmedFlight() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['simconnect', 'armedFlightId'] })
    queryClient.invalidateQueries({ queryKey: ['flights'] })
    queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] })
  }
}

export function useArmFlight() {
  const invalidate = useInvalidateArmedFlight()
  return useMutation({
    mutationFn: (flightId: number) => window.flightops.simconnect.armFlight(flightId),
    onSuccess: invalidate
  })
}

export function useDisarmFlight() {
  const invalidate = useInvalidateArmedFlight()
  return useMutation({
    mutationFn: () => window.flightops.simconnect.disarmFlight(),
    onSuccess: invalidate
  })
}

export function useCompleteManually() {
  const invalidate = useInvalidateArmedFlight()
  return useMutation({
    mutationFn: () => window.flightops.simconnect.completeManually(),
    onSuccess: invalidate
  })
}
