import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CabinAnnouncementType, CabinAnnouncementVariant } from '@shared/types/cabinAnnouncements'
import {
  importCabinAnnouncement,
  listCabinAnnouncements,
  removeCabinAnnouncement,
  setCabinAnnouncementVolume
} from '../cabinAnnouncements/cabinAnnouncementFiles'
import { resetCabinAnnouncementsToDefaults } from '../cabinAnnouncements/seedBundledAnnouncements'

export function registerCabinAnnouncementHandlers(): void {
  ipcMain.handle(IPC.cabinAnnouncements.list, (_event, companyId: number) => listCabinAnnouncements(companyId))
  ipcMain.handle(
    IPC.cabinAnnouncements.import,
    (_event, companyId: number, type: CabinAnnouncementType, variant: CabinAnnouncementVariant) =>
      importCabinAnnouncement(companyId, type, variant)
  )
  ipcMain.handle(IPC.cabinAnnouncements.remove, (_event, fileId: number) => {
    removeCabinAnnouncement(fileId)
  })
  ipcMain.handle(IPC.cabinAnnouncements.resetToDefaults, (_event, companyId: number) => {
    resetCabinAnnouncementsToDefaults(companyId)
  })
  ipcMain.handle(IPC.cabinAnnouncements.setVolume, (_event, fileId: number, volume: number) =>
    setCabinAnnouncementVolume(fileId, volume)
  )
}
