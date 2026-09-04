import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import {
  getAllPireps,
  getPirepApproachProfile,
  getPirepById,
  getPirepEvents,
  getPirepTelemetrySamples,
  getPirepFlightPath,
  getPirepsByAircraft
} from '../db/repositories/pirepRepository'

export function registerPirepHandlers(): void {
  ipcMain.handle(IPC.pireps.list, () => getAllPireps())
  ipcMain.handle(IPC.pireps.listByAircraft, (_event, aircraftId: number) => getPirepsByAircraft(aircraftId))
  ipcMain.handle(IPC.pireps.getById, (_event, id: number) => getPirepById(id))
  ipcMain.handle(IPC.pireps.getFlightPath, (_event, id: number) => getPirepFlightPath(id))
  ipcMain.handle(IPC.pireps.getApproachProfile, (_event, id: number) => getPirepApproachProfile(id))
  ipcMain.handle(IPC.pireps.getEvents, (_event, id: number) => getPirepEvents(id))
  ipcMain.handle(IPC.pireps.getTelemetrySamples, (_event, id: number) => getPirepTelemetrySamples(id))
}
