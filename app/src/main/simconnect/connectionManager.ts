import { app } from 'electron'
import { join } from 'node:path'
import * as regedit from 'regedit'
import { open, Protocol } from 'node-simconnect'
import type { SimConnectConnection } from 'node-simconnect'
import type { SimConnectStatus, SimTelemetry } from '@shared/types/simconnect'
import { startTelemetryLoop } from './telemetryLoop'
import { startLandingPrecisionLoop } from './landingPrecisionLoop'
import type { LandingPrecisionSample } from './landingPrecisionLoop'
import { attachMetarClient } from './metarClient'

const RECONNECT_DELAY_MS = 10_000
const APP_NAME = 'FlightOps'
const EVENT_SIM_STATE = 0xf101
const EVENT_PAUSE_STATE = 0xf102

// node-simconnect lit le registre Windows via les scripts VBS de regedit. Dans l'application
// emballée, electron-builder extrait ces scripts hors de app.asar afin que Windows Script Host
// puisse les exécuter : il faut donc indiquer explicitement ce chemin réel à regedit.
if (app.isPackaged) {
  regedit.setExternalVBSLocation(
    join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'regedit', 'vbs')
  )
}

type StatusListener = (status: SimConnectStatus) => void
type TelemetryListener = (telemetry: SimTelemetry) => void
type LandingPrecisionListener = (sample: LandingPrecisionSample) => void

let status: SimConnectStatus = 'disconnected'
let handle: SimConnectConnection | null = null
let stopTelemetry: (() => void) | null = null
let stopLandingPrecision: (() => void) | null = null
let stopMetarClient: (() => void) | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let simulationActive = false
let simulationPaused = false

const statusListeners = new Set<StatusListener>()
const telemetryListeners = new Set<TelemetryListener>()
const landingPrecisionListeners = new Set<LandingPrecisionListener>()

function setStatus(next: SimConnectStatus): void {
  if (status === next) return
  status = next
  for (const listener of statusListeners) listener(status)
}

export function getStatus(): SimConnectStatus {
  return status
}

export function onStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function onTelemetry(listener: TelemetryListener): () => void {
  telemetryListeners.add(listener)
  return () => telemetryListeners.delete(listener)
}

export function onLandingPrecisionTick(listener: LandingPrecisionListener): () => void {
  landingPrecisionListeners.add(listener)
  return () => landingPrecisionListeners.delete(listener)
}

/** À appeler une seule fois au démarrage de l'app. */
export function startConnectionManager(): void {
  connect()
}

function connect(): void {
  setStatus('connecting')

  open(APP_NAME, Protocol.SunRise)
    .then(({ handle: connection }) => {
      handle = connection
      setStatus('connected')

      // L'évènement système "Sim" renvoie immédiatement l'état courant puis 1/0 à chaque passage
      // entre une session pilotable et les écrans de chargement / menus. C'est plus fiable que de
      // déduire un vol chargé à partir de TITLE ou des L:vars GSX, qui gardent parfois d'anciennes
      // valeurs dans le shell de MSFS.
      connection.subscribeToSystemEvent(EVENT_SIM_STATE, 'Sim')
      // L'horloge Zulu du sim (SimTelemetry.simZuluIso) se fige pendant une pause, alors que
      // SimConnect continue de délivrer des ticks en temps réel : sans suivre "Pause", un
      // évènement de vol confirmé pendant une pause (arrivée, coupure moteur...) serait horodaté
      // avec l'heure sim gelée d'avant-pause plutôt qu'avec le moment réel de la confirmation.
      connection.subscribeToSystemEvent(EVENT_PAUSE_STATE, 'Pause')
      connection.on('event', (event) => {
        if (event.clientEventId === EVENT_SIM_STATE) simulationActive = event.data === 1
        if (event.clientEventId === EVENT_PAUSE_STATE) simulationPaused = event.data === 1
      })

      stopTelemetry = startTelemetryLoop(connection, (telemetry) => {
        const telemetryWithSession = { ...telemetry, simulationActive, simulationPaused }
        for (const listener of telemetryListeners) listener(telemetryWithSession)
      })
      stopLandingPrecision = startLandingPrecisionLoop(connection, (sample) => {
        for (const listener of landingPrecisionListeners) listener(sample)
      })
      stopMetarClient = attachMetarClient(connection)

      connection.on('quit', handleDisconnect)
      connection.on('close', handleDisconnect)
      connection.on('error', handleDisconnect)
    })
    .catch(() => {
      // MSFS 2024 n'est probablement pas lancé (ou pas encore prêt) — on réessaiera.
      setStatus('error')
      scheduleReconnect()
    })
}

function handleDisconnect(): void {
  simulationActive = false
  simulationPaused = false
  if (stopTelemetry) {
    stopTelemetry()
    stopTelemetry = null
  }
  if (stopLandingPrecision) {
    stopLandingPrecision()
    stopLandingPrecision = null
  }
  if (stopMetarClient) {
    stopMetarClient()
    stopMetarClient = null
  }
  if (handle) {
    handle.close()
    handle = null
  }
  setStatus('disconnected')
  scheduleReconnect()
}

function scheduleReconnect(): void {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_DELAY_MS)
}
