export const CABIN_ANNOUNCEMENT_TYPES = [
  'boarding_music',
  'boarding_welcome',
  'boarding_complete',
  'arm_doors',
  'presafety_briefing',
  'safety_briefing',
  'cabin_dim_takeoff',
  'crew_seat_takeoff',
  'after_takeoff_9000',
  'descent_seatbelt',
  'crew_seat_landing',
  'after_landing',
  'disarm_doors',
  'disembark_started'
] as const

export type CabinAnnouncementType = (typeof CABIN_ANNOUNCEMENT_TYPES)[number]

export interface CabinAnnouncementDefinition {
  type: CabinAnnouncementType
  label: string
  trigger: string
  icon: string
}

export const CABIN_ANNOUNCEMENT_DEFINITIONS: CabinAnnouncementDefinition[] = [
  { type: 'boarding_music', label: 'Musique d’embarquement', trigger: 'En boucle pendant l’embarquement GSX', icon: '♫' },
  { type: 'boarding_welcome', label: 'Boarding Welcome', trigger: 'Au début, puis toutes les 5 minutes pendant l’embarquement', icon: '👋' },
  { type: 'boarding_complete', label: 'Boarding Complete', trigger: 'Lorsque GSX termine l’embarquement', icon: '✓' },
  { type: 'arm_doors', label: 'Arm Doors', trigger: 'Au début du repoussage GSX', icon: '🔒' },
  { type: 'presafety_briefing', label: 'Presafety Briefing', trigger: 'Lorsque le premier moteur est démarré', icon: '🎙' },
  { type: 'safety_briefing', label: 'Safety Briefing', trigger: '30 secondes après la fin du Presafety Briefing', icon: '🦺' },
  { type: 'cabin_dim_takeoff', label: 'Cabin Dim Takeoff', trigger: '5 secondes après le Safety Briefing, au crépuscule ou de nuit', icon: '☾' },
  { type: 'crew_seat_takeoff', label: 'Crew Seat Takeoff', trigger: 'À l’allumage des strobes ou des feux d’atterrissage', icon: '💺' },
  { type: 'after_takeoff_9000', label: 'Après décollage — 9 000 ft', trigger: 'Au premier passage de 9 000 ft en montée', icon: '↗' },
  { type: 'descent_seatbelt', label: 'Descent Seat Belt', trigger: 'Au début confirmé de la descente', icon: '↘' },
  { type: 'crew_seat_landing', label: 'Crew Seat Landing', trigger: 'À 5 000 ft AGL pendant la descente', icon: '💺' },
  { type: 'after_landing', label: 'Après atterrissage', trigger: 'Après le posé, feux d’atterrissage éteints ou volets rentrés', icon: '🛬' },
  { type: 'disarm_doors', label: 'Disarm Doors', trigger: 'Après le posé, à l’extinction du beacon ou des feux de roulage', icon: '🔓' },
  { type: 'disembark_started', label: 'Disembark Started', trigger: 'À la coupure du dernier moteur après l’atterrissage', icon: '🚪' }
]

/** Période de la journée à laquelle un fichier est destiné : 'any' = toujours, sinon selon l'heure du sim. */
export const CABIN_ANNOUNCEMENT_VARIANTS = ['any', 'day', 'night'] as const
export type CabinAnnouncementVariant = (typeof CABIN_ANNOUNCEMENT_VARIANTS)[number]

export const CABIN_ANNOUNCEMENT_VARIANT_LABEL: Record<CabinAnnouncementVariant, string> = {
  any: 'Toujours',
  day: 'Jour',
  night: 'Nuit'
}

export interface CabinAnnouncementFile {
  /** Identifiant du fichier : un même type d'annonce peut en avoir plusieurs, tirés au hasard à la lecture. */
  id: number
  companyId: number
  type: CabinAnnouncementType
  variant: CabinAnnouncementVariant
  originalFilename: string
  updatedAt: string
  audioUrl: string
  /** Volume propre à ce fichier, de 0 (muet) à 1 (100 %). */
  volume: number
}

export function isCabinAnnouncementVariant(value: string): value is CabinAnnouncementVariant {
  return (CABIN_ANNOUNCEMENT_VARIANTS as readonly string[]).includes(value)
}

export function isCabinAnnouncementType(value: string): value is CabinAnnouncementType {
  return (CABIN_ANNOUNCEMENT_TYPES as readonly string[]).includes(value)
}
