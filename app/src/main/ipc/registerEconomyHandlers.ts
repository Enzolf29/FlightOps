import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CompanyEconomySummary, FlightEconomy, RoutePrice, RoutePriceInput } from '@shared/types/economy'
import { computeAirportSurcharge } from '@shared/economy/computeAirportSurcharge'
import {
  deleteRoutePrice,
  getAircraftEconomySummary,
  getCompanyEconomySummary,
  getFlightEconomy,
  getRouteGsxCostHint,
  getRoutePrice,
  listRoutePricesForCompany,
  upsertRoutePrice
} from '../db/repositories/economyRepository'
import { getKnownRouteCountFromAirport } from '../db/repositories/realRoutesRepository'

export function registerEconomyHandlers(): void {
  ipcMain.handle(IPC.economy.listRoutePrices, (_event, companyId: number): RoutePrice[] =>
    listRoutePricesForCompany(companyId)
  )

  ipcMain.handle(
    IPC.economy.getRoutePrice,
    (_event, companyId: number, departureIcao: string, arrivalIcao: string): RoutePrice | null =>
      getRoutePrice(companyId, departureIcao, arrivalIcao)
  )

  ipcMain.handle(IPC.economy.upsertRoutePrice, (_event, input: RoutePriceInput): RoutePrice => upsertRoutePrice(input))

  ipcMain.handle(IPC.economy.deleteRoutePrice, (_event, id: number): void => deleteRoutePrice(id))

  ipcMain.handle(
    IPC.economy.getRouteGsxCostHint,
    (_event, companyId: number, departureIcao: string, arrivalIcao: string) =>
      getRouteGsxCostHint(companyId, departureIcao, arrivalIcao)
  )

  ipcMain.handle(IPC.economy.getFlightEconomy, (_event, flightId: number): FlightEconomy | null =>
    getFlightEconomy(flightId)
  )

  ipcMain.handle(IPC.economy.getCompanyEconomySummary, (_event, companyId: number): CompanyEconomySummary =>
    getCompanyEconomySummary(companyId)
  )

  ipcMain.handle(IPC.economy.getAircraftEconomySummary, (_event, aircraftId: number): CompanyEconomySummary =>
    getAircraftEconomySummary(aircraftId)
  )

  ipcMain.handle(IPC.economy.getAirportSurcharge, (_event, companyId: number, departureIcao: string): number =>
    computeAirportSurcharge(getKnownRouteCountFromAirport(companyId, departureIcao))
  )
}
