import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import { checkForAppUpdates, getAppUpdateStatus, installDownloadedUpdate } from '../updater/appUpdater'

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC.updates.getStatus, () => getAppUpdateStatus())
  ipcMain.handle(IPC.updates.check, () => checkForAppUpdates())
  ipcMain.handle(IPC.updates.install, () => installDownloadedUpdate())
}
