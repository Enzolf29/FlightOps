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

const MAX_EVENTS = 300
const MAX_FLIGHT_PATH_POINTS = 20_000

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
}

export function disarmFlight(): void {
  armedFlightId = null
  tickState = null
  actualDepartureIso = null
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

  const { events: newEvents, nextFlags } = evaluateFlightEvents(previousTelemetry, telemetry, eventFlags, plannedCruiseAltitudeFeet)
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

  if (flightPath.length < MAX_FLIGHT_PATH_POINTS) {
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
    completeArmedFlight(telemetry.simZuluIso)
  }
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

    if (secondsSinceTakeoff === null || secondsSinceTakeoff >= MINIMUM_FLIGHT_DURATION_SECONDS) {
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
