import { useQuery } from '@tanstack/react-query'
import { parseOfpDetail } from '@shared/simbrief/parseOfpDetail'
import type { OfpDetail } from '@shared/simbrief/parseOfpDetail'

export function useOfpDetail(flightId: number | null, enabled: boolean) {
  return useQuery<OfpDetail | null>({
    queryKey: ['flights', 'ofpDetail', flightId],
    queryFn: async () => {
      const raw = await window.flightops.flights.getOfpJson(flightId as number)
      return raw ? parseOfpDetail(raw) : null
    },
    enabled: enabled && flightId !== null
  })
}
