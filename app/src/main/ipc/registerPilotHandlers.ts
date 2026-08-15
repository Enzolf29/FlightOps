import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import { getPilot, updateAerodataboxApiKey, updateSimbriefUserId } from '../db/repositories/pilotRepository'

export function registerPilotHandlers(): void {
  ipcMain.handle(IPC.pilot.getSimbriefUserId, () => getPilot().simbrief_user_id)

  ipcMain.handle(IPC.pilot.setSimbriefUserId, (_event, simbriefUserId: string | null) => {
    updateSimbriefUserId(simbriefUserId)
    return simbriefUserId
  })

  ipcMain.handle(IPC.pilot.getAerodataboxApiKey, () => getPilot().aerodatabox_api_key)

  ipcMain.handle(IPC.pilot.setAerodataboxApiKey, (_event, apiKey: string | null) => {
    updateAerodataboxApiKey(apiKey)
    return apiKey
  })
}
