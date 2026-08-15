import { useQuery } from '@tanstack/react-query'

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
