import { useMutation } from '@tanstack/react-query'

export function useFetchLatestOfp() {
  return useMutation({
    mutationFn: () => window.flightops.simbrief.fetchLatestOfp()
  })
}
