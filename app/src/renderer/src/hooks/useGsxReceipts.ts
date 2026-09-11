import { useQuery } from '@tanstack/react-query'
import type { GsxReceipt } from '@shared/types/gsxReceipt'

export function useGsxReceipts(flightId: number | null, referenceEndIso: string | null, enabled: boolean) {
  return useQuery<GsxReceipt[]>({
    queryKey: ['gsx', 'receiptsForFlight', flightId, referenceEndIso],
    queryFn: () => window.flightops.gsx.getReceiptsForFlight(flightId as number, referenceEndIso),
    enabled: enabled && flightId !== null,
    refetchInterval: referenceEndIso ? false : 60000
  })
}
