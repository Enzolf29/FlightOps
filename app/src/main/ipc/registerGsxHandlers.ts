import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { GsxReceipt, GsxCostStats } from '@shared/types/gsxReceipt'
import { getFlightWithRelationsById } from '../db/repositories/flightRepository'
import { getGsxCostStatsForAircraft } from '../db/repositories/statsRepository'
import { getGsxReceiptsForFlight, readGsxReceiptHtml } from '../gsx/gsxReceiptsRepository'

export function registerGsxHandlers(): void {
  ipcMain.handle(
    IPC.gsx.getReceiptsForFlight,
    (_event, flightId: number, referenceEndIso?: string | null): GsxReceipt[] => {
      const flight = getFlightWithRelationsById(flightId)
      if (!flight) return []
      return getGsxReceiptsForFlight(flight, referenceEndIso ?? null)
    }
  )

  ipcMain.handle(IPC.gsx.readReceiptHtml, (_event, htmlPath: string): string | null => readGsxReceiptHtml(htmlPath))

  ipcMain.handle(IPC.gsx.getCostStatsForAircraft, (_event, aircraftId: number): GsxCostStats =>
    getGsxCostStatsForAircraft(aircraftId)
  )
}
