export interface Aircraft {
  id: number
  companyId: number
  type: string
  registration: string | null
  simbriefIcaoCode: string | null
  /** "Internal ID" d'un profil avion (airframe) sauvegardé sur SimBrief, pour préremplir un avion précis. */
  simbriefFin: string | null
  /** Code transpondeur Mode S (hex), récupéré via adsbdb lors de la création automatique. */
  modeS: string | null
  notes: string | null
}

export interface AircraftCompanySummary {
  icaoCode: string
  displayName: string
  logoFilename: string
}

export interface AircraftWithStats extends Aircraft {
  company: AircraftCompanySummary
  flightCount: number
  cumulativeHours: number
  /** Aéroport ICAO du dernier atterrissage connu (PIREP le plus récent), null si l'avion n'a jamais volé. */
  lastKnownIcao: string | null
  /** Heure d'arrivée (simTime UTC) de ce dernier atterrissage connu. */
  lastKnownAt: string | null
  /** Un cycle correspond à un vol terminé enregistré dans les PIREPs. */
  cycleCount: number
  averageLandingFpm: number | null
  /** Consommation moyenne entre le premier démarrage et la coupure du dernier moteur. */
  averageFuelConsumptionKg: number | null
  /** Distance moyenne réellement parcourue, en milles nautiques. */
  averageDistanceNm: number | null
  /** Aéroport d'arrivée le plus fréquent pour cet avion. */
  mostVisitedIcao: string | null
  mostVisitedCount: number
}

export interface AircraftInput {
  companyId: number
  type: string
  registration: string | null
  simbriefIcaoCode: string | null
  simbriefFin: string | null
  modeS: string | null
  notes: string | null
}

export type AircraftPatch = Partial<AircraftInput>
