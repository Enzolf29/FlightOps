import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateFlightFromOfpInput } from '@shared/types/booking'

export function useCreateBookingFromOfp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFlightFromOfpInput) => window.flightops.booking.createFromOfp(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] })
    }
  })
}
