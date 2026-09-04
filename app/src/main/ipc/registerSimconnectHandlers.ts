import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import {
  getStatus,
  onLandingPrecisionTick,
  onStatusChange,
  onTelemetry,
  startConnectionManager
} from '../simconnect/connectionManager'
import { requestMetar } from '../simconnect/metarClient'
import {
  armFlight,
  completeManually,
  disarmFlight,
  getActualDepartureIso,
  getArmedFlightId,
  getFlightEvents,
  getFlightRecorderStatus,
  getLiveFlightPath,
  handleLandingPrecisionTick,
  handleTelemetryTick,
  onFlightEvent,
  onFlightRecorderStatus,
  recoverFlightSession
} from '../simconnect/flightStatusDetector'

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

export function registerSimconnectHandlers(): void {
  onStatusChange((status) => broadcast(IPC.simconnect.statusChanged, status))
  onTelemetry((telemetry) => {
    broadcast(IPC.simconnect.telemetry, telemetry)
    handleTelemetryTick(telemetry)
  })
  onFlightEvent((event) => broadcast(IPC.simconnect.flightEvent, event))
  onFlightRecorderStatus((status) => broadcast(IPC.simconnect.recorderStatusChanged, status))
  onLandingPrecisionTick((sample) => handleLandingPrecisionTick(sample))

  ipcMain.handle(IPC.simconnect.getStatus, () => getStatus())
  ipcMain.handle(IPC.simconnect.armFlight, (_event, flightId: number) => armFlight(flightId))
  ipcMain.handle(IPC.simconnect.disarmFlight, () => disarmFlight())
  ipcMain.handle(IPC.simconnect.getArmedFlightId, () => getArmedFlightId())
  ipcMain.handle(IPC.simconnect.getActualDepartureIso, () => getActualDepartureIso())
  ipcMain.handle(IPC.simconnect.completeManually, () => completeManually())
  ipcMain.handle(IPC.simconnect.getMetar, (_event, icaoCode: string) => requestMetar(icaoCode))
  ipcMain.handle(IPC.simconnect.getFlightEvents, () => getFlightEvents())
  ipcMain.handle(IPC.simconnect.getLiveFlightPath, () => getLiveFlightPath())
  ipcMain.handle(IPC.simconnect.getRecorderStatus, () => getFlightRecorderStatus())

  recoverFlightSession()
  startConnectionManager()
}
