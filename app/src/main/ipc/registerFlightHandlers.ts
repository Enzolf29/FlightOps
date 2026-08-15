import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { FlightWithRelations } from '@shared/types/flight'
import {
  getAllFlights,
  getFlightOfpJson,
  getFlightWithRelationsById,
  setFlightStatus,
  deleteFlight
} from '../db/repositories/flightRepository'
import { getArmedFlightId, disarmFlight } from '../simconnect/flightStatusDetector'

export function registerFlightHandlers(): void {
  ipcMain.handle(IPC.flights.list, () => getAllFlights())

  ipcMain.handle(IPC.flights.getOfpJson, (_event, id: number) => getFlightOfpJson(id))

  ipcMain.handle(IPC.flights.cancel, (_event, id: number): FlightWithRelations => {
    const flight = getFlightWithRelationsById(id)
    if (!flight) {
      throw new Error('Vol introuvable.')
    }
    if (flight.status !== 'upcoming') {
      throw new Error('Seul un vol à venir peut être annulé.')
    }

    setFlightStatus(id, 'cancelled')
    return getFlightWithRelationsById(id)!
  })

  ipcMain.handle(IPC.flights.delete, (_event, id: number) => {
    const flight = getFlightWithRelationsById(id)
    if (!flight) {
      throw new Error('Vol introuvable.')
    }

    // Un vol supprimé alors qu'il est en cours de suivi laisserait le détecteur pointer vers un
    // vol qui n'existe plus — on arrête proprement le suivi avant de supprimer.
    if (getArmedFlightId() === id) {
      disarmFlight()
    }

    deleteFlight(id)
  })
}
