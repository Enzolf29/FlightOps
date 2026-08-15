import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { CreateFlightFromOfpInput } from '@shared/types/booking'
import type { FlightWithRelations } from '@shared/types/flight'
import { generateCallsign } from '@shared/callsign/generateCallsign'
import { isoToSqliteUtc } from '@shared/lib/datetime'
import { getCompanyById } from '../db/repositories/companyRepository'
import { createFlight, getAllCallsigns, getFlightWithRelationsById } from '../db/repositories/flightRepository'

export function registerBookingHandlers(): void {
  ipcMain.handle(IPC.booking.createFromOfp, (_event, input: CreateFlightFromOfpInput): FlightWithRelations => {
    const company = getCompanyById(input.companyId)
    if (!company) {
      throw new Error('Compagnie introuvable.')
    }

    const { raw, display } = generateCallsign({
      icaoCode: company.icaoCode,
      radioCallsign: company.radioCallsign,
      pattern: company.callsignPattern,
      existingCallsigns: getAllCallsigns()
    })

    const id = createFlight({
      companyId: input.companyId,
      aircraftId: input.aircraftId,
      flightNumber: company.iataCode + input.flightNumberDigits,
      callsign: raw,
      callsignDisplay: display,
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

    const flight = getFlightWithRelationsById(id)
    if (!flight) {
      throw new Error('Erreur lors de la création du vol.')
    }
    return flight
  })
}
