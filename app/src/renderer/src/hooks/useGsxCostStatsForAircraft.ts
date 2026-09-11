import { useQuery } from '@tanstack/react-query'
import type { GsxCostStats } from '@shared/types/gsxReceipt'

export function useGsxCostStatsForAircraft(aircraftId: number | null, enabled: boolean) {
  return useQuery<GsxCostStats>({
    queryKey: ['gsx', 'costStatsForAircraft', aircraftId],
    queryFn: () => window.flightops.gsx.getCostStatsForAircraft(aircraftId as number),
    enabled: enabled && aircraftId !== null
  })
}
