import { useQuery } from '@tanstack/react-query'

export function useStatistics() {
  return useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => window.flightops.stats.getOverview()
  })
}
