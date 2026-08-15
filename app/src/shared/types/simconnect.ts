export type SimConnectStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SimTelemetry {
  latitude: number
  longitude: number
  altitude: number
  headingTrue: number
  bankDegrees: number
  pitchDegrees: number
  gForce: number
  enginesRunning: boolean
  engine1Running: boolean
  engine2Running: boolean
  engine3Running: boolean
  engine4Running: boolean
  landingLightsOn: boolean
  taxiLightsOn: boolean
  strobeLightsOn: boolean
  beaconLightsOn: boolean
  navLightsOn: boolean
  wingLightsOn: boolean
  logoLightsOn: boolean
  airspeedIndicated: number
  groundVelocity: number
  verticalSpeed: number
  onGround: boolean
  parkingBrakeSet: boolean
  gearHandleDown: boolean
  flapsPercent: number
  /** Cran actuel de la commande de volets (0 = rentrés), indépendant du modèle d'avion — MSFS
   * calcule lui-même le nombre de crans réels selon la config de l'appareil. */
  flapsHandleIndex: number
  /** Nombre total de crans de volets pour cet avion (varie selon les modèles) — permet de savoir
   * si le cran actuel est le dernier ("FULL") plutôt que d'utiliser un nombre fixe. */
  flapsNumHandlePositions: number
  fuelTotalWeight: number
  title: string
  atcId: string
  /** Heure Zulu (UTC) du simulateur — jamais l'horloge du PC, cf. calculs de retard. */
  simZuluIso: string
}
