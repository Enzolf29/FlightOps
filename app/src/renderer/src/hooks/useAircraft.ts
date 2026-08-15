import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AircraftInput, AircraftPatch } from '@shared/types/aircraft'

export function useAircraft(companyId?: number) {
  return useQuery({
    queryKey: ['fleet', 'aircraft', companyId ?? 'all'],
    queryFn: () => window.flightops.fleet.aircraft.list(companyId)
  })
}

function useInvalidateAircraft() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['fleet', 'aircraft'] })
}

export function useCreateAircraft() {
  const invalidate = useInvalidateAircraft()
  return useMutation({
    mutationFn: (input: AircraftInput) => window.flightops.fleet.aircraft.create(input),
    onSuccess: invalidate
  })
}

export function useUpdateAircraft() {
  const invalidate = useInvalidateAircraft()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: AircraftPatch }) => window.flightops.fleet.aircraft.update(id, patch),
    onSuccess: invalidate
  })
}

export function useDeleteAircraft() {
  const invalidate = useInvalidateAircraft()
  return useMutation({
    mutationFn: (id: number) => window.flightops.fleet.aircraft.delete(id),
    onSuccess: invalidate
  })
}
