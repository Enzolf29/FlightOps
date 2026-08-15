import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CompanyPatch } from '@shared/types/company'
import type { AircraftInput, AircraftPatch } from '@shared/types/aircraft'
import { getAllCompanies, updateCompany } from '../db/repositories/companyRepository'
import { getAllAircraft, createAircraft, updateAircraft, deleteAircraft } from '../db/repositories/aircraftRepository'

export function registerFleetHandlers(): void {
  ipcMain.handle(IPC.fleet.companies.list, () => getAllCompanies())

  ipcMain.handle(IPC.fleet.companies.update, (_event, id: number, patch: CompanyPatch) => updateCompany(id, patch))

  ipcMain.handle(IPC.fleet.aircraft.list, (_event, companyId?: number) => getAllAircraft(companyId))

  ipcMain.handle(IPC.fleet.aircraft.create, (_event, input: AircraftInput) => createAircraft(input))

  ipcMain.handle(IPC.fleet.aircraft.update, (_event, id: number, patch: AircraftPatch) => updateAircraft(id, patch))

  ipcMain.handle(IPC.fleet.aircraft.delete, (_event, id: number) => deleteAircraft(id))
}
