import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useFlights() {
  return useQuery({
    queryKey: ['flights', 'list'],
    queryFn: () => window.flightops.flights.list()
  })
}

function useInvalidateFlights() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['flights'] })
    queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] })
  }
}

export function useCancelFlight() {
  const invalidate = useInvalidateFlights()
  return useMutation({
    mutationFn: (id: number) => window.flightops.flights.cancel(id),
    onSuccess: invalidate
  })
}

export function useDeleteFlight() {
  const invalidate = useInvalidateFlights()
  return useMutation({
    mutationFn: (id: number) => window.flightops.flights.delete(id),
    onSuccess: invalidate
  })
}
