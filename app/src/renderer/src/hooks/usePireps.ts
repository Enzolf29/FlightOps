import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function usePireps() {
  return useQuery({
    queryKey: ['pireps', 'list'],
    queryFn: () => window.flightops.pireps.list()
  })
}

export function usePirep(id: number | null) {
  return useQuery({
    queryKey: ['pireps', 'detail', id],
    queryFn: () => window.flightops.pireps.getById(id as number),
    enabled: id !== null
  })
}

export function usePirepsByAircraft(aircraftId: number | null) {
  return useQuery({
    queryKey: ['pireps', 'byAircraft', aircraftId],
    queryFn: () => window.flightops.pireps.listByAircraft(aircraftId as number),
    enabled: aircraftId !== null
  })
}

export function usePirepFlightPath(id: number) {
  return useQuery({
    queryKey: ['pireps', 'flightPath', id],
    queryFn: () => window.flightops.pireps.getFlightPath(id)
  })
}

export function usePirepApproachProfile(id: number) {
  return useQuery({
    queryKey: ['pireps', 'approachProfile', id],
    queryFn: () => window.flightops.pireps.getApproachProfile(id)
  })
}

export function usePirepEvents(id: number) {
  return useQuery({
    queryKey: ['pireps', 'events', id],
    queryFn: () => window.flightops.pireps.getEvents(id)
  })
}

export function usePirepTelemetrySamples(id: number) {
  return useQuery({
    queryKey: ['pireps', 'telemetrySamples', id],
    queryFn: () => window.flightops.pireps.getTelemetrySamples(id)
  })
}

export function useDeletePirep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.flightops.pireps.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pireps'] })
      queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['fleet', 'aircraft'] })
    }
  })
}
