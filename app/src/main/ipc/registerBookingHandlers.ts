import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CreateFlightFromOfpInput } from '@shared/types/booking'
import type { FlightWithRelations } from '@shared/types/flight'
import { isoToSqliteUtc } from '@shared/lib/datetime'
import { parseOfpDetail } from '@shared/simbrief/parseOfpDetail'
import { getCompanyById } from '../db/repositories/companyRepository'
import { createFlight, getFlightWithRelationsById } from '../db/repositories/flightRepository'
import { createFlightEconomy } from '../db/repositories/economyRepository'

function readSoldPassengers(simbriefOfpJson: string | null): number | null {
  if (!simbriefOfpJson) return null
  return parseOfpDetail(simbriefOfpJson)?.loadsheet?.paxCount ?? null
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
      createFlightEconomy({
        flightId: id,
        ticketPriceEur: input.economy.ticketPriceEur,
        referenceTicketPriceEur: input.economy.referenceTicketPriceEur,
        cabinRevenueMultiplier: input.economy.cabinRevenueMultiplier,
        baggagePriceEur: company.baggagePriceEur,
        passengersSold: readSoldPassengers(input.simbriefOfpJson)
      })
    }

    const flight = getFlightWithRelationsById(id)
    if (!flight) {
      throw new Error('Erreur lors de la création du vol.')
    }
    return flight
  })
}
