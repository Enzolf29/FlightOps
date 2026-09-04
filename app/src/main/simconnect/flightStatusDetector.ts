import { getFlightOfpJson, getFlightWithRelationsById, setFlightStatus } from '../db/repositories/flightRepository'
import { appendPirepEvents, createPirep, updatePirepEngineStop } from '../db/repositories/pirepRepository'
import { computePirepOutcome } from '@shared/flightStatus/computePirepOutcome'
import { formatDelayDuration } from '@shared/flightStatus/formatDelayDuration'
import { parseOfpDetail } from '@shared/simbrief/parseOfpDetail'
import { evaluateTelemetryTick } from '@shared/flightStatus/evaluateTelemetryTick'
import type { DetectorTickState } from '@shared/flightStatus/evaluateTelemetryTick'
import {
  ENGINE_DEFINITIONS,
  evaluateFlightEvents,
  INITIAL_FLIGHT_EVENT_FLAGS,
  MINIMUM_FLIGHT_DURATION_SECONDS
} from '@shared/flightStatus/evaluateFlightEvents'
import type { FlightEvent, FlightEventFlags } from '@shared/flightStatus/evaluateFlightEvents'
import type { SimTelemetry } from '@shared/types/simconnect'
import type { PirepFlightPathPoint, PirepApproachProfilePoint } from '@shared/types/pirep'
import type { LandingPrecisionSample } from './landingPrecisionLoop'
import { isPlausibleMovement } from '@shared/flightStatus/isPlausibleMovement'
import {
  countTelemetrySamples,
  deleteFlightSession,
  insertTelemetrySample,
  loadLatestFlightSession,
  markFlightSessionRecovered,
  saveFlightSession
} from '../db/repositories/flightRecorderRepository'
import type { FlightRecorderStatus } from '@shared/types/simconnect'

const MAX_EVENTS = 300
const MAX_FLIGHT_PATH_POINTS = 20_000
const NORMAL_SAVE_INTERVAL_MS = 5_000
const APPROACH_SAVE_INTERVAL_MS = 1_000
const APPROACH_AGL_FEET = 5_000

interface TouchdownStats {
  verticalSpeedFpm: number
  gForce: number
  pitchDegrees: number
  bankDegrees: number
  airspeedKt: number
}

let armedFlightId: number | null = null
let tickState: DetectorTickState | null = null
let actualDepartureIso: string | null = null
let lastTelemetry: SimTelemetry | null = null
let sessionStartedAt: string | null = null
let lastPersistedAtMs = 0
let sampleCount = 0
let recoveredSession = false
let recorderError: string | null = null
let awaitingEngineShutdown = false
const recorderListeners = new Set<(status: FlightRecorderStatus) => void>()

let previousTelemetry: SimTelemetry | null = null
let eventFlags: FlightEventFlags = INITIAL_FLIGHT_EVENT_FLAGS
let events: FlightEvent[] = []
/** Altitude de croisière planifiée (OFP SimBrief), pour ne détecter "Arrivée en croisière" qu'au
 * bon palier plutôt qu'à n'importe quel palier temporaire en montée (ex. attente ATC à FL110). */
let plannedCruiseAltitudeFeet: number | null = null
const eventListeners = new Set<(event: FlightEvent) => void>()

let engineStartIso: string | null = null
let engineStopIso: string | null = null
let fuelAtEngineStartKg: number | null = null
let fuelAtTakeoffKg: number | null = null
let fuelAtTouchdownKg: number | null = null
let fuelAtEngineStopKg: number | null = null
/** Heure du dernier atterrissage (voir 'landing' ci-dessous), pour calculer le temps de roulage
 * après atterrissage une fois l'avion réellement arrivé au parking (transition on_blocks). */
let lastLandingSimTimeIso: string | null = null

let flightPath: PirepFlightPathPoint[] = []
let approachProfile: PirepApproachProfilePoint[] = []

let previousLandingSample: LandingPrecisionSample | null = null
let landingPrecisionArmed = false
let touchdownStats: TouchdownStats | null = null

/**
 * Le vol se termine (arrivée au parking) souvent avant que le pilote coupe réellement les
 * moteurs — le PIREP est déjà créé à ce moment-là. On garde cette capture "en attente" active même
 * après la désarmement du vol, pour compléter le PIREP dès que la coupure moteur survient enfin.
 */
let pendingEngineStopCapture: { pirepId: number; engineStartIso: string | null } | null = null
let pendingCaptureWasEnginesRunning = true
/** Snapshot moteur par moteur au moment de la clôture du vol, pour continuer à loguer "Moteur N
 * coupé" pendant la capture "en attente" ci-dessus — sinon ces coupures tardives (après l'arrivée
 * au parking, avant que le pilote coupe réellement les moteurs) ne sont jamais détectées. */
let pendingEngineStates: Record<string, boolean> | null = null
let pendingEngineEvents: FlightEvent[] = []

interface PersistedDetectorState {
  tickState: DetectorTickState
  actualDepartureIso: string | null
  previousTelemetry: SimTelemetry | null
  eventFlags: FlightEventFlags
  events: FlightEvent[]
  plannedCruiseAltitudeFeet: number | null
  engineStartIso: string | null
  engineStopIso: string | null
  fuelAtEngineStartKg: number | null
  fuelAtTakeoffKg: number | null
  fuelAtTouchdownKg: number | null
  fuelAtEngineStopKg: number | null
  lastLandingSimTimeIso: string | null
  flightPath: PirepFlightPathPoint[]
  approachProfile: PirepApproachProfilePoint[]
  landingPrecisionArmed: boolean
  touchdownStats: TouchdownStats | null
  awaitingEngineShutdown: boolean
}

function recorderStatus(): FlightRecorderStatus {
  const state = recorderError ? 'error' : armedFlightId === null ? 'idle' : recoveredSession ? 'recovered' : 'recording'
  return {
    state,
    flightId: armedFlightId,
    lastSavedAt: lastPersistedAtMs > 0 ? new Date(lastPersistedAtMs).toISOString() : null,
    sampleCount,
    message: recorderError
      ? recorderError
      : armedFlightId === null
        ? 'Aucun vol en cours d’enregistrement'
        : recoveredSession
          ? 'Session récupérée — enregistrement actif'
          : 'Enregistrement actif'
  }
}

function notifyRecorderStatus(): void {
  const status = recorderStatus()
  for (const listener of recorderListeners) listener(status)
}

export function getFlightRecorderStatus(): FlightRecorderStatus {
  return recorderStatus()
}

export function onFlightRecorderStatus(listener: (status: FlightRecorderStatus) => void): () => void {
  recorderListeners.add(listener)
  return () => recorderListeners.delete(listener)
}

function persistedState(): PersistedDetectorState | null {
  if (!tickState) return null
  return {
    tickState,
    actualDepartureIso,
    previousTelemetry,
    eventFlags,
    events,
    plannedCruiseAltitudeFeet,
    engineStartIso,
    engineStopIso,
    fuelAtEngineStartKg,
    fuelAtTakeoffKg,
    fuelAtTouchdownKg,
    fuelAtEngineStopKg,
    lastLandingSimTimeIso,
    flightPath,
    approachProfile,
    landingPrecisionArmed,
    touchdownStats,
    awaitingEngineShutdown
  }
}

function persistFlightSession(telemetry: SimTelemetry, force = false): void {
  if (armedFlightId === null || !sessionStartedAt) return
  const now = Date.now()
  const inApproach = !telemetry.onGround && (telemetry.altitudeAboveGround ?? Infinity) <= APPROACH_AGL_FEET
  const interval = inApproach ? APPROACH_SAVE_INTERVAL_MS : NORMAL_SAVE_INTERVAL_MS
  if (!force && now - lastPersistedAtMs < interval) return

  const state = persistedState()
  if (!state) return
  try {
    saveFlightSession(armedFlightId, state, sessionStartedAt, telemetry.simZuluIso)
    insertTelemetrySample(armedFlightId, telemetry, eventFlags.flightPhase)
    sampleCount += 1
    lastPersistedAtMs = now
    recorderError = null
    notifyRecorderStatus()
  } catch (error) {
    recorderError = error instanceof Error ? error.message : 'Échec de la sauvegarde du vol'
    notifyRecorderStatus()
  }
}

export function recoverFlightSession(): void {
  const stored = loadLatestFlightSession()
  if (!stored) return
  try {
    const state = JSON.parse(stored.stateJson) as PersistedDetectorState
    armedFlightId = stored.flightId
    tickState = state.tickState
    actualDepartureIso = state.actualDepartureIso
    previousTelemetry = state.previousTelemetry
    eventFlags = state.eventFlags
    events = state.events ?? []
    plannedCruiseAltitudeFeet = state.plannedCruiseAltitudeFeet
    engineStartIso = state.engineStartIso
    engineStopIso = state.engineStopIso
    fuelAtEngineStartKg = state.fuelAtEngineStartKg
    fuelAtTakeoffKg = state.fuelAtTakeoffKg
    fuelAtTouchdownKg = state.fuelAtTouchdownKg
    fuelAtEngineStopKg = state.fuelAtEngineStopKg
    lastLandingSimTimeIso = state.lastLandingSimTimeIso
    flightPath = state.flightPath ?? []
    approachProfile = state.approachProfile ?? []
    landingPrecisionArmed = state.landingPrecisionArmed
    touchdownStats = state.touchdownStats
    awaitingEngineShutdown = state.awaitingEngineShutdown ?? false
    sessionStartedAt = stored.startedAt
    sampleCount = countTelemetrySamples(stored.flightId)
    recoveredSession = true
    lastPersistedAtMs = Date.now()
    markFlightSessionRecovered(stored.flightId)
    notifyRecorderStatus()
  } catch (error) {
    recorderError = error instanceof Error ? error.message : 'Session de vol illisible'
    notifyRecorderStatus()
  }
}

/** Force la dernière sauvegarde avant fermeture normale de l'application. */
export function flushFlightRecorder(): void {
  if (lastTelemetry) persistFlightSession(lastTelemetry, true)
}

function snapshotEngineStates(telemetry: SimTelemetry): Record<string, boolean> {
  const snapshot: Record<string, boolean> = {}
  for (const engine of ENGINE_DEFINITIONS) snapshot[engine.key as string] = telemetry[engine.key] as boolean
  return snapshot
}

export function armFlight(flightId: number): void {
  // Reprise d'un vol déjà "in_progress" (armedFlightId perdu après un redémarrage de l'app, par
  // exemple) : par définition ce vol a déjà quitté le parking, donc on réarme directement en phase
  // "departed"/déjà-en-l'air plutôt que "armed"/au-sol, sinon la machine à états attendrait à tort
  // un décollage qui a déjà eu lieu et ne détecterait jamais correctement l'atterrissage à venir.
  // Les données déjà écoulées (heure moteur, carburant au départ, trajectoire du début du vol) sont
  // en revanche irrémédiablement perdues : seule la suite du vol est suivie à partir de maintenant.
  const flight = getFlightWithRelationsById(flightId)
  const isResuming = flight?.status === 'in_progress'

  armedFlightId = flightId
  tickState = isResuming
    ? { phase: 'departed', airborneObserved: true, onBlocksStreak: 0 }
    : { phase: 'armed', airborneObserved: false, onBlocksStreak: 0 }
  actualDepartureIso = null
  previousTelemetry = null
  eventFlags = isResuming ? { ...INITIAL_FLIGHT_EVENT_FLAGS, wasAirborne: true } : INITIAL_FLIGHT_EVENT_FLAGS
  events = []

  const ofpJson = getFlightOfpJson(flightId)
  plannedCruiseAltitudeFeet = ofpJson ? (parseOfpDetail(ofpJson)?.cruiseAltitudeFeet ?? null) : null

  engineStartIso = null
  engineStopIso = null
  fuelAtEngineStartKg = null
  fuelAtTakeoffKg = null
  fuelAtTouchdownKg = null
  fuelAtEngineStopKg = null
  lastLandingSimTimeIso = null

  flightPath = []
  approachProfile = []

  previousLandingSample = null
  landingPrecisionArmed = isResuming
  touchdownStats = null
  awaitingEngineShutdown = false
  sessionStartedAt = new Date().toISOString()
  lastPersistedAtMs = 0
  sampleCount = 0
  recoveredSession = false
  recorderError = null
  notifyRecorderStatus()
}

export function disarmFlight(): void {
  const flightId = armedFlightId
  armedFlightId = null
  tickState = null
  actualDepartureIso = null
  awaitingEngineShutdown = false
  sessionStartedAt = null
  recoveredSession = false
  if (flightId !== null) deleteFlightSession(flightId)
  notifyRecorderStatus()
}

export function getArmedFlightId(): number | null {
  return armedFlightId
}

/** Heure de départ réelle (off-blocks) du vol armé, une fois observée — null tant qu'il n'a pas encore quitté le parking. */
export function getActualDepartureIso(): string | null {
  return actualDepartureIso
}

export function onFlightEvent(listener: (event: FlightEvent) => void): () => void {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

export function getFlightEvents(): FlightEvent[] {
  return events
}

/** Trajectoire accumulée du vol armé en cours — permet de redessiner le tracé déjà volé quand on
 * revient sur la page Suivi de vol après l'avoir quittée, plutôt que de repartir d'un tracé vide. */
export function getLiveFlightPath(): PirepFlightPathPoint[] {
  return flightPath
}

function pushEvent(event: FlightEvent): void {
  events.push(event)
  if (events.length > MAX_EVENTS) events.shift()
  for (const listener of eventListeners) listener(event)
}

export function handleTelemetryTick(telemetry: SimTelemetry): void {
  // SimConnect reste connecté et peut continuer à publier des valeurs anciennes/transitoires dans
  // les menus MSFS. Ces ticks ne doivent ni créer d'évènement, ni arrêter un moteur, ni alimenter
  // les tendances opérationnelles d'un vol récupéré.
  if (telemetry.simulationActive === false) return
  lastTelemetry = telemetry

  // Capture "en attente" d'une coupure moteur survenue après la clôture d'un vol précédent —
  // active même quand aucun vol n'est actuellement armé, voir completeArmedFlight().
  if (pendingEngineStopCapture) {
    if (pendingEngineStates) {
      for (const engine of ENGINE_DEFINITIONS) {
        const wasOn = pendingEngineStates[engine.key as string]
        const isOn = telemetry[engine.key] as boolean
        if (wasOn !== isOn) {
          pendingEngineEvents.push({
            simTimeIso: telemetry.simZuluIso,
            type: isOn ? 'engine_start' : 'engine_stop',
            severity: 'info',
            message: `${engine.label} ${isOn ? 'démarré' : 'coupé'}`
          })
        }
      }
      pendingEngineStates = snapshotEngineStates(telemetry)
    }

    if (pendingCaptureWasEnginesRunning && !telemetry.enginesRunning) {
      const blockTimeMinutes = pendingEngineStopCapture.engineStartIso
        ? Math.max(
            0,
            Math.round(
              (new Date(telemetry.simZuluIso).getTime() - new Date(pendingEngineStopCapture.engineStartIso).getTime()) / 60000
            )
          )
        : null
      updatePirepEngineStop(pendingEngineStopCapture.pirepId, telemetry.simZuluIso, telemetry.fuelTotalWeight, blockTimeMinutes)
      if (pendingEngineEvents.length > 0) {
        appendPirepEvents(pendingEngineStopCapture.pirepId, pendingEngineEvents)
      }
      pendingEngineStopCapture = null
      pendingEngineStates = null
      pendingEngineEvents = []
    } else {
      pendingCaptureWasEnginesRunning = telemetry.enginesRunning
    }
  }

  if (armedFlightId === null || tickState === null) return

  const isFirstTick = previousTelemetry === null
  if (isFirstTick) {
    pushEvent({
      simTimeIso: telemetry.simZuluIso,
      type: 'aircraft',
      severity: 'info',
      message: `Avion : ${telemetry.title || 'non renseigné'}`
    })
  }

  // Vérifié à chaque tick (pas seulement le premier) : le vol a pu être armé avant OU après le
  // démarrage des moteurs, et selon l'avion la transition false->true peut ne jamais être vue
  // proprement par evaluateFlightEvents (tick manqué, etc.) — dès qu'on observe des moteurs en
  // marche sans heure de départ officielle enregistrée, on la prend comme meilleure estimation.
  if (engineStartIso === null && telemetry.enginesRunning) {
    engineStartIso = telemetry.simZuluIso
    fuelAtEngineStartKg = telemetry.fuelTotalWeight

    // Sur le tout premier tick, evaluateFlightEvents ne peut pas détecter la transition (pas de
    // "previous" à comparer) : si des moteurs tournaient déjà à l'armement du vol, leurs évènements
    // "Moteur N démarré" ne seraient sinon jamais loggés alors que l'heure est bien capturée ci-dessus.
    if (isFirstTick) {
      for (const engine of ENGINE_DEFINITIONS) {
        if (telemetry[engine.key]) {
          pushEvent({
            simTimeIso: telemetry.simZuluIso,
            type: 'engine_start',
            severity: 'info',
            message: `${engine.label} démarré`
          })
        }
      }
    }
  }

  // Indépendant des évènements ci-dessous (pas "le premier engine_stop reçu", mais "plus aucun
  // moteur en marche") : sur un multimoteur, evaluateFlightEvents émet un engine_stop par moteur
  // coupé, et le temps de bloc doit être pris à la coupure du dernier, pas du premier.
  if (engineStartIso !== null && engineStopIso === null && !telemetry.enginesRunning) {
    engineStopIso = telemetry.simZuluIso
    fuelAtEngineStopKg = telemetry.fuelTotalWeight
  }

  const telemetryBeforeTick = previousTelemetry
  const { events: newEvents, nextFlags } = evaluateFlightEvents(telemetryBeforeTick, telemetry, eventFlags, plannedCruiseAltitudeFeet)
  eventFlags = nextFlags
  previousTelemetry = telemetry
  for (const event of newEvents) {
    pushEvent(event)

    if (event.type === 'takeoff') {
      landingPrecisionArmed = true
      // Pas de garde "une seule fois" : un rebond au pushback déclenche aussi un évènement
      // "Décollage" (seul l'atterrissage est filtré, voir MINIMUM_FLIGHT_DURATION_SECONDS), donc se
      // figer sur le premier décollage vu figerait ce carburant au moment du rebond plutôt qu'au
      // vrai décollage. Toujours prendre le plus récent — le dernier "Décollage" du vol est le bon.
      fuelAtTakeoffKg = telemetry.fuelTotalWeight

      if (actualDepartureIso) {
        const taxiOutMinutes = (new Date(event.simTimeIso).getTime() - new Date(actualDepartureIso).getTime()) / 60000
        if (taxiOutMinutes >= 0) {
          pushEvent({
            simTimeIso: event.simTimeIso,
            type: 'taxi_out',
            severity: 'info',
            message: `Roulage avant décollage : ${formatDelayDuration(taxiOutMinutes)}`
          })
        }
      }
    }
    if (event.type === 'landing') {
      fuelAtTouchdownKg = telemetry.fuelTotalWeight
      lastLandingSimTimeIso = event.simTimeIso
    }
  }

  if (awaitingEngineShutdown && !telemetry.enginesRunning) {
    completeArmedFlight(telemetry.simZuluIso)
    return
  }

  const previousPoint = telemetryBeforeTick
  if (flightPath.length < MAX_FLIGHT_PATH_POINTS && isPlausibleMovement(previousPoint, telemetry)) {
    flightPath.push({ lat: telemetry.latitude, lon: telemetry.longitude })
  }
  if (eventFlags.flightPhase === 'descent') {
    approachProfile.push({
      timeIso: telemetry.simZuluIso,
      altitudeFeet: telemetry.altitude,
      groundSpeedKt: telemetry.groundVelocity
    })
  }

  const { transition, nextState } = evaluateTelemetryTick(tickState, telemetry)
  tickState = nextState

  if (transition === 'off_blocks') {
    actualDepartureIso = telemetry.simZuluIso
    setFlightStatus(armedFlightId, 'in_progress')
  } else if (transition === 'on_blocks') {
    // Poussé avant completeArmedFlight() pour être inclus dans `events` au moment où le PIREP est créé.
    if (lastLandingSimTimeIso) {
      const taxiInMinutes = (new Date(telemetry.simZuluIso).getTime() - new Date(lastLandingSimTimeIso).getTime()) / 60000
      if (taxiInMinutes >= 0) {
        pushEvent({
          simTimeIso: telemetry.simZuluIso,
          type: 'taxi_in',
          severity: 'info',
          message: `Roulage après atterrissage : ${formatDelayDuration(taxiInMinutes)}`
        })
      }
    }
    awaitingEngineShutdown = true
    if (!telemetry.enginesRunning) {
      completeArmedFlight(telemetry.simZuluIso)
      return
    }
  }

  persistFlightSession(telemetry, newEvents.length > 0 || transition !== 'none')
}

/** Flux SimConnect haute fréquence dédié à la précision du toucher des roues (voir landingPrecisionLoop). */
export function handleLandingPrecisionTick(sample: LandingPrecisionSample): void {
  if (armedFlightId === null) {
    previousLandingSample = null
    return
  }

  if (previousLandingSample && !previousLandingSample.onGround && sample.onGround && landingPrecisionArmed) {
    // Même filtre anti-rebond que côté évènements (voir MINIMUM_FLIGHT_DURATION_SECONDS) : cette
    // boucle tourne à la fréquence de simulation, donc un rebond au sol juste après le décollage
    // (pushback GSX, l'avion retouche la piste) serait sinon capturé comme le "vrai" toucher des
    // roues avant même que le vol n'ait vraiment décollé — on reste juste armé pour le suivant.
    const secondsSinceTakeoff =
      eventFlags.takeoffSimTimeIso && lastTelemetry
        ? (new Date(lastTelemetry.simZuluIso).getTime() - new Date(eventFlags.takeoffSimTimeIso).getTime()) / 1000
        : null

    if (
      (secondsSinceTakeoff === null || secondsSinceTakeoff >= MINIMUM_FLIGHT_DURATION_SECONDS) &&
      (eventFlags.airborneQualified || eventFlags.takeoffSimTimeIso === null)
    ) {
      touchdownStats = {
        verticalSpeedFpm: previousLandingSample.verticalSpeed,
        gForce: previousLandingSample.gForce,
        pitchDegrees: previousLandingSample.pitchDegrees,
        bankDegrees: previousLandingSample.bankDegrees,
        airspeedKt: previousLandingSample.airspeedKt
      }
      landingPrecisionArmed = false
    }
  }

  previousLandingSample = sample
}

/** Filet de sécurité si la détection automatique de l'atterrissage échoue. */
export function completeManually(): void {
  if (armedFlightId === null || !lastTelemetry) return
  completeArmedFlight(lastTelemetry.simZuluIso)
}

function completeArmedFlight(actualArrivalIso: string): void {
  if (armedFlightId === null) return
  const flightId = armedFlightId
  const flight = getFlightWithRelationsById(flightId)
  if (!flight) {
    disarmFlight()
    return
  }

  const departureIso = actualDepartureIso ?? flight.scheduledDeparture
  const outcome = computePirepOutcome(flight.scheduledDeparture, departureIso, actualArrivalIso)

  setFlightStatus(flightId, outcome.status)
  if (outcome.status === 'completed') {
    const blockTimeMinutes =
      engineStartIso && engineStopIso
        ? Math.max(0, Math.round((new Date(engineStopIso).getTime() - new Date(engineStartIso).getTime()) / 60000))
        : null

    const pirepId = createPirep({
      flightId,
      actualDepartureTime: departureIso,
      actualArrivalTime: actualArrivalIso,
      flightTimeMinutes: outcome.flightTimeMinutes,
      delayMinutes: outcome.delayMinutes,
      delayBucket: outcome.delayBucket,
      engineStartTime: engineStartIso,
      engineStopTime: engineStopIso,
      blockTimeMinutes,
      touchdownVerticalSpeedFpm: touchdownStats?.verticalSpeedFpm ?? null,
      touchdownGForce: touchdownStats?.gForce ?? null,
      touchdownPitchDegrees: touchdownStats?.pitchDegrees ?? null,
      touchdownBankDegrees: touchdownStats?.bankDegrees ?? null,
      touchdownAirspeedKt: touchdownStats?.airspeedKt ?? null,
      fuelAtEngineStartKg,
      fuelAtTakeoffKg,
      fuelAtTouchdownKg,
      fuelAtEngineStopKg,
      flightPath,
      approachProfile,
      events
    })

    // Moteurs pas encore coupés à l'arrivée au parking (fréquent : le pilote finit ses vérifs
    // après s'être arrêté) — on continue de guetter la coupure pour compléter le PIREP après coup.
    if (engineStopIso === null) {
      pendingEngineStopCapture = { pirepId, engineStartIso }
      pendingCaptureWasEnginesRunning = true
      pendingEngineStates = lastTelemetry ? snapshotEngineStates(lastTelemetry) : null
      pendingEngineEvents = []
    }
  }

  disarmFlight()
}
