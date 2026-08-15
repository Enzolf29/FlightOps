import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import { getStatisticsOverview } from '../db/repositories/statsRepository'

export function registerStatsHandlers(): void {
  ipcMain.handle(IPC.stats.getOverview, () => getStatisticsOverview())
}
