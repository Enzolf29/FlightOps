import { useQuery } from '@tanstack/react-query'

export function useHomeDashboard() {
  return useQuery({
    queryKey: ['home', 'dashboard'],
    queryFn: () => window.flightops.home.getDashboard(),
    refetchInterval: 30_000
  })
}
