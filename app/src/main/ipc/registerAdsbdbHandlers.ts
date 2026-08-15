import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import { lookupAircraftByRegistration } from '../adsbdb/adsbdbClient'

export function registerAdsbdbHandlers(): void {
  ipcMain.handle(IPC.adsbdb.lookupByRegistration, (_event, registration: string) =>
    lookupAircraftByRegistration(registration)
  )
}
