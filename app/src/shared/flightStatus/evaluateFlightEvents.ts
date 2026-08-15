import type { SimTelemetry } from '../types/simconnect'

export type FlightEventType =
  | 'aircraft'
  | 'takeoff'
  | 'landing'
  | 'hard_landing'
  | 'taxi_out'
  | 'taxi_in'
  | 'flaps'
  | 'gear'
  | 'ground_overspeed'
  | 'ground_overspeed_end'
  | 'bank_angle'
  | 'engine_start'
  | 'engine_stop'
  | 'lights'
  | 'cruise'
  | 'descent'
  | 'altitude_level'
  | 'air_overspeed'
  | 'air_overspeed_end'

export interface FlightEvent {
  simTimeIso: string
  type: FlightEventType
  severity: 'info' | 'warning'
  message: string
}

export type FlightPhase = 'ground' | 'climb' | 'cruise' | 'descent'

export interface FlightEventFlags {
  wasAirborne: boolean
  bankExceeded: boolean
  flightPhase: FlightPhase
  airOverspeedExceeded: boolean
  airOverspeedMaxKt: number
  groundOverspeedExceeded: boolean
  groundOverspeedMaxKt: number
  /** Ticks consécutifs avec vitesse sol strictement croissante — roulage décollage en cours. */
  groundAccelStreak: number
  /** Vrai depuis l'atterrissage jusqu'à ce que la vitesse sol repasse sous le seuil de survitesse. */
  landingRolloutActive: boolean
  /** Dernier palier d'altitude enregistré (pieds), pour ne loguer qu'un changement réel de palier. */
  levelAltitudeFeet: number | null
  /** Phase candidate en cours de confirmation (débounce), avant de basculer flightPhase pour de bon. */
  pendingPhase: FlightPhase | null
  pendingPhaseStreak: number
  /** Heure du dernier décollage détecté (chaque nouveau décollage la remet à jour) — sert à ignorer
   * un rebond au sol juste après comme un faux atterrissage, voir MINIMUM_FLIGHT_DURATION_SECONDS. */
  takeoffSimTimeIso: string | null
  /** Dernier état confirmé (loggé) de chaque circuit lumière — distinct de la valeur brute lue au
   * tick courant, voir pendingLightStates/LIGHT_CONFIRM_TICKS. */
  confirmedLightStates: Partial<Record<string, boolean>>
  /** Changement d'état en cours de confirmation par circuit lumière, avant de vraiment loguer le
   * changement — un simvar qui vacille une fraction de seconde (transition d'animation, glitch de
   * l'addon) ne doit pas spammer le journal du même feu qui "s'allume" et "s'éteint" en rafale. */
  pendingLightStates: Partial<Record<string, { candidateOn: boolean; streak: number }>>
  /** Repli si FLAPS HANDLE INDEX ne bouge jamais sur cet avion (certains addons custom ne le
   * pilotent pas) : dernière position de volets en % confirmée, mise à jour seulement une fois le
   * mouvement stabilisé (voir flapsSettleStreak) pour éviter de loguer pendant l'animation. */
  lastLoggedFlapsPercent: number | null
  flapsSettleStreak: number
}

export const INITIAL_FLIGHT_EVENT_FLAGS: FlightEventFlags = {
  wasAirborne: false,
  bankExceeded: false,
  flightPhase: 'ground',
  airOverspeedExceeded: false,
  airOverspeedMaxKt: 0,
  groundOverspeedExceeded: false,
  groundOverspeedMaxKt: 0,
  groundAccelStreak: 0,
  landingRolloutActive: false,
  levelAltitudeFeet: null,
  pendingPhase: null,
  pendingPhaseStreak: 0,
  takeoffSimTimeIso: null,
  confirmedLightStates: {},
  pendingLightStates: {},
  lastLoggedFlapsPercent: null,
  flapsSettleStreak: 0
}

/** Repli volets : en dessous de ce seuil de variation par tick, considérés à l'arrêt. */
const FLAPS_MOVEMENT_EPSILON_PERCENT = 2
/** Ticks consécutifs quasi immobiles avant de considérer le mouvement de volets terminé. */
const FLAPS_SETTLE_TICKS = 2
/** Écart minimal en % depuis la dernière position confirmée pour compter comme un vrai changement
 * (repli volets, voir plus bas). */
const FLAPS_PERCENT_EPSILON = 3

const GROUND_OVERSPEED_KNOTS = 30
/** Marge sous GROUND_OVERSPEED_KNOTS avant de considérer la survitesse terminée (hystérésis) — sans
 * ça, une vitesse qui oscille pile autour du seuil (ex. un pilote qui tente de rester à 30kt tapant)
 * redéclenche un nouveau "début"/"fin" de survitesse à chaque petite fluctuation. */
const GROUND_OVERSPEED_RECOVER_KNOTS = 27
/**
 * Nombre de ticks consécutifs de vitesse sol croissante avant de considérer qu'on est en plein
 * roulage décollage plutôt qu'en train d'accélérer pendant un roulage rapide au sol — un vrai
 * roulage décollage accélère sans interruption pendant 25-45s, alors qu'un roulage rapide marque
 * quasi toujours une pause/un palier avant ce délai. Plus robuste qu'un seuil d'accélération
 * instantané, qui peut ponctuellement repasser sous le seuil pile au moment critique (30kt).
 */
const TAKEOFF_ROLL_STREAK_TICKS = 5
export const HARD_LANDING_VS_FPM = -600
const BANK_ANGLE_LIMIT_DEGREES = 30
/**
 * Durée minimale (secondes) depuis le dernier décollage avant qu'un contact au sol compte comme
 * un véritable atterrissage — un rebond (pushback GSX au parking, l'avion retouche la piste au
 * décollage) reproduit exactement la même transition air->sol qu'un atterrissage, mais dans les
 * toutes premières secondes après avoir quitté le sol. En dessous de ce seuil, le contact est
 * ignoré (ni "Atterrissage" ni "Atterrissage dur" ni capture des stats de toucher) : la prochaine
 * envolée relance simplement le chrono.
 */
export const MINIMUM_FLIGHT_DURATION_SECONDS = 20
/**
 * Ticks consécutifs dans le même état avant de vraiment loguer un changement de circuit lumière —
 * certains avions/addons font vaciller le simvar (transition d'animation, logique auto instable)
 * pendant une fraction de seconde, ce qui spammait le journal du même feu "allumé"/"éteint" en
 * rafale. Un vrai changement de switch reste dans le nouvel état bien plus longtemps que ça.
 */
const LIGHT_CONFIRM_TICKS = 2

const CRUISE_MIN_ALTITUDE_FEET = 10_000
/**
 * Marge sous l'altitude de croisière planifiée (OFP SimBrief) en-dessous de laquelle un palier
 * n'est pas encore considéré comme la croisière — un palier ATC temporaire en pleine montée (ex.
 * FL110 en attente d'une clairance) ne doit pas se faire passer pour "Arrivée en croisière".
 */
const CRUISE_ALTITUDE_TOLERANCE_FEET = 500
const LEVEL_VS_THRESHOLD_FPM = 300
const CLIMB_VS_THRESHOLD_FPM = 500
const DESCENT_VS_THRESHOLD_FPM = -500
/**
 * Ticks consécutifs dans la même phase candidate avant de vraiment basculer flightPhase — sans ça,
 * une vitesse verticale qui oscille autour d'un seuil (turbulence, correction d'autopilote) fait
 * flip-flop croisière/descente à chaque tick et redéclenche l'évènement à chaque fois.
 */
const PHASE_CHANGE_STREAK_TICKS = 5
/** Écart minimal (pieds) avec le dernier palier enregistré pour compter comme un nouveau palier
 * plutôt qu'une fluctuation de maintien d'altitude. */
const MIN_ALTITUDE_STEP_FEET = 500

/** Limite réglementaire (250kt sous 10 000ft) — gardée pour référence/messages, mais le
 * déclenchement réel utilise AIR_OVERSPEED_TRIGGER_KNOTS avec une marge de tolérance : un pilote
 * qui "tient 250" oscille de quelques nœuds autour de cette valeur par imprécision normale des
 * commandes/instruments, et se faire signaler une survitesse en étant pile à la limite n'a pas de
 * sens opérationnel — seul un dépassement réel doit compter. */
const AIR_OVERSPEED_KNOTS = 250
/** Déclenchement réel : quelques nœuds au-dessus de la limite pour absorber l'imprécision normale
 * de tenue de vitesse, sans pour autant tolérer un vrai excès. */
const AIR_OVERSPEED_TRIGGER_KNOTS = 255
/** Marge sous le déclenchement avant de considérer la survitesse terminée (hystérésis) — sans ça,
 * une vitesse qui oscille autour du seuil redéclenche un nouveau "début"/"fin" à chaque micro-écart. */
const AIR_OVERSPEED_RECOVER_KNOTS = 248
const AIR_OVERSPEED_MAX_ALTITUDE_FEET = 10_000

export const ENGINE_DEFINITIONS: Array<{ key: keyof SimTelemetry; label: string }> = [
  { key: 'engine1Running', label: 'Moteur 1' },
  { key: 'engine2Running', label: 'Moteur 2' },
  { key: 'engine3Running', label: 'Moteur 3' },
  { key: 'engine4Running', label: 'Moteur 4' }
]

// Uniquement les feux d'atterrissage : sur certains avions/addons, les autres circuits (logo, aile,
// navigation, anticollision...) sont pilotés par une logique automatique qui les fait cycler on/off
// toutes les quelques secondes en continu — même avec un débounce, ça spamme le journal en boucle.
// Les feux d'atterrissage restent un vrai geste pilote ponctuel, donc utiles à loguer.
const LIGHT_DEFINITIONS: Array<{ key: keyof SimTelemetry; label: string }> = [
  { key: 'landingLightsOn', label: 'Feux d’atterrissage' }
]

function makeEvent(current: SimTelemetry, type: FlightEventType, severity: 'info' | 'warning', message: string): FlightEvent {
  return { simTimeIso: current.simZuluIso, type, severity, message }
}

/**
 * Étiquette un cran de volets ("rentrés", "1", "2"… "FULL") à partir de l'index de la commande et
 * du nombre total de crans de l'avion courant — s'adapte automatiquement à chaque appareil au lieu
 * de supposer un nombre de crans fixe (un A220 et un 737 n'ont pas les mêmes crans).
 */
function formatFlapsDetent(index: number, numPositions: number): string {
  if (index <= 0) return 'rentrés'
  if (numPositions > 0 && index >= numPositions - 1) return 'FULL'
  return String(index)
}

/**
 * Un pas d'analyse d'évènements, pure et testable indépendamment de SimConnect. Compare le tick
 * précédent au tick courant pour détecter les transitions/franchissements de seuil.
 */
export function evaluateFlightEvents(
  previous: SimTelemetry | null,
  current: SimTelemetry,
  flags: FlightEventFlags,
  plannedCruiseAltitudeFeet: number | null = null
): { events: FlightEvent[]; nextFlags: FlightEventFlags } {
  if (!previous) {
    return { events: [], nextFlags: flags }
  }

  const cruiseAltitudeThresholdFeet =
    plannedCruiseAltitudeFeet !== null
      ? Math.max(CRUISE_MIN_ALTITUDE_FEET, plannedCruiseAltitudeFeet - CRUISE_ALTITUDE_TOLERANCE_FEET)
      : CRUISE_MIN_ALTITUDE_FEET

  const events: FlightEvent[] = []
  let nextFlags = flags

  if (previous.onGround && !current.onGround) {
    events.push(makeEvent(current, 'takeoff', 'info', 'Décollage'))
    nextFlags = { ...nextFlags, wasAirborne: true, takeoffSimTimeIso: current.simZuluIso }
  }

  const secondsSinceTakeoff = nextFlags.takeoffSimTimeIso
    ? (new Date(current.simZuluIso).getTime() - new Date(nextFlags.takeoffSimTimeIso).getTime()) / 1000
    : null

  if (
    !previous.onGround &&
    current.onGround &&
    nextFlags.wasAirborne &&
    (secondsSinceTakeoff === null || secondsSinceTakeoff >= MINIMUM_FLIGHT_DURATION_SECONDS)
  ) {
    events.push(makeEvent(current, 'landing', 'info', 'Atterrissage'))
    if (previous.verticalSpeed <= HARD_LANDING_VS_FPM) {
      events.push(
        makeEvent(current, 'hard_landing', 'warning', `Atterrissage dur (${Math.round(previous.verticalSpeed)} ft/min)`)
      )
    }
    nextFlags = { ...nextFlags, landingRolloutActive: true }
  }

  // Le cran de la commande (FLAPS HANDLE INDEX) est un choix discret du pilote — contrairement au
  // pourcentage de volets réel (qui s'anime progressivement pendant plusieurs secondes), il change
  // instantanément avec l'action du pilote, donc pas besoin de débounce ici. Le nombre de crans
  // varie par avion (MSFS le calcule lui-même selon la config de l'appareil), d'où l'étiquette
  // "FULL" dynamique plutôt qu'un cran maximal fixe.
  if (current.flapsHandleIndex !== previous.flapsHandleIndex) {
    events.push(
      makeEvent(
        current,
        'flaps',
        'info',
        `Volets ${formatFlapsDetent(previous.flapsHandleIndex, previous.flapsNumHandlePositions)} → ${formatFlapsDetent(current.flapsHandleIndex, current.flapsNumHandlePositions)}`
      )
    )
  } else {
    // Repli : certains addons (mêmes complexes/custom) ne pilotent jamais FLAPS HANDLE INDEX même
    // si les volets bougent réellement — sans ce filet, ces avions n'auraient jamais aucun
    // évènement volets. On retombe alors sur le pourcentage réel, avec le même débounce
    // "mouvement stabilisé" qu'avant pour ne pas loguer en pleine animation.
    let lastLoggedFlapsPercent = nextFlags.lastLoggedFlapsPercent ?? previous.flapsPercent
    const flapsBarelyMoved = Math.abs(current.flapsPercent - previous.flapsPercent) < FLAPS_MOVEMENT_EPSILON_PERCENT
    const flapsSettleStreak = flapsBarelyMoved ? nextFlags.flapsSettleStreak + 1 : 0

    if (
      flapsSettleStreak >= FLAPS_SETTLE_TICKS &&
      Math.abs(current.flapsPercent - lastLoggedFlapsPercent) >= FLAPS_PERCENT_EPSILON
    ) {
      events.push(
        makeEvent(current, 'flaps', 'info', `Volets ${Math.round(lastLoggedFlapsPercent)}% → ${Math.round(current.flapsPercent)}%`)
      )
      lastLoggedFlapsPercent = current.flapsPercent
    }

    nextFlags = { ...nextFlags, lastLoggedFlapsPercent, flapsSettleStreak }
  }

  if (current.gearHandleDown !== previous.gearHandleDown) {
    const label = current.gearHandleDown ? 'Train sorti' : 'Train rentré'
    events.push(makeEvent(current, 'gear', 'info', `${label} (${Math.round(current.altitude)} ft)`))
  }

  // Un évènement par moteur (pas un seul évènement combiné) : sur un bimoteur, le pilote veut
  // voir "Moteur 1 démarré" puis "Moteur 2 démarré" séparément, dans l'ordre réel de démarrage.
  for (const engine of ENGINE_DEFINITIONS) {
    const currentOn = current[engine.key] as boolean
    const previousOn = previous[engine.key] as boolean
    if (currentOn !== previousOn) {
      events.push(makeEvent(current, currentOn ? 'engine_start' : 'engine_stop', 'info', `${engine.label} ${currentOn ? 'démarré' : 'coupé'}`))
    }
  }

  // Débounce par circuit : un simvar qui vacille (transition d'animation, logique auto instable de
  // certains addons) ne doit pas loguer une rafale de "allumé"/"éteint" pour le même feu. Le nouvel
  // état doit tenir LIGHT_CONFIRM_TICKS ticks d'affilée avant d'être considéré comme réel.
  let confirmedLightStates = nextFlags.confirmedLightStates
  let pendingLightStates = nextFlags.pendingLightStates

  for (const light of LIGHT_DEFINITIONS) {
    const currentOn = current[light.key] as boolean
    let confirmedOn = confirmedLightStates[light.key]
    if (confirmedOn === undefined) {
      // Amorce une seule fois (première évaluation de ce circuit) à partir du tick précédent, puis
      // ne dépend plus jamais de `previous` — sinon la comparaison se recale sur le tick précédent
      // à chaque appel et un changement en cours de confirmation ne peut jamais aboutir.
      confirmedOn = previous[light.key] as boolean
      confirmedLightStates = { ...confirmedLightStates, [light.key]: confirmedOn }
    }

    if (currentOn === confirmedOn) {
      if (pendingLightStates[light.key]) {
        const nextPending = { ...pendingLightStates }
        delete nextPending[light.key]
        pendingLightStates = nextPending
      }
      continue
    }

    const pending = pendingLightStates[light.key]
    const streak = pending && pending.candidateOn === currentOn ? pending.streak + 1 : 1

    if (streak >= LIGHT_CONFIRM_TICKS) {
      events.push(
        makeEvent(current, 'lights', 'info', `${light.label} ${currentOn ? 'allumés' : 'éteints'} (${Math.round(current.altitude)} ft)`)
      )
      confirmedLightStates = { ...confirmedLightStates, [light.key]: currentOn }
      const nextPending = { ...pendingLightStates }
      delete nextPending[light.key]
      pendingLightStates = nextPending
    } else {
      pendingLightStates = { ...pendingLightStates, [light.key]: { candidateOn: currentOn, streak } }
    }
  }

  nextFlags = { ...nextFlags, confirmedLightStates, pendingLightStates }

  const groundAccelStreak = current.onGround && current.groundVelocity > previous.groundVelocity ? flags.groundAccelStreak + 1 : 0
  nextFlags = { ...nextFlags, groundAccelStreak }

  const landingRolloutActive = nextFlags.landingRolloutActive && current.onGround && current.groundVelocity > GROUND_OVERSPEED_KNOTS
  nextFlags = { ...nextFlags, landingRolloutActive }

  const isTakeoffRoll = groundAccelStreak >= TAKEOFF_ROLL_STREAK_TICKS
  const groundOverspeedThreshold = flags.groundOverspeedExceeded ? GROUND_OVERSPEED_RECOVER_KNOTS : GROUND_OVERSPEED_KNOTS
  const groundOverspeedNow =
    current.onGround && current.groundVelocity > groundOverspeedThreshold && !isTakeoffRoll && !landingRolloutActive
  if (groundOverspeedNow) {
    const maxKt = Math.max(flags.groundOverspeedMaxKt, current.groundVelocity)
    if (!flags.groundOverspeedExceeded) {
      events.push(
        makeEvent(current, 'ground_overspeed', 'warning', `Vitesse sol excessive : ${Math.round(current.groundVelocity)} kt`)
      )
    }
    nextFlags = { ...nextFlags, groundOverspeedExceeded: true, groundOverspeedMaxKt: maxKt }
  } else if (flags.groundOverspeedExceeded) {
    events.push(
      makeEvent(
        current,
        'ground_overspeed_end',
        'warning',
        `Fin de survitesse sol — vitesse max atteinte : ${Math.round(flags.groundOverspeedMaxKt)} kt`
      )
    )
    nextFlags = { ...nextFlags, groundOverspeedExceeded: false, groundOverspeedMaxKt: 0 }
  }

  const bankExceededNow = Math.abs(current.bankDegrees) > BANK_ANGLE_LIMIT_DEGREES
  if (bankExceededNow && !flags.bankExceeded) {
    events.push(makeEvent(current, 'bank_angle', 'warning', `Inclinaison excessive : ${Math.round(current.bankDegrees)}°`))
  }
  nextFlags = { ...nextFlags, bankExceeded: bankExceededNow }

  // Phases de vol (croisière/descente) : uniquement en l'air. La vitesse verticale seule décide
  // de la phase "candidate" à chaque tick, mais on ne bascule (et on n'émet l'évènement) qu'après
  // PHASE_CHANGE_STREAK_TICKS ticks consécutifs dans cette même candidate — un débounce contre le
  // bruit de la VS près des seuils.
  if (!current.onGround) {
    const currentPhase = flags.flightPhase === 'ground' ? 'climb' : flags.flightPhase
    const isLevel = Math.abs(current.verticalSpeed) < LEVEL_VS_THRESHOLD_FPM
    let candidatePhase: FlightPhase = currentPhase

    if (current.altitude >= cruiseAltitudeThresholdFeet) {
      if (isLevel) {
        candidatePhase = 'cruise'
      } else if (current.verticalSpeed <= DESCENT_VS_THRESHOLD_FPM) {
        candidatePhase = 'descent'
      } else if (current.verticalSpeed >= CLIMB_VS_THRESHOLD_FPM) {
        candidatePhase = 'climb'
      }
    }

    if (candidatePhase === currentPhase) {
      nextFlags = { ...nextFlags, flightPhase: currentPhase, pendingPhase: null, pendingPhaseStreak: 0 }
    } else {
      const streak = flags.pendingPhase === candidatePhase ? flags.pendingPhaseStreak + 1 : 1
      if (streak >= PHASE_CHANGE_STREAK_TICKS) {
        if (candidatePhase === 'cruise') {
          events.push(makeEvent(current, 'cruise', 'info', 'Arrivée en croisière'))
        }
        if (candidatePhase === 'descent') {
          events.push(makeEvent(current, 'descent', 'info', 'Début de la descente'))
        }
        nextFlags = { ...nextFlags, flightPhase: candidatePhase, pendingPhase: null, pendingPhaseStreak: 0 }
      } else {
        nextFlags = { ...nextFlags, flightPhase: currentPhase, pendingPhase: candidatePhase, pendingPhaseStreak: streak }
      }
    }

    // Paliers d'altitude : pas seulement le premier passage en croisière, mais aussi les step
    // climbs/descents en cours de croisière (l'avion s'allège et remonte de palier, etc.). Gardé
    // sur l'altitude elle-même (pas la phase confirmée), donc pas affecté par le débounce ci-dessus.
    if (isLevel && current.altitude >= cruiseAltitudeThresholdFeet) {
      const roundedAltitude = Math.round(current.altitude / 100) * 100
      if (flags.levelAltitudeFeet === null || Math.abs(roundedAltitude - flags.levelAltitudeFeet) >= MIN_ALTITUDE_STEP_FEET) {
        events.push(makeEvent(current, 'altitude_level', 'info', `Palier atteint : FL${Math.round(roundedAltitude / 100)}`))
        nextFlags = { ...nextFlags, levelAltitudeFeet: roundedAltitude }
      }
    }
  } else {
    nextFlags = { ...nextFlags, flightPhase: 'ground', pendingPhase: null, pendingPhaseStreak: 0 }
  }

  // Survitesse en vol (hors décollage/atterrissage, qui sont au sol donc déjà exclus par !onGround).
  const airOverspeedThreshold = flags.airOverspeedExceeded ? AIR_OVERSPEED_RECOVER_KNOTS : AIR_OVERSPEED_TRIGGER_KNOTS
  const airOverspeedNow =
    !current.onGround && current.altitude < AIR_OVERSPEED_MAX_ALTITUDE_FEET && current.airspeedIndicated > airOverspeedThreshold
  if (airOverspeedNow) {
    const maxKt = Math.max(flags.airOverspeedMaxKt, current.airspeedIndicated)
    if (!flags.airOverspeedExceeded) {
      events.push(
        makeEvent(
          current,
          'air_overspeed',
          'warning',
          `Survitesse : ${Math.round(current.airspeedIndicated)} kt sous 10 000 ft (limite ${AIR_OVERSPEED_KNOTS} kt)`
        )
      )
    }
    nextFlags = { ...nextFlags, airOverspeedExceeded: true, airOverspeedMaxKt: maxKt }
  } else if (flags.airOverspeedExceeded) {
    events.push(
      makeEvent(current, 'air_overspeed_end', 'warning', `Fin de survitesse — vitesse max atteinte : ${Math.round(flags.airOverspeedMaxKt)} kt`)
    )
    nextFlags = { ...nextFlags, airOverspeedExceeded: false, airOverspeedMaxKt: 0 }
  }

  return { events, nextFlags }
}
