import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CreateFlightFromOfpInput } from '@shared/types/booking'
import type { FlightWithRelations } from '@shared/types/flight'
import { isoToSqliteUtc } from '@shared/lib/datetime'
import { parseOfpDetail } from '@shared/simbrief/parseOfpDetail'
import { getCompanyById } from '../db/repositories/companyRepository'
import { createFlight, getFlightWithRelationsById } from '../db/repositories/flightRepository'
import { createFlightEconomy } from '../db/repositories/economyRepository'

const LBS_PER_KG = 2.2046226218

function readSoldPassengersAndCargo(simbriefOfpJson: string | null): { passengersSold: number | null; cargoKgSold: number | null } {
  if (!simbriefOfpJson) return { passengersSold: null, cargoKgSold: null }
  const loadsheet = parseOfpDetail(simbriefOfpJson)?.loadsheet
  if (!loadsheet) return { passengersSold: null, cargoKgSold: null }

  const cargoKgSold = loadsheet.cargo === null ? null : loadsheet.units === 'lbs' ? loadsheet.cargo / LBS_PER_KG : loadsheet.cargo
  return { passengersSold: loadsheet.paxCount, cargoKgSold }
}

export function registerBookingHandlers(): void {
  ipcMain.handle(IPC.booking.createFromOfp, (_event, input: CreateFlightFromOfpInput): FlightWithRelations => {
    const company = getCompanyById(input.companyId)
    if (!company) {
      throw new Error('Compagnie introuvable.')
    }

    const callsign = input.callsign.trim()
    if (!callsign) {
      throw new Error('Aucun callsign ATC renseigné dans le plan SimBrief.')
    }

    const id = createFlight({
      companyId: input.companyId,
      aircraftId: input.aircraftId,
      flightNumber: company.icaoCode + input.flightNumberDigits,
      callsign,
      callsignDisplay: callsign,
      departureIcao: input.departureIcao,
      arrivalIcao: input.arrivalIcao,
      scheduledDeparture: isoToSqliteUtc(input.scheduledDepartureUtc),
      scheduledArrival: isoToSqliteUtc(input.scheduledArrivalUtc),
      status: 'upcoming',
      source: input.source,
      route: input.route,
      alternateIcao: input.alternateIcao,
      simbriefOfpJson: input.simbriefOfpJson
    })

    if (input.economy) {
      const { passengersSold, cargoKgSold } = readSoldPassengersAndCargo(input.simbriefOfpJson)
      createFlightEconomy({
        flightId: id,
        ticketPriceEur: input.economy.ticketPriceEur,
        cargoPriceEurPerKg: input.economy.cargoPriceEurPerKg,
        referenceTicketPriceEur: input.economy.referenceTicketPriceEur,
        referenceCargoPriceEurPerKg: input.economy.referenceCargoPriceEurPerKg,
        cabinRevenueMultiplier: input.economy.cabinRevenueMultiplier,
        passengersSold,
        cargoKgSold
      })
    }

    const flight = getFlightWithRelationsById(id)
    if (!flight) {
      throw new Error('Erreur lors de la création du vol.')
    }
    return flight
  })
}
