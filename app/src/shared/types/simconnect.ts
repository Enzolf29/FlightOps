export type SimConnectStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SimTelemetry {
  /** Vrai uniquement lorsqu'une session de vol MSFS est réellement en cours. SimConnect peut
   * rester connecté dans les menus, où aucune automatisation ne doit se déclencher. */
  simulationActive?: boolean
  latitude: number
  longitude: number
  altitude: number
  /** Hauteur au-dessus du sol, utile pour distinguer approche, rebond et vrai vol. */
  altitudeAboveGround?: number
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
  /** État GSX : 5 = service en cours, 6 = terminé. 0 si GSX n'est pas présent. */
  gsxBoardingState?: number
  gsxDepartureState?: number
  /** Nombre cible configuré dans GSX et cumul réellement embarqué sur tous les bus. */
  gsxPassengersTarget?: number
  gsxPassengersBoardedTotal?: number
  /** Progression globale du chargement fret/bagages GSX, de 0 à 100 %. */
  gsxCargoBoardingPercent?: number
  /** L:var GSX activée pendant le repoussage. */
  gsxPushbackFrozen?: boolean
  /** SimConnect TIME OF DAY : 1 aube, 2 jour, 3 crépuscule, 4 nuit. */
  timeOfDay?: number
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
  /** Masses réelles publiées par le modèle de vol MSFS, converties en kilogrammes. */
  totalWeightKg?: number
  emptyWeightKg?: number
  maxGrossWeightKg?: number
  maxZeroFuelWeightKg?: number
  maxTakeoffWeightKg?: number
  maxLandingWeightKg?: number
  title: string
  atcId: string
  /** Heure Zulu (UTC) du simulateur — jamais l'horloge du PC, cf. calculs de retard. */
  simZuluIso: string
  /** Valeurs SimConnect non filtrees, exposees uniquement dans le diagnostic. */
  diagnostics?: {
    combustion: [boolean, boolean, boolean, boolean]
    n1Percent: [number, number, number, number]
    standardFlapsPercent: number
    standardFlapsHandleIndex: number
    standardFlapsPositions: number
    a220FlapLever: number
  }
}

export type FlightRecorderState = 'idle' | 'recording' | 'recovered' | 'error'

export interface FlightRecorderStatus {
  state: FlightRecorderState
  flightId: number | null
  lastSavedAt: string | null
  sampleCount: number
  message: string
}
