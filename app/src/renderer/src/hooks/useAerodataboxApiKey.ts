import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useAerodataboxApiKey() {
  return useQuery({
    queryKey: ['pilot', 'aerodataboxApiKey'],
    queryFn: () => window.flightops.pilot.getAerodataboxApiKey()
  })
}

export function useSetAerodataboxApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (apiKey: string | null) => window.flightops.pilot.setAerodataboxApiKey(apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot', 'aerodataboxApiKey'] })
    }
  })
}
