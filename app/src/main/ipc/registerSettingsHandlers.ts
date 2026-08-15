import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { AppSettings } from '@shared/types/settings'
import { getSettings, setSetting } from '../db/repositories/settingsRepository'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.settings.get, () => getSettings())

  ipcMain.handle(IPC.settings.set, (_event, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
    setSetting(key, value)
    return getSettings()
  })
}
