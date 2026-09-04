import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { TabletCabinStatus } from '@shared/types/tablet'
import {
  getTabletServerInfo,
  onTabletCabinCommand,
  publishTabletCabinStatus
} from '../tablet/tabletServer'

export function registerTabletHandlers(): void {
  ipcMain.handle(IPC.tablet.getServerInfo, () => getTabletServerInfo())
  ipcMain.handle(IPC.tablet.publishCabinStatus, (_event, status: TabletCabinStatus) => {
    publishTabletCabinStatus(status)
  })
  onTabletCabinCommand((command) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.tablet.cabinCommand, command)
    }
  })
}
