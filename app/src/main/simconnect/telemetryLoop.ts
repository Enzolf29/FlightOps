import { SimConnectConstants, SimConnectDataType, SimConnectPeriod } from 'node-simconnect'
import type { SimConnectConnection, RecvSimObjectData } from 'node-simconnect'
import type { SimTelemetry } from '@shared/types/simconnect'

const DEFINITION_TELEMETRY = 0
const REQUEST_TELEMETRY = 0

export type TelemetryListener = (telemetry: SimTelemetry) => void

const ENGINE_RUNNING_CONFIRM_TICKS = 3

/**
 * Enregistre la définition de données télémétrie et s'abonne au flux SimConnect (1x/seconde).
 * Retourne une fonction de désabonnement à appeler à la déconnexion.
 */
export function startTelemetryLoop(handle: SimConnectConnection, onTick: TelemetryListener): () => void {
  // Anti-rebond de l'état moteur "en marche"/"coupé" — sur certains avions (ex. Synaptic A220, dont
  // le N1 sert de signal de secours, voir plus bas), une lecture peut passer sous le seuil un seul
  // tick avant de remonter (léger creux de N1 en roulage/approche), sans que le moteur soit vraiment
  // coupé. Sans ce filtre, flightStatusDetector fige "heure moteur coupé" sur ce faux positif dès le
  // premier passage sous le seuil et n'observe jamais la vraie coupure survenue plus tard.
  const confirmedEngineRunning = [false, false, false, false]
  const pendingEngineRunning: Array<{ candidate: boolean; streak: number } | null> = [null, null, null, null]

  function debounceEngineRunning(index: number, candidateOn: boolean): boolean {
    if (candidateOn === confirmedEngineRunning[index]) {
      pendingEngineRunning[index] = null
      return confirmedEngineRunning[index]
    }
    const pending = pendingEngineRunning[index]
    const streak = pending && pending.candidate === candidateOn ? pending.streak + 1 : 1
    if (streak >= ENGINE_RUNNING_CONFIRM_TICKS) {
      confirmedEngineRunning[index] = candidateOn
      pendingEngineRunning[index] = null
    } else {
      pendingEngineRunning[index] = { candidate: candidateOn, streak }
    }
    return confirmedEngineRunning[index]
  }

  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64)
  // Altitude indiquée (altimètre calé sur le QNH), pas PLANE ALTITUDE : cette dernière reflète le
  // point de référence du modèle 3D de l'avion (souvent au niveau du fuselage), pas les roues —
  // elle affiche donc toujours plus que l'altitude réelle de l'aéroport une fois au sol.
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'INDICATED ALTITUDE', 'feet', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'PLANE BANK DEGREES', 'degrees', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'PLANE PITCH DEGREES', 'degrees', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'G FORCE', 'GForce', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'GENERAL ENG COMBUSTION:1', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'GENERAL ENG COMBUSTION:2', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'GENERAL ENG COMBUSTION:3', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'GENERAL ENG COMBUSTION:4', 'bool', SimConnectDataType.FLOAT64)
  // Certains avions complexes (moteurs simulés en interne par l'addon, ex. FADEC custom) ne mettent
  // jamais à jour GENERAL ENG COMBUSTION correctement — on croise avec le N1 (turbines) comme signal
  // de secours, presque toujours fiable puisqu'il pilote aussi l'instrument affiché au pilote.
  // GENERAL ENG RPM a été essayé aussi mais retiré : pour un turbofan ce simvar reste parfois bloqué
  // sur une valeur non nulle même moteur coupé, ce qui empêchait de détecter la coupure moteur.
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'TURB ENG N1:1', 'percent', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'TURB ENG N1:2', 'percent', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'TURB ENG N1:3', 'percent', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'TURB ENG N1:4', 'percent', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT LANDING', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT TAXI', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT STROBE', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT BEACON', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT NAV', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT WING', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'LIGHT LOGO', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'AIRSPEED INDICATED', 'knots', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'GROUND VELOCITY', 'knots', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'SIM ON GROUND', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'BRAKE PARKING POSITION', 'position', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'GEAR HANDLE POSITION', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'FLAPS HANDLE PERCENT', 'percent', SimConnectDataType.FLOAT64)
  // Cran de la commande de volets (0 = rentrés) + nombre total de crans pour cet avion — MSFS
  // résout lui-même le nombre réel de crans selon la config de l'appareil, donc ça s'adapte
  // automatiquement à chaque avion sans avoir à connaître ses volets à l'avance.
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'FLAPS HANDLE INDEX', 'number', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'FLAPS NUM HANDLE POSITIONS', 'number', SimConnectDataType.FLOAT64)
  // Synaptic A220 : d'après sa doc officielle (docs.synapticsim.com/pilots/simvars), cet avion ne
  // pilote JAMAIS les simvars volets standards ci-dessus — sa manette de volets est entièrement
  // interne, exposée uniquement via cette L:var custom (0 à 5 = 6 crans). Lue systématiquement
  // (une L:var absente sur les autres avions renvoie simplement 0, sans erreur) et n'écrase les
  // valeurs standards que si le titre de l'appareil indique un A220.
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'L:A22X Flap Lever', 'number', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'FUEL TOTAL QUANTITY WEIGHT', 'kilograms', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'TITLE', null, SimConnectDataType.STRING256)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'ATC ID', null, SimConnectDataType.STRING64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'ZULU TIME', 'seconds', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'ZULU DAY OF MONTH', 'number', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'ZULU MONTH OF YEAR', 'number', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_TELEMETRY, 'ZULU YEAR', 'number', SimConnectDataType.FLOAT64)

  handle.requestDataOnSimObject(
    REQUEST_TELEMETRY,
    DEFINITION_TELEMETRY,
    SimConnectConstants.OBJECT_ID_USER,
    SimConnectPeriod.SECOND
  )

  function handleSimObjectData(recv: RecvSimObjectData): void {
    if (recv.requestID !== REQUEST_TELEMETRY) return

    // L'ordre de lecture doit correspondre exactement à l'ordre des addToDataDefinition ci-dessus.
    const data = recv.data
    const latitude = data.readFloat64()
    const longitude = data.readFloat64()
    const altitude = data.readFloat64()
    const headingTrue = data.readFloat64()
    const bankDegrees = data.readFloat64()
    const pitchDegrees = data.readFloat64()
    const gForce = data.readFloat64()
    const combustion1 = data.readFloat64() >= 0.5
    const combustion2 = data.readFloat64() >= 0.5
    const combustion3 = data.readFloat64() >= 0.5
    const combustion4 = data.readFloat64() >= 0.5
    const n1_1 = data.readFloat64()
    const n1_2 = data.readFloat64()
    const n1_3 = data.readFloat64()
    const n1_4 = data.readFloat64()
    const landingLightsOn = data.readFloat64() >= 0.5
    const taxiLightsOn = data.readFloat64() >= 0.5
    const strobeLightsOn = data.readFloat64() >= 0.5
    const beaconLightsOn = data.readFloat64() >= 0.5
    const navLightsOn = data.readFloat64() >= 0.5
    const wingLightsOn = data.readFloat64() >= 0.5
    const logoLightsOn = data.readFloat64() >= 0.5
    const airspeedIndicated = data.readFloat64()
    const groundVelocity = data.readFloat64()
    const verticalSpeed = data.readFloat64()
    const onGround = data.readFloat64() >= 0.5
    const parkingBrakeSet = data.readFloat64() >= 0.5
    const gearHandleDown = data.readFloat64() >= 0.5
    const flapsPercent = data.readFloat64()
    const flapsHandleIndex = data.readFloat64()
    const flapsNumHandlePositions = data.readFloat64()
    const a22xFlapLever = data.readFloat64()
    const fuelTotalWeight = data.readFloat64()
    const title = data.readString256()
    const atcId = data.readString64()
    const zuluSeconds = data.readFloat64()
    const zuluDay = data.readFloat64()
    const zuluMonth = data.readFloat64()
    const zuluYear = data.readFloat64()

    const N1_RUNNING_THRESHOLD_PERCENT = 15
    const engine1Running = debounceEngineRunning(0, combustion1 || n1_1 > N1_RUNNING_THRESHOLD_PERCENT)
    const engine2Running = debounceEngineRunning(1, combustion2 || n1_2 > N1_RUNNING_THRESHOLD_PERCENT)
    const engine3Running = debounceEngineRunning(2, combustion3 || n1_3 > N1_RUNNING_THRESHOLD_PERCENT)
    const engine4Running = debounceEngineRunning(3, combustion4 || n1_4 > N1_RUNNING_THRESHOLD_PERCENT)

    const isA220 = title.toLowerCase().includes('a220') || title.toLowerCase().includes('a22x')
    const effectiveFlapsHandleIndex = isA220 ? a22xFlapLever : flapsHandleIndex
    const effectiveFlapsNumHandlePositions = isA220 ? 6 : flapsNumHandlePositions

    onTick({
      latitude,
      longitude,
      altitude,
      headingTrue,
      bankDegrees,
      pitchDegrees,
      gForce,
      enginesRunning: engine1Running || engine2Running || engine3Running || engine4Running,
      engine1Running,
      engine2Running,
      engine3Running,
      engine4Running,
      landingLightsOn,
      taxiLightsOn,
      strobeLightsOn,
      beaconLightsOn,
      navLightsOn,
      wingLightsOn,
      logoLightsOn,
      airspeedIndicated,
      groundVelocity,
      verticalSpeed,
      onGround,
      parkingBrakeSet,
      gearHandleDown,
      flapsPercent,
      flapsHandleIndex: Math.round(effectiveFlapsHandleIndex),
      flapsNumHandlePositions: Math.round(effectiveFlapsNumHandlePositions),
      fuelTotalWeight,
      title,
      atcId,
      simZuluIso: new Date(Date.UTC(zuluYear, zuluMonth - 1, zuluDay, 0, 0, zuluSeconds)).toISOString()
    })
  }

  handle.on('simObjectData', handleSimObjectData)

  return () => {
    handle.removeListener('simObjectData', handleSimObjectData)
  }
}
