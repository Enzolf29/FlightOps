import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useSimbriefUserId() {
  return useQuery({
    queryKey: ['pilot', 'simbriefUserId'],
    queryFn: () => window.flightops.pilot.getSimbriefUserId()
  })
}

export function useSetSimbriefUserId() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (simbriefUserId: string | null) => window.flightops.pilot.setSimbriefUserId(simbriefUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot', 'simbriefUserId'] })
    }
  })
}
