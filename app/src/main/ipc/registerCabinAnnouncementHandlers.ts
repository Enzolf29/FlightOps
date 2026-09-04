import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import {
  importCabinAnnouncement,
  listCabinAnnouncements,
  removeCabinAnnouncement,
  setCabinAnnouncementVolume
} from '../cabinAnnouncements/cabinAnnouncementFiles'

export function registerCabinAnnouncementHandlers(): void {
  ipcMain.handle(IPC.cabinAnnouncements.list, (_event, companyId: number) => listCabinAnnouncements(companyId))
  ipcMain.handle(
    IPC.cabinAnnouncements.import,
    (_event, companyId: number, type: CabinAnnouncementType) => importCabinAnnouncement(companyId, type)
  )
  ipcMain.handle(IPC.cabinAnnouncements.remove, (_event, companyId: number, type: CabinAnnouncementType) => {
    removeCabinAnnouncement(companyId, type)
  })
  ipcMain.handle(
    IPC.cabinAnnouncements.setVolume,
    (_event, companyId: number, type: CabinAnnouncementType, volume: number) =>
      setCabinAnnouncementVolume(companyId, type, volume)
  )
}
