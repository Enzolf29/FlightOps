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
/** GSX documente le débarquement avec la même convention d'états que l'embarquement (voir
 * gsxBoardingState) : 5 = service en cours, 6 = terminé. */
const GSX_DEBOARDING_COMPLETE_STATE = 6
// Le débarquement GSX (portes, passerelle/escalier, sortie des passagers) peut prendre plus de
// temps qu'une simple annonce cabine — filet de sécurité plus généreux que l'ancien délai
// (5 min) pour ne pas clôturer le vol en pleine opération sol si la confirmation venait à manquer.
const PENDING_ARRIVAL_SAFETY_TIMEOUT_MS = 10 * 60 * 1000
/**
 * Moteurs coupés, avion au parking : le vol reste armé tant que l'annonce de débarquement (si elle
 * doit être jouée) n'est pas terminée ET, le cas échéant, tant que le débarquement GSX n'est pas
 * réellement achevé — plutôt que d'être tronqué par le désarmement immédiat du vol. L'heure
 * d'arrivée officielle (actualArrivalIso, capturée à la coupure moteurs) n'est pas affectée par
 * cette attente — voir beginPendingArrivalCompletion/confirmArrivalComplete/tryCompletePendingArrival.
 */
interface PendingArrivalConfirmation {
  actualArrivalIso: string
  announcementConfirmed: boolean
  /** GSX a été détecté à un moment ou un autre de ce vol (embarquement, repoussage...) — le
   * débarquement est alors jugé "applicable" et sa fin réellement attendue. Décidé une fois pour
   * toutes à la coupure moteurs plutôt que reguetté pendant l'attente : sinon, un joueur qui
   * n'appelle le débarquement GSX qu'après la fin de l'annonce cabine (déjà confirmée) verrait son
   * vol se clôturer avant même que le service ne démarre. */
  gsxApplicable: boolean
  gsxDeboardingComplete: boolean
}
let pendingArrivalConfirmation: PendingArrivalConfirmation | null = null
let pendingArrivalTimeoutHandle: ReturnType<typeof setTimeout> | null = null
/** Vrai dès que GSX a été observé actif (embarquement, repoussage) à un moment de ce vol — voir
 * PendingArrivalConfirmation.gsxApplicable. Réinitialisé à chaque armement de vol. */
let gsxObservedThisFlight = false
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
let pendingEngineStopCapture: {
  pirepId: number
  engineStartIso: string | null
  lastLandingSimTimeIso: string | null
} | null = null
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
  gsxObservedThisFlight: boolean
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
    awaitingEngineShutdown,
    gsxObservedThisFlight
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
    gsxObservedThisFlight = state.gsxObservedThisFlight ?? false
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
  gsxObservedThisFlight = false
  cancelPendingArrivalCompletion()
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
  cancelPendingArrivalCompletion()
  sessionStartedAt = null
  recoveredSession = false
  if (flightId !== null) deleteFlightSession(flightId)
  notifyRecorderStatus()
}

/**
 * Moteurs coupés, avion au parking : n'achève pas le vol tout de suite — laisse le temps à
 * l'annonce de débarquement de se jouer en entier (voir confirmArrivalComplete, déclenché côté
 * renderer) et, le cas échéant, au débarquement GSX de réellement se terminer (voir
 * tryCompletePendingArrival). Filet de sécurité : clôture quand même le vol après
 * PENDING_ARRIVAL_SAFETY_TIMEOUT_MS si ces conditions n'arrivent jamais à être réunies (annonces
 * désactivées côté renderer fermé, service GSX jamais confirmé terminé, etc.).
 */
function beginPendingArrivalCompletion(actualArrivalIso: string, telemetry: SimTelemetry): void {
  pendingArrivalConfirmation = {
    actualArrivalIso,
    announcementConfirmed: false,
    gsxApplicable: gsxObservedThisFlight,
    gsxDeboardingComplete: (telemetry.gsxDeboardingState ?? 0) === GSX_DEBOARDING_COMPLETE_STATE
  }
  pendingArrivalTimeoutHandle = setTimeout(() => {
    pendingArrivalTimeoutHandle = null
    if (!pendingArrivalConfirmation) return
    const { actualArrivalIso: arrivalIso } = pendingArrivalConfirmation
    cancelPendingArrivalCompletion()
    completeArmedFlight(arrivalIso)
  }, PENDING_ARRIVAL_SAFETY_TIMEOUT_MS)
}

function cancelPendingArrivalCompletion(): void {
  if (pendingArrivalTimeoutHandle) clearTimeout(pendingArrivalTimeoutHandle)
  pendingArrivalTimeoutHandle = null
  pendingArrivalConfirmation = null
}

/**
 * Clôture le vol en attente (voir beginPendingArrivalCompletion) dès que toutes les conditions
 * applicables sont réunies : l'annonce de débarquement confirmée terminée côté renderer, et — si
 * GSX a été utilisé à un moment de ce vol (gsxApplicable) — la fin réelle du débarquement GSX
 * également. Sans effet tant qu'il en manque une, ou si aucune clôture n'est en attente.
 */
function tryCompletePendingArrival(): void {
  if (!pendingArrivalConfirmation) return
  const { announcementConfirmed, gsxApplicable, gsxDeboardingComplete, actualArrivalIso } = pendingArrivalConfirmation
  if (!announcementConfirmed) return
  if (gsxApplicable && !gsxDeboardingComplete) return
  cancelPendingArrivalCompletion()
  completeArmedFlight(actualArrivalIso)
}

/**
 * Appelé par le renderer une fois l'annonce de débarquement terminée, ou immédiatement si aucune
 * n'est prévue pour ce vol — ne clôture le vol que si le débarquement GSX (le cas échéant) est lui
 * aussi terminé, voir tryCompletePendingArrival. Sans effet si aucune clôture n'est en attente (vol
 * déjà désarmé manuellement, appel tardif, etc.). L'heure d'arrivée officielle (coupure moteurs)
 * n'est pas affectée : elle reste celle capturée au moment de beginPendingArrivalCompletion, pas
 * l'heure de cet appel.
 */
export function confirmArrivalComplete(): void {
  if (!pendingArrivalConfirmation) return
  pendingArrivalConfirmation.announcementConfirmed = true
  tryCompletePendingArrival()
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

function createTaxiInEvent(landingIso: string | null, enginesStoppedIso: string): FlightEvent | null {
  if (!landingIso) return null
  const taxiInMinutes = (new Date(enginesStoppedIso).getTime() - new Date(landingIso).getTime()) / 60000
  if (!Number.isFinite(taxiInMinutes) || taxiInMinutes < 0) return null
  return {
    simTimeIso: enginesStoppedIso,
    type: 'taxi_in',
    severity: 'info',
    message: `Roulage après atterrissage : ${formatDelayDuration(taxiInMinutes)}`
  }
}

export function handleTelemetryTick(telemetry: SimTelemetry): void {
  // SimConnect reste connecté et peut continuer à publier des valeurs anciennes/transitoires dans
  // les menus MSFS. Ces ticks ne doivent ni créer d'évènement, ni arrêter un moteur, ni alimenter
  // les tendances opérationnelles d'un vol récupéré. Idem pendant une pause : l'horloge Zulu du sim
  // (simZuluIso) est alors figée, donc tout évènement confirmé pendant ce laps de temps serait
  // horodaté avec l'heure gelée d'avant-pause plutôt qu'avec le moment réel de la confirmation.
  if (telemetry.simulationActive === false || telemetry.simulationPaused === true) return
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
      const taxiInEvent = createTaxiInEvent(pendingEngineStopCapture.lastLandingSimTimeIso, telemetry.simZuluIso)
      if (taxiInEvent) pendingEngineEvents.push(taxiInEvent)
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

  if (!gsxObservedThisFlight && ((telemetry.gsxBoardingState ?? 0) > 0 || (telemetry.gsxDepartureState ?? 0) > 0 || (telemetry.gsxDeboardingState ?? 0) > 0)) {
    gsxObservedThisFlight = true
  }

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
  //
  // Cette coupure n'est PAS définitive tant que le vol n'est pas clôturé : sur certains avions
  // tiers, le N1 (secours utilisé quand GENERAL ENG COMBUSTION reste bloqué, voir telemetryLoop)
  // peut rester sous le seuil "moteur en marche" pendant un roulage prolongé à très faible
  // puissance, confirmé "coupé" par l'anti-rebond, avant de remonter quand le pilote redonne un
  // peu de gaz. Si un moteur est ensuite revu en marche, cette coupure était un faux positif — on
  // l'efface pour ne garder que la vraie coupure finale, sans quoi "Arrivée officielle"/temps de
  // bloc restent figés sur cet instant bien antérieur à la coupure moteur réelle.
  if (engineStartIso !== null) {
    if (telemetry.enginesRunning) {
      if (engineStopIso !== null) {
        engineStopIso = null
        fuelAtEngineStopKg = null
      }
    } else if (engineStopIso === null) {
      engineStopIso = telemetry.simZuluIso
      fuelAtEngineStopKg = telemetry.fuelTotalWeight
    }
  }

  // Vol en attente de clôture (moteurs coupés, annonce de débarquement et/ou débarquement GSX pas
  // encore terminés, voir beginPendingArrivalCompletion) : si un moteur redémarre entre-temps, la
  // coupure était provisoire (roulage vers un autre point de parking, etc.) — on annule l'attente
  // et on reprend le suivi normal. Sinon, on continue de guetter la fin du débarquement GSX ici à
  // chaque tick (l'annonce, elle, est confirmée côté renderer — voir confirmArrivalComplete).
  if (pendingArrivalConfirmation !== null) {
    if (telemetry.enginesRunning) {
      cancelPendingArrivalCompletion()
    } else {
      if ((telemetry.gsxDeboardingState ?? 0) === GSX_DEBOARDING_COMPLETE_STATE) {
        pendingArrivalConfirmation.gsxDeboardingComplete = true
      }
      tryCompletePendingArrival()
      if (armedFlightId !== null) persistFlightSession(telemetry)
      return
    }
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
    const taxiInEvent = createTaxiInEvent(lastLandingSimTimeIso, telemetry.simZuluIso)
    if (taxiInEvent) pushEvent(taxiInEvent)
    beginPendingArrivalCompletion(telemetry.simZuluIso, telemetry)
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
    awaitingEngineShutdown = true
    if (!telemetry.enginesRunning) {
      const taxiInEvent = createTaxiInEvent(lastLandingSimTimeIso, telemetry.simZuluIso)
      if (taxiInEvent) pushEvent(taxiInEvent)
      beginPendingArrivalCompletion(telemetry.simZuluIso, telemetry)
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
      pendingEngineStopCapture = { pirepId, engineStartIso, lastLandingSimTimeIso }
      pendingCaptureWasEnginesRunning = true
      pendingEngineStates = lastTelemetry ? snapshotEngineStates(lastTelemetry) : null
      pendingEngineEvents = []
    }
  }

  disarmFlight()
}
